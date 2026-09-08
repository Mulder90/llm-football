import { capture, SAMPLE_INTERVAL_TICKS, stateHash } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import type { GenerationProvenance, RequestReceipt } from '../recording/provenance.ts';
import { applyDecision, emptyBatch } from '../sim/orders.ts';
import { awardRestart } from '../sim/restarts.ts';
import { ENGINE_VERSION, FIELD, TICK_RATE } from '../sim/rules.ts';
import { cloneState, createMatch } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import type { MatchState, Team } from '../sim/types.ts';
import { observe } from '../protocol/observation.ts';
import { rulebook } from '../protocol/rulebook.ts';
import { parseModelDecision, RESPONSE_JSON_SCHEMA, responseSchemaFor } from '../protocol/schema.ts';
import type { ModelDecision } from '../protocol/schema.ts';
import { ProviderError } from './providers.ts';
import type { ControllerRequest, TeamController } from './providers.ts';

export const DEFAULT_LIMITS: GenerationProvenance['limits'] = {
  maximumDecisions: 10,
  maximumRequests: 40,
  maximumRetries: 1,
  maximumOutputTokens: 4096,
  maximumInputBytes: 32768,
  maximumEstimatedUsd: 0.25,
  maximumWallSeconds: 600,
  decisionIntervalTicks: TICK_RATE,
};
const REQUEST_TIMEOUT_MS = 45_000;
const MINIMUM_DECISION_SPACING_TICKS = 15;
const MAXIMUM_MATCH_TICKS = 20 * 60 * TICK_RATE;
const SCHEMA_BYTES = Buffer.byteLength(JSON.stringify(RESPONSE_JSON_SCHEMA));
const REQUEST_OVERHEAD_BYTES = 1024;
const TEAMS = ['coral', 'cyan'] as const;

type GenerationOptions = {
  matchId: string;
  controllers: Record<Team, TeamController>;
  limits: GenerationProvenance['limits'];
  signal?: AbortSignal;
  onCheckpoint?: (recording: Recording) => Promise<void>;
  onProgress?: (progress: {
    decision: number;
    playingSeconds: number;
    phase: string;
    requests: number;
    estimatedUsd: number;
    fallbacks: Team[];
  }) => void;
};

function requestEstimate(
  controller: TeamController,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * controller.config.inputUsdPerMillion +
      outputTokens * controller.config.outputUsdPerMillion) /
    1_000_000
  );
}

