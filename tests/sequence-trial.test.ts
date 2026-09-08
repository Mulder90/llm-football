import { describe, expect, it, vi } from 'vitest';
import { scriptedSequenceControllers, type SEQUENCE_IDS } from '../src/fixtures/sustained-play.ts';
import { ProviderError } from '../src/generation/providers.ts';
import {
  planSequenceTrial,
  runSequenceTrial,
  sequenceModelControllers,
  type SequenceTrialReport,
} from '../src/generation/sequence-trial.ts';
import { parseRecording } from '../src/recording/validate.ts';
import { verifyRecording, type Recording } from '../src/recording/record.ts';

const paidPlan = (overrides = {}) =>
  planSequenceTrial({
    mode: 'models',
    usd: 3,
    openaiUsd: 3,
    geminiUsd: 3,
    ...overrides,
  });
// Offline adapter mocks use real reviewed prices; no provider call is made.
function pricedScripts(id: (typeof SEQUENCE_IDS)[number]) {
  const scripts = scriptedSequenceControllers(id);
  const models = sequenceModelControllers({ openai: 'test-unused', gemini: 'test-unused' });
  return {
    coral: { ...models.coral, request: scripts.coral.request },
    cyan: { ...models.cyan, request: scripts.cyan.request },
  };
}
const checkpoint = async () => {};

