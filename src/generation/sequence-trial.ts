import { z } from 'zod';
import {
  createFootballSequence,
  scriptedSequenceControllers,
  SEQUENCE_IDS,
} from '../fixtures/sustained-play.ts';
import { observe } from '../protocol/observation.ts';
import { rulebook } from '../protocol/rulebook.ts';
import type { ProviderUsd } from '../recording/provenance.ts';
import { verifyRecording } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import type { Team } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { generationProviderUsd, requestInputBytes, reserveProviderUsd } from './budget.ts';
import { geminiController, openaiController } from './providers.ts';
import type { TeamController } from './providers.ts';
import { evaluateSequence, SEQUENCE_LIMITS } from './sequences.ts';

const teams = ['coral', 'cyan'] as const;
const dollars = z.coerce.number().nonnegative().max(3);
const trialOptions = z
  .strictObject({
    mode: z.enum(['scripted', 'models']).default('scripted'),
    scenarios: z
      .array(z.enum(SEQUENCE_IDS))
      .min(1)
      .default([...SEQUENCE_IDS])
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each scenario once'),
    repetitions: z.coerce.number().int().min(1).max(3).default(1),
    rounds: z.coerce.number().int().min(1).max(32).optional(),
    requests: z.coerce.number().int().min(1).max(1152).optional(),
    wallSeconds: z.coerce.number().int().min(1).max(1800).optional(),
    usd: dollars.optional(),
    openaiUsd: dollars.optional(),
    geminiUsd: dollars.optional(),
  })
  .superRefine((options, ctx) => {
    for (const field of ['usd', 'openaiUsd', 'geminiUsd'] as const) {
      if (options.mode === 'models' && options[field] === undefined)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Model trials require an explicit combined and each-provider budget',
        });
      if (options.mode === 'scripted' && options[field] !== undefined && options[field] !== 0)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Scripted trials cannot spend money',
        });
    }
  });

/** This slice uses the previously reviewed pair, without environment-based model overrides. */
export function sequenceModelControllers(keys: { openai: string; gemini: string }) {
  return {
    coral: openaiController(keys.openai, 'gpt-5-mini'),
    cyan: geminiController(keys.gemini, 'gemini-3.8-flash'),
  };
}

/** Planning does not read credentials or make requests. */
export function planSequenceTrial(input: unknown = {}) {
  const options = trialOptions.parse(input);
  const plannedRuns = options.scenarios.length * options.repetitions;
  const rounds = options.rounds ?? (options.mode === 'models' ? 12 : 32);
  const requestsPerRun = 2 * rounds * (1 + SEQUENCE_LIMITS.maximumRetries);
  const limits = {
    ...SEQUENCE_LIMITS,
    maximumDecisions: rounds,
    maximumRequests: Math.min(options.requests ?? Infinity, plannedRuns * requestsPerRun),
    maximumEstimatedUsd: options.usd ?? 0,
    maximumEstimatedUsdByProvider: {
      openai: options.openaiUsd ?? 0,
      gemini: options.geminiUsd ?? 0,
    },
    maximumWallSeconds: options.wallSeconds ?? (options.mode === 'models' ? 900 : 30 * plannedRuns),
  };
  const configs =
    options.mode === 'models'
      ? sequenceModelControllers({ openai: 'unused', gemini: 'unused' })
      : scriptedSequenceControllers(options.scenarios[0]!);
  const reservation = reserveProviderUsd(
    teams.map((team) => configs[team].config),
    limits.maximumInputBytes,
    limits.maximumOutputTokens,
    1 + limits.maximumRetries,
  );
  return {
    mode: options.mode,
    repetitions: options.repetitions,
    plannedRuns,
    seed: 34891,
    controllers:
      options.mode === 'models' ? { coral: configs.coral.config, cyan: configs.cyan.config } : null,
    maximumRoundsPerRun: rounds,
    baseRequestCeilingPerRun: 2 * rounds,
    requestCeilingWithRepairsPerRun: requestsPerRun,
    totalRequestCeilingWithRepairs: limits.maximumRequests,
    boundaryReservationUsd: { combined: reservation.openai + reservation.gemini, ...reservation },
    // Spending, request and wall-clock limits apply once across the whole trial.
    limits,
    scenarios: options.scenarios.map((id) => {
      const scenario = createFootballSequence(id);
      return {
        id,
        playingSeconds: scenario.playingTicks / TICK_RATE,
        firstInputBytes: Object.fromEntries(
          teams.map((team) => [
            team,
            requestInputBytes(
              rulebook(),
              JSON.stringify(
                observe(
                  scenario.initial,
                  team,
                  null,
                  limits.decisionIntervalTicks,
                  0,
                  scenario.playingTicks,
                ),
              ),
            ),
          ]),
        ),
      };
    }),
  };
}

type Plan = ReturnType<typeof planSequenceTrial>;
type Result = Omit<Awaited<ReturnType<typeof evaluateSequence>>, 'recording'> & {
  repetition: number;
  recordingFile: string;
  finalHash: string;
};
export type SequenceTrialReport = {
  format: 'ai-football-sequence-evaluation';
  version: 2;
  plan: Plan;
  status: 'running' | 'complete' | 'incomplete';
  stopReason: string | null;
  results: Result[];
  activeRecordingFile: string | null;
  totals: {
    requests: number;
    estimatedUsd: number;
    estimatedUsdByProvider: ProviderUsd;
    wallSeconds: number;
  };
};