export async function decideTogether(
  state: MatchState,
  controllers: Record<Team, TeamController>,
  memories: Record<Team, string>,
  provenance: GenerationProvenance,
  signal: AbortSignal,
  previousDecisionTick = 0,
): Promise<{
  decisions: [ModelDecision, ModelDecision];
  observations: Record<Team, string>;
  fallback: Team[];
  fatal: boolean;
}> {
  // Materialize both observations before dispatch. Retries reuse these exact strings.
  const observations = TEAMS.map((team) =>
    JSON.stringify(
      observe(
        state,
        team,
        memories[team],
        provenance.limits.decisionIntervalTicks,
        previousDecisionTick,
      ),
    ),
  );
  for (const observation of observations) {
    const inputBytes =
      Buffer.byteLength(provenance.rulebook + observation) + SCHEMA_BYTES + REQUEST_OVERHEAD_BYTES;
    if (inputBytes > provenance.limits.maximumInputBytes) throw new Error('input_limit');
  }
  const results = await Promise.all(
    TEAMS.map(async (team, teamIndex) => {
      const controller = controllers[team];
      let feedback: string | null = null;
      for (
        let attempt = 0;
        attempt <= provenance.limits.maximumRetries && !signal.aborted;
        attempt++
      ) {
        const started = performance.now();
        const reservedUsd = requestEstimate(
          controller,
          provenance.limits.maximumInputBytes,
          provenance.limits.maximumOutputTokens,
        );
        const receipt: RequestReceipt = {
          decisionId: state.decisionId,
          tick: state.tick,
          team,
          attempt,
          status: 'error',
          failure: null,
          feedback,
          responseText: null,
          latencyMs: 0,
          responseId: null,
          resolvedModel: null,
          usage: null,
          estimatedUsd: reservedUsd,
        };
        let decision: ModelDecision | null = null;
        let fatal = false;
        try {
          const request: ControllerRequest = {
            rules: provenance.rulebook,
            observation: observations[teamIndex]!,
            feedback,
            maximumOutputTokens: provenance.limits.maximumOutputTokens,
            responseSchema: responseSchemaFor(emptyBatch(state, team)),
          };
          const reply = await controller.request(
            request,
            AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
          );
          receipt.responseId = reply.responseId;
          receipt.responseText = reply.text.slice(0, 16384);
          receipt.resolvedModel = reply.resolvedModel;
          receipt.usage = reply.usage;
          if (reply.usage)
            receipt.estimatedUsd = requestEstimate(
              controller,
              reply.usage.inputTokens,
              reply.usage.outputTokens,
            );
          receipt.status = 'rejected';
          if (!reply.text) throw new Error('empty_refused_or_truncated_output');
          let payload: unknown;
          try {
            payload = JSON.parse(reply.text) as unknown;
          } catch {
            throw new Error('invalid_decision_json');
          }
          decision = parseModelDecision(payload, state, team);
          receipt.status = 'accepted';
        } catch (error) {
          feedback = error instanceof Error ? error.message.slice(0, 240) : 'controller_error';
          receipt.failure = feedback;
          fatal = error instanceof ProviderError && !error.retryable;
        }
        receipt.latencyMs = Math.round(performance.now() - started);
        provenance.requests.push(receipt);
        provenance.estimatedUsd += receipt.estimatedUsd;
        if (decision) return { decision, fallback: false, fatal: false };
        if (fatal)
          return {
            decision: {
              batch: emptyBatch(state, team),
              intent: 'Provider unavailable',
              memory: memories[team],
            },
            fallback: true,
            fatal: true,
          };
      }
      return {
        decision: {
          batch: emptyBatch(state, team),
          intent: 'No accepted reply: continue existing orders until expiry',
          memory: memories[team],
        },
        fallback: true,
        fatal: false,
      };
    }),
  );
  // Receipt order is normalized too; network arrival order never becomes match ordering.
  provenance.requests.sort(
    (first, second) =>
      first.decisionId - second.decisionId ||
      first.attempt - second.attempt ||
      first.team.localeCompare(second.team),
  );
  return {
    decisions: [results[0]!.decision, results[1]!.decision],
    observations: { coral: observations[0]!, cyan: observations[1]! },
    fallback: TEAMS.filter((_, index) => results[index]!.fallback),
    fatal: results.some((result) => result.fatal),
  };
}