describe('bounded sequence trials', () => {
  it('requires explicit paid allowances and plans the whole request ceiling without network access', () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network'));
    try {
      expect(planSequenceTrial().mode).toBe('scripted');
      for (const field of ['usd', 'openaiUsd', 'geminiUsd']) {
        const options: Record<string, unknown> = {
          mode: 'models',
          usd: 0.6,
          openaiUsd: 0.2,
          geminiUsd: 0.4,
        };
        delete options[field];
        expect(() => planSequenceTrial(options)).toThrow('explicit');
      }
      for (const options of [
        { mode: 'scripted', usd: 1 },
        { usd: NaN },
        { rounds: Infinity },
        { repetitions: 4 },
        { scenarios: ['keeper-outlet', 'keeper-outlet'] },
      ])
        expect(() => planSequenceTrial(options)).toThrow();
      const plan = paidPlan({ usd: 0.6, openaiUsd: 0.2, geminiUsd: 0.4 });
      expect(plan).toMatchObject({
        plannedRuns: 3,
        maximumRoundsPerRun: 12,
        baseRequestCeilingPerRun: 24,
        totalRequestCeilingWithRepairs: 144,
      });
      expect(plan.boundaryReservationUsd.combined).toBeCloseTo(0.11264);
      expect(plan.boundaryReservationUsd.openai).toBeCloseTo(0.032768);
      expect(plan.boundaryReservationUsd.gemini).toBeCloseTo(0.079872);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });

  it.each([
    ['combined', { usd: 0.6 }, 'estimated_cost_limit'],
    ['openai', { openaiUsd: 0.18 }, 'openai_estimated_cost_limit'],
    ['gemini', { geminiUsd: 0.42 }, 'gemini_estimated_cost_limit'],
  ] as const)(
    'keeps the %s allowance across scenarios and accounts for every checkpoint once',
    async (_name, limits, reason) => {
      const snapshots: SequenceTrialReport[] = [];
      const report = await runSequenceTrial({
        plan: paidPlan(limits),
        controllersForScenario: pricedScripts,
        async onCheckpoint(report, recording) {
          snapshots.push(structuredClone(report));
          if (recording) verifyRecording(parseRecording(recording));
        },
      });
      expect(report.status).toBe('incomplete');
      expect(report.stopReason).toBe(reason);
      expect(report.results).toHaveLength(2);
      expect(report.results[0]!.status).toBe('complete');
      expect(report.results[1]!.execution.requests).toBe(2);
      expect(report.totals.requests).toBe(18);
      expect(report.totals.estimatedUsd).toBeCloseTo(9 * (0.016384 + 0.039936));
      expect(report.totals.estimatedUsd).toBeLessThanOrEqual(
        report.plan.limits.maximumEstimatedUsd,
      );
      for (const provider of ['openai', 'gemini'] as const)
        expect(report.totals.estimatedUsdByProvider[provider]).toBeLessThanOrEqual(
          report.plan.limits.maximumEstimatedUsdByProvider[provider],
        );
      expect(snapshots.map((snapshot) => snapshot.totals.requests)).toEqual(
        snapshots.map((snapshot) => snapshot.totals.requests).sort((a, b) => a - b),
      );
    },
  );

  it('charges repairs to the shared request ceiling without granting a new allowance per case', async () => {
    const report = await runSequenceTrial({
      plan: paidPlan({ requests: 20 }),
      controllersForScenario(id) {
        const controllers = pricedScripts(id);
        const base = controllers.coral;
        controllers.coral = {
          ...base,
          async request(request, signal) {
            if (
              id === 'carry-pressure' &&
              JSON.parse(request.observation).responseIdentity.decisionId === 0 &&
              !request.feedback
            )
              return { text: '{}', usage: null, responseId: null, resolvedModel: null };
            return base.request(request, signal);
          },
        };
        return controllers;
      },
      onCheckpoint: checkpoint,
    });
    expect(report.results[0]!.execution.repairs).toBe(1);
    expect(report.results[0]!.status).toBe('complete');
    expect(report.results[1]!.execution.requests).toBe(0);
    expect(report.totals.requests).toBe(17);
    expect(report.stopReason).toBe('request_limit'); // Only three slots remain; a pair reserves four.
  });

  it('retains failed football criteria and continues to the next scenario without reruns', async () => {
    const created: string[] = [];
    const report = await runSequenceTrial({
      plan: planSequenceTrial(),
      controllersForScenario(id) {
        created.push(id);
        const controllers = scriptedSequenceControllers(id);
        if (id === 'carry-pressure') {
          const base = controllers.coral;
          controllers.coral = {
            ...base,
            async request(request, signal) {
              const reply = await base.request(request, signal);
              const payload = JSON.parse(reply.text);
              payload.batch.orders = [{ type: 'hold', playerId: 'coral-7' }];
              payload.memory.pass = null;
              return { ...reply, text: JSON.stringify(payload) };
            },
          };
        }
        return controllers;
      },
      onCheckpoint: checkpoint,
    });
    expect(report.status).toBe('complete');
    expect(Object.values(report.results[0]!.criteria).every(Boolean)).toBe(false);
    expect(created).toEqual(['carry-pressure', 'receive-follow-up', 'keeper-outlet']);
    expect(report.results).toHaveLength(3);
  });

  it('stops the trial on permanent failure and retains uncommitted request charges', async () => {
    let final: Recording | null = null;
    const report = await runSequenceTrial({
      plan: paidPlan(),
      controllersForScenario(id) {
        const controllers = pricedScripts(id);
        controllers.coral.request = async () => {
          throw new ProviderError('http_401: unavailable', false);
        };
        return controllers;
      },
      async onCheckpoint(_report, recording) {
        if (recording) final = structuredClone(recording);
      },
    });
    expect(report.stopReason).toBe('provider_unavailable');
    expect(report.results).toHaveLength(1);
    expect(report.totals.requests).toBe(2);
    expect(report.totals.estimatedUsd).toBeCloseTo(0.05632);
    expect(verifyRecording(parseRecording(final)).tick).toBe(0);
  });

  it('applies one wall-clock deadline across scenarios, including checkpoint time', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    let snapshots = 0;
    try {
      const report = await runSequenceTrial({
        plan: planSequenceTrial({ wallSeconds: 1 }),
        controllersForScenario: scriptedSequenceControllers,
        async onCheckpoint(report) {
          snapshots++;
          if (report.results.length === 1) vi.advanceTimersByTime(1100);
        },
      });
      expect(report.status).toBe('incomplete');
      expect(report.stopReason).toBe('wall_time_limit');
      expect(report.results).toHaveLength(1);
      expect(snapshots).toBeGreaterThan(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves the active recording and totals if saving its checkpoint fails', async () => {
    const snapshots: SequenceTrialReport[] = [];
    await expect(
      runSequenceTrial({
        plan: paidPlan(),
        controllersForScenario: pricedScripts,
        async onCheckpoint(report, recording) {
          snapshots.push(structuredClone(report));
          if (recording) throw new Error('disk full');
        },
      }),
    ).rejects.toThrow('disk full');
    expect(snapshots.at(-1)).toMatchObject({
      status: 'incomplete',
      stopReason: 'evaluation_error: disk full',
      activeRecordingFile: 'carry-pressure-1.json',
      totals: { requests: 2 },
    });
  });
});