/** Serial scenarios share one allowance; each still uses concurrent team decisions. */
export async function runSequenceTrial(options: {
  plan: Plan;
  controllersForScenario: (id: (typeof SEQUENCE_IDS)[number]) => Record<Team, TeamController>;
  signal?: AbortSignal;
  onCheckpoint: (report: SequenceTrialReport, recording: Recording | null) => Promise<void>;
  onProgress?: (progress: {
    scenarioId: string;
    repetition: number;
    playingSeconds: number;
    requests: number;
    estimatedUsd: number;
  }) => void;
}) {
  const { plan } = options;
  const started = performance.now();
  const timeout = AbortSignal.timeout(plan.limits.maximumWallSeconds * 1000);
  const signal = AbortSignal.any([timeout, ...(options.signal ? [options.signal] : [])]);
  const report: SequenceTrialReport = {
    format: 'ai-football-sequence-evaluation',
    version: 2,
    plan,
    status: 'running',
    stopReason: null,
    results: [],
    activeRecordingFile: null,
    totals: {
      requests: 0,
      estimatedUsd: 0,
      estimatedUsdByProvider: { openai: 0, gemini: 0 },
      wallSeconds: 0,
    },
  };
  const elapsed = () => (performance.now() - started) / 1000;
  const cancelled = () => (options.signal?.aborted ? 'cancelled' : 'wall_time_limit');
  await options.onCheckpoint(report, null);
  try {
    evaluation: for (const { id } of plan.scenarios) {
      for (let repetition = 1; repetition <= plan.repetitions; repetition++) {
        if (signal.aborted || elapsed() >= plan.limits.maximumWallSeconds) {
          report.stopReason = cancelled();
          break evaluation;
        }
        const controllers = options.controllersForScenario(id);
        for (const team of teams) {
          if (
            plan.controllers
              ? JSON.stringify(controllers[team].config) !== JSON.stringify(plan.controllers[team])
              : controllers[team].config.provider !== 'scripted'
          )
            throw new Error('Controller configuration differs from the reviewed trial plan');
        }
        // Freeze completed costs before active checkpoints replace the trial totals.
        const spent = structuredClone(report.totals);
        const file = `${id}-${repetition}.json`;
        report.activeRecordingFile = file;
        await options.onCheckpoint(report, null);
        const { recording, ...result } = await evaluateSequence({
          scenario: createFootballSequence(id),
          controllers,
          signal,
          limits: {
            ...plan.limits,
            maximumRequests: Math.min(
              plan.requestCeilingWithRepairsPerRun,
              Math.max(0, plan.limits.maximumRequests - spent.requests),
            ),
            maximumEstimatedUsd: Math.max(0, plan.limits.maximumEstimatedUsd - spent.estimatedUsd),
            maximumEstimatedUsdByProvider: {
              openai: Math.max(
                0,
                plan.limits.maximumEstimatedUsdByProvider.openai -
                  spent.estimatedUsdByProvider.openai,
              ),
              gemini: Math.max(
                0,
                plan.limits.maximumEstimatedUsdByProvider.gemini -
                  spent.estimatedUsdByProvider.gemini,
              ),
            },
            maximumWallSeconds: Math.max(1, Math.ceil(plan.limits.maximumWallSeconds - elapsed())),
          },
          async onCheckpoint(recording) {
            const generation = recording.generation!;
            const providerUsd = generationProviderUsd(generation);
            report.totals = {
              requests: spent.requests + generation.requests.length,
              estimatedUsd: spent.estimatedUsd + generation.estimatedUsd,
              estimatedUsdByProvider: {
                openai: spent.estimatedUsdByProvider.openai + providerUsd.openai,
                gemini: spent.estimatedUsdByProvider.gemini + providerUsd.gemini,
              },
              wallSeconds: elapsed(),
            };
            await options.onCheckpoint(report, recording);
          },
          onProgress(progress) {
            options.onProgress?.({
              scenarioId: id,
              repetition,
              playingSeconds: progress.playingSeconds,
              requests: spent.requests + progress.requests,
              estimatedUsd: spent.estimatedUsd + progress.estimatedUsd,
            });
          },
        });
        verifyRecording(recording);
        report.results.push({
          ...result,
          repetition,
          recordingFile: file,
          finalHash: recording.finalHash,
        });
        report.activeRecordingFile = null;
        await options.onCheckpoint(report, null);
        if (signal.aborted || result.status !== 'complete') {
          report.stopReason = signal.aborted ? cancelled() : result.stopReason;
          break evaluation;
        }
        // A failed football criterion does not discard or retry a completed scenario.
      }
    }
    report.status =
      report.results.length === plan.plannedRuns &&
      report.results.every((result) => result.status === 'complete')
        ? 'complete'
        : 'incomplete';
  } catch (error) {
    report.status = 'incomplete';
    report.stopReason = `evaluation_error: ${error instanceof Error ? error.message.slice(0, 240) : 'unknown'}`;
    throw error;
  } finally {
    report.totals.wallSeconds = elapsed();
    await options.onCheckpoint(report, null);
  }
  return report;
}