export async function generateMatch(options: GenerationOptions): Promise<Recording> {
  const { controllers, limits } = options;
  const started = performance.now();
  const signals = [AbortSignal.timeout(limits.maximumWallSeconds * 1000)];
  if (options.signal) signals.push(options.signal);
  const signal = AbortSignal.any(signals);
  const state = createMatch(options.matchId);
  awardRestart(state, 'kickoff', state.firstKickoffTeam, {
    x: FIELD.length / 2,
    y: FIELD.width / 2,
  });
  const provenance: GenerationProvenance = {
    protocolVersion: 1,
    rulebook: rulebook(),
    responseSchema: JSON.stringify(RESPONSE_JSON_SCHEMA),
    controllers: { coral: controllers.coral.config, cyan: controllers.cyan.config },
    limits: { ...limits },
    status: 'running',
    stopReason: null,
    wallSeconds: 0,
    requests: [],
    estimatedUsd: 0,
  };
  const recording: Recording = {
    format: 'ai-football-recording',
    version: 2,
    engine: ENGINE_VERSION,
    kind: 'llm',
    title: 'The first meeting',
    description:
      'Two model-controlled teams. Every accepted action preserved. Outcomes resolved by the football engine.',
    teams: {
      coral: { name: 'Coral FC', controller: controllers.coral.config.model },
      cyan: { name: 'Cyan FC', controller: controllers.cyan.config.model },
    },
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
    finalHash: '',
    durationTicks: 0,
    generation: provenance,
  };
  const memories: Record<Team, string> = { coral: '', cyan: '' };
  let previousPhase = '';
  let observedOwner = state.ball.owner;
  let lastDecisionTick = -limits.decisionIntervalTicks;
  let stopReason = 'match_tick_limit';
  const requestsPerBoundary = TEAMS.length * (1 + limits.maximumRetries);
  const boundaryReservation = TEAMS.reduce(
    (sum, team) =>
      sum +
      requestEstimate(controllers[team], limits.maximumInputBytes, limits.maximumOutputTokens) *
        (1 + limits.maximumRetries),
    0,
  );

  function checkpoint(): void {
    recording.durationTicks = state.tick;
    recording.finalHash = stateHash(state);
    recording.events = [...state.events];
    provenance.wallSeconds = (performance.now() - started) / 1000;
  }

  while (state.phase.type !== 'full_time' && state.tick < MAXIMUM_MATCH_TICKS) {
    if (signal.aborted) {
      stopReason = 'cancelled_or_wall_time_limit';
      break;
    }
    const phaseKey = `${state.phase.type}:${state.phase.sinceTick}`;
    const phaseChanged = phaseKey !== previousPhase;
    const elapsedTicks = state.tick - lastDecisionTick;
    const possessionChanged =
      state.ball.owner !== observedOwner && elapsedTicks >= MINIMUM_DECISION_SPACING_TICKS;
    const decisionDue =
      phaseChanged || elapsedTicks >= limits.decisionIntervalTicks || possessionChanged;
    if (decisionDue && state.phase.type !== 'halftime') {
      if (recording.decisions.length >= limits.maximumDecisions) {
        stopReason = 'decision_limit';
        break;
      }
      if (provenance.requests.length + requestsPerBoundary > limits.maximumRequests) {
        stopReason = 'request_limit';
        break;
      }
      if (provenance.estimatedUsd + boundaryReservation > limits.maximumEstimatedUsd) {
        stopReason = 'estimated_cost_limit';
        break;
      }
      let resolution: Awaited<ReturnType<typeof decideTogether>>;
      try {
        resolution = await decideTogether(
          state,
          controllers,
          memories,
          provenance,
          signal,
          lastDecisionTick,
        );
      } catch (error) {
        stopReason = error instanceof Error ? error.message : 'generation_error';
        break;
      }
      if (resolution.fatal || signal.aborted) {
        stopReason = resolution.fatal ? 'provider_unavailable' : 'cancelled_or_wall_time_limit';
        break;
      }
      const [coral, cyan] = resolution.decisions;
      recording.decisions.push({
        tick: state.tick,
        batches: applyDecision(state, coral.batch, cyan.batch),
        fallback: resolution.fallback,
        notes: {
          coral: { intent: coral.intent, memory: coral.memory },
          cyan: { intent: cyan.intent, memory: cyan.memory },
        },
        observations: resolution.observations,
      });
      memories.coral = coral.memory;
      memories.cyan = cyan.memory;
      lastDecisionTick = state.tick;
      observedOwner = state.ball.owner;
      options.onProgress?.({
        decision: state.decisionId,
        playingSeconds: state.playingTicks / TICK_RATE,
        phase: state.phase.type,
        requests: provenance.requests.length,
        estimatedUsd: provenance.estimatedUsd,
        fallbacks: resolution.fallback,
      });
      // Save after execution of this boundary's first tick, so replay consumes every logged decision.
    }
    previousPhase = phaseKey;
    const previousEventCount = state.events.length;
    step(state);
    if (
      state.tick % SAMPLE_INTERVAL_TICKS === 0 ||
      state.events.length !== previousEventCount ||
      `${state.phase.type}:${state.phase.sinceTick}` !== phaseKey
    )
      recording.frames.push(capture(state));
    if (state.tick === lastDecisionTick + 1) {
      if (recording.frames.at(-1)!.tick !== state.tick) recording.frames.push(capture(state));
      checkpoint();
      await options.onCheckpoint?.(recording);
    }
  }
  if (recording.frames.at(-1)!.tick !== state.tick) recording.frames.push(capture(state));
  checkpoint();
  const completed = state.phase.type === 'full_time' && state.phase.reason === 'completed';
  provenance.status = completed ? 'complete' : 'incomplete';
  provenance.stopReason = completed
    ? null
    : state.phase.type === 'full_time'
      ? 'match_abandoned'
      : stopReason;
  await options.onCheckpoint?.(recording);
  return recording;
}
