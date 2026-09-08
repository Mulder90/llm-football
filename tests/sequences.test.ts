import { describe, expect, it, vi } from 'vitest';
import {
  createFootballSequence,
  scriptedSequenceControllers,
  SEQUENCE_IDS,
} from '../src/fixtures/sustained-play.ts';
import { evaluateSequence, measureSequence, SEQUENCE_LIMITS } from '../src/generation/sequences.ts';
import { runMatchFromState } from '../src/generation/run.ts';
import type { TeamController } from '../src/generation/providers.ts';
import { parseRecording } from '../src/recording/validate.ts';
import { stateHash, verifyRecording } from '../src/recording/record.ts';
import type { Recording } from '../src/recording/record.ts';
import type { observe } from '../src/protocol/observation.ts';
import { awardRestart } from '../src/sim/restarts.ts';
import type { Team } from '../src/sim/types.ts';

type Observation = ReturnType<typeof observe>;
const teams = ['coral', 'cyan'] as const;

describe('sustained football through the paired match runner', () => {
  it.each(SEQUENCE_IDS)(
    'runs and independently replays %s with honest scripted provenance',
    async (id) => {
      const network = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('No network in offline runs'));
      try {
        const scenario = createFootballSequence(id);
        const before = stateHash(scenario.initial);
        const result = await evaluateSequence({
          scenario,
          controllers: scriptedSequenceControllers(id),
        });
        expect(result.status).toBe('complete');
        expect(Object.values(result.criteria).every(Boolean)).toBe(true);
        expect(result.execution).toMatchObject({
          repairs: 0,
          fallbacks: 0,
          estimatedUsd: 0,
          estimatedUsdByProvider: { openai: 0, gemini: 0 },
        });
        expect(result.execution.rounds).toBeGreaterThanOrEqual(8);
        expect(result.execution.requests).toBe(result.execution.rounds * 2);
        expect(result.recording.kind).toBe('fixture');
        expect(result.recording.generation).toMatchObject({
          status: 'incomplete',
          stopReason: 'playing_time_limit',
        });
        const imported = parseRecording(JSON.parse(JSON.stringify(result.recording)));
        const replay = verifyRecording(imported);
        expect(replay.playingTicks).toBe(480);
        expect(replay.phase.type).not.toBe('full_time');
        expect(stateHash(scenario.initial)).toBe(before);
        expect(network).not.toHaveBeenCalled();
        for (const [index, decision] of imported.decisions.entries()) {
          const observations = teams.map(
            (team) => JSON.parse(decision.observations![team]) as Observation,
          );
          expect(observations[0]!.ball).toEqual(observations[1]!.ball);
          expect(observations[0]!.evaluation).toEqual(observations[1]!.evaluation);
          expect(observations[0]!.evaluation!.remainingPlayingTicks).toBe(
            480 - Math.round(observations[0]!.playingSeconds * 60),
          );
          for (const [side, team] of teams.entries()) {
            expect(decision.batches[side]!.orders).toHaveLength(11);
            expect(observations[side]!.privateMemory).toEqual(
              index === 0 ? null : imported.decisions[index - 1]!.notes![team].memory,
            );
            const opposingPlan = index
              ? imported.decisions[index - 1]!.notes![team === 'coral' ? 'cyan' : 'coral'].memory!
                  .plan
              : '';
            if (opposingPlan) expect(decision.observations![team]).not.toContain(opposingPlan);
          }
        }
        // Metrics do not depend on sparse viewer samples or animation interpolation.
        expect(
          measureSequence({ ...imported, frames: [imported.frames[0]!, imported.frames.at(-1)!] }),
        ).toEqual(result.metrics);
      } finally {
        network.mockRestore();
      }
    },
  );

  it('replans after physical reception while release alone waits for the regular interval', async () => {
    const result = await evaluateSequence({
      scenario: createFootballSequence('receive-follow-up'),
      controllers: scriptedSequenceControllers('receive-follow-up'),
    });
    const pass = result.metrics.completedPasses[0]!;
    expect(pass).toMatchObject({
      from: 'coral-7',
      to: 'coral-6',
      releaseTick: 0,
      nextOrder: 'move',
    });
    expect(result.recording.decisions[1]!.tick).toBe(60);
    expect(pass.nextDecisionTick).toBeGreaterThan(pass.receiveTick);
    expect(pass.nextDecisionTick).toBeLessThan(120);
    expect(pass.controlledCarryAfterMetres).toBeGreaterThan(3);
  });

  it('reports an actual controlled turnover and retains the failed carry criterion', async () => {
    const scenario = createFootballSequence('carry-pressure');
    scenario.initial.players.find((player) => player.id === 'cyan-10')!.position = {
      x: 36.2,
      y: 34,
    };
    const controllers = scriptedSequenceControllers(scenario.id);
    for (const team of teams) {
      const base = controllers[team];
      controllers[team] = {
        ...base,
        async request(request, signal) {
          const reply = await base.request(request, signal);
          const payload = JSON.parse(reply.text);
          if (team === 'coral') payload.batch.orders = [{ type: 'hold', playerId: 'coral-7' }];
          else if (payload.batch.decisionId === 0)
            payload.batch.orders = [{ type: 'tackle', playerId: 'cyan-10', targetId: 'coral-7' }];
          payload.memory.pass = null;
          return { ...reply, text: JSON.stringify(payload) };
        },
      };
    }
    const result = await evaluateSequence({ scenario, controllers });
    expect(result.status).toBe('complete');
    expect(result.metrics.turnovers.coral).toBe(1);
    expect(result.metrics.footCarryMetres.cyan).toBeGreaterThan(5);
    expect(result.metrics.completedPasses).toEqual([]);
    expect(Object.values(result.criteria).every(Boolean)).toBe(false);
    expect(() => verifyRecording(result.recording)).not.toThrow();
  });

  it('counts playing time through restart pauses and checkpoints only replay-consumable decisions', async () => {
    const scenario = createFootballSequence('carry-pressure');
    awardRestart(scenario.initial, 'kickoff', 'coral', { x: 52.5, y: 34 });
    scenario.playingTicks = 180;
    const checkpoints: Recording[] = [];
    const result = await evaluateSequence({
      scenario,
      controllers: scriptedSequenceControllers(scenario.id),
      async onCheckpoint(recording) {
        checkpoints.push(structuredClone(recording));
      },
    });
    expect(result.metrics.playingSeconds).toBe(3);
    expect(result.metrics.simulationSeconds).toBeGreaterThan(3);
    const observations = result.recording.decisions.map(
      (decision) => JSON.parse(decision.observations!.coral) as Observation,
    );
    expect(
      observations
        .filter((observation) => observation.phase.type !== 'open_play')
        .every((observation) => observation.evaluation!.remainingPlayingTicks === 180),
    ).toBe(true);
    expect(
      observations.every((observation) => observation.evaluation!.remainingPlayingTicks > 0),
    ).toBe(true);
    for (const checkpoint of checkpoints)
      expect(() => verifyRecording(parseRecording(checkpoint))).not.toThrow();
  });

  it('preserves illegal keeper attempts and holding sanctions as failed football evidence', async () => {
    const scenario = createFootballSequence('keeper-outlet');
    scenario.playingTicks = 600;
    const controllers = scriptedSequenceControllers(scenario.id);
    const base = controllers.coral;
    controllers.coral = {
      ...base,
      async request(request, signal) {
        const reply = await base.request(request, signal);
        const observation = JSON.parse(request.observation) as Observation;
        const payload = JSON.parse(reply.text);
        if (observation.ball.possessionMode === 'hands') {
          payload.batch.orders = [
            { type: 'kick', playerId: 'coral-1', target: { x: 30, y: 34 }, speed: 10, loft: 0 },
          ];
          payload.memory.pass = null;
        }
        return { ...reply, text: JSON.stringify(payload) };
      },
    };
    const result = await evaluateSequence({ scenario, controllers });
    expect(result.status).toBe('complete');
    expect(result.metrics.keeper.violations).toBeGreaterThan(0);
    expect(result.metrics.orderFailures.length).toBeGreaterThan(0);
    expect(result.criteria.noExecutionFailures).toBe(false);
    expect(result.metrics.simulationSeconds).toBeGreaterThan(result.metrics.playingSeconds);
    expect(verifyRecording(result.recording).playingTicks).toBe(600);
  });

  it('repairs one team and retains the other team’s prior memory on fallback without stopping the run', async () => {
    const scenario = createFootballSequence('carry-pressure');
    const controllers = scriptedSequenceControllers(scenario.id);
    for (const team of teams) {
      const base = controllers[team];
      controllers[team] = {
        ...base,
        async request(request, signal) {
          const observation = JSON.parse(request.observation) as Observation;
          if (
            observation.responseIdentity.decisionId === 1 &&
            (team === 'cyan' || !request.feedback)
          )
            return { text: '{}', usage: null, responseId: null, resolvedModel: null };
          return base.request(request, signal);
        },
      };
    }
    const result = await evaluateSequence({ scenario, controllers });
    expect(result.execution).toMatchObject({ repairs: 2, fallbacks: 1, estimatedUsd: 0 });
    expect(result.criteria.noFallbacks).toBe(false);
    expect(result.recording.decisions[1]!.fallback).toEqual(['cyan']);
    const third = result.recording.decisions[2]!;
    for (const team of teams) {
      const observed = JSON.parse(third.observations![team]) as Observation;
      expect(observed.privateMemory).toEqual(
        result.recording.decisions[team === 'coral' ? 1 : 0]!.notes![team].memory,
      );
      const attempts = result.recording.generation!.requests.filter(
        (receipt) => receipt.decisionId === 1 && receipt.team === team,
      );
      expect(attempts).toHaveLength(2);
      expect(attempts[1]!.feedback).toBeTruthy();
    }
    expect(() => verifyRecording(result.recording)).not.toThrow();
  });

  it('produces identical physics and observations when opposite teams respond first', async () => {
    const run = async (slow: Team) => {
      const controllers = scriptedSequenceControllers('receive-follow-up');
      for (const team of teams) {
        const base = controllers[team];
        controllers[team] = {
          ...base,
          async request(request, signal) {
            if (team === slow) await new Promise((resolve) => setTimeout(resolve, 2));
            return base.request(request, signal);
          },
        };
      }
      return evaluateSequence({
        scenario: createFootballSequence('receive-follow-up'),
        controllers,
      });
    };
    const first = await run('cyan'),
      second = await run('coral');
    expect(first.recording.finalHash).toBe(second.recording.finalHash);
    expect(first.recording.decisions).toEqual(second.recording.decisions);
    expect(first.metrics).toEqual(second.metrics);
    expect(
      first.recording.generation!.requests.map(({ team, attempt }) => ({ team, attempt })),
    ).toEqual(
      second.recording.generation!.requests.map(({ team, attempt }) => ({ team, attempt })),
    );
  });

  it.each(['request', 'input'] as const)('stops before dispatch at the %s limit', async (limit) => {
    const controllers = scriptedSequenceControllers('carry-pressure');
    const calls = teams.map((team) => vi.spyOn(controllers[team], 'request'));
    const result = await evaluateSequence({
      scenario: createFootballSequence('carry-pressure'),
      controllers,
      limits: {
        ...SEQUENCE_LIMITS,
        ...(limit === 'request' ? { maximumRequests: 3 } : { maximumInputBytes: 100 }),
      },
    });
    expect(result.status).toBe('incomplete');
    expect(result.stopReason).toBe(`${limit}_limit`);
    expect(result.execution.requests).toBe(0);
    expect(calls.every((call) => call.mock.calls.length === 0)).toBe(true);
    expect(verifyRecording(result.recording).tick).toBe(0);
  });

  it.each(['openai', 'gemini'] as const)(
    'retains the real runner’s %s budget barrier for future paired evaluations',
    async (provider) => {
      const controllers = scriptedSequenceControllers('carry-pressure');
      const calls = vi.fn<TeamController['request']>(async () => {
        throw new Error('Budget must stop dispatch');
      });
      for (const team of teams)
        controllers[team] = {
          ...controllers[team],
          config: {
            ...controllers[team].config,
            provider: team === 'coral' ? 'openai' : 'gemini',
            inputUsdPerMillion: 1,
            outputUsdPerMillion: 1,
          },
          request: calls,
        };
      const result = await evaluateSequence({
        scenario: createFootballSequence('carry-pressure'),
        controllers,
        limits: {
          ...SEQUENCE_LIMITS,
          maximumEstimatedUsd: 1,
          maximumEstimatedUsdByProvider: { [provider]: 0 },
        },
      });
      expect(result.stopReason).toBe(`${provider}_estimated_cost_limit`);
      expect(calls).not.toHaveBeenCalled();
      expect(result.recording.kind).toBe('llm');
      expect(result.execution.estimatedUsd).toBe(0);
    },
  );

  it('keeps cancelled request receipts without applying half a paired decision', async () => {
    const abort = new AbortController();
    const controllers = scriptedSequenceControllers('carry-pressure');
    let calls = 0;
    for (const team of teams)
      controllers[team] = {
        ...controllers[team],
        async request(_request, signal) {
          calls++;
          await Promise.resolve();
          abort.abort();
          signal.throwIfAborted();
          throw new Error('unreachable');
        },
      };
    const result = await evaluateSequence({
      scenario: createFootballSequence('carry-pressure'),
      controllers,
      signal: abort.signal,
    });
    expect(calls).toBe(2);
    expect(result.stopReason).toBe('cancelled_or_wall_time_limit');
    expect(result.recording.decisions).toEqual([]);
    expect(result.execution).toMatchObject({ requests: 2, estimatedUsd: 0 });
    expect(verifyRecording(result.recording).tick).toBe(0);
  });

  it.each([0, -1, NaN, Infinity, 1.5, 3601])(
    'rejects an invalid playing horizon %s',
    async (maximumPlayingTicks) => {
      await expect(
        runMatchFromState({
          initialState: createFootballSequence('carry-pressure').initial,
          title: 'Invalid limit',
          description: '',
          controllers: scriptedSequenceControllers('carry-pressure'),
          limits: { ...SEQUENCE_LIMITS, maximumPlayingTicks },
        }),
      ).rejects.toThrow('Playing-time limit');
    },
  );

  it('rejects resumed states and mixed model/scripted labeling', async () => {
    const initialState = createFootballSequence('carry-pressure').initial;
    initialState.tick = 1;
    const controllers = scriptedSequenceControllers('carry-pressure');
    const options = {
      initialState,
      controllers,
      title: 'Invalid start',
      description: '',
      limits: SEQUENCE_LIMITS,
    };
    await expect(runMatchFromState(options)).rejects.toThrow('tick-zero');
    initialState.tick = 0;
    controllers.cyan = {
      ...controllers.cyan,
      config: { ...controllers.cyan.config, provider: 'gemini' },
    };
    await expect(runMatchFromState(options)).rejects.toThrow('two scripted');
  });

  it('rejects forged model labels, model usage and completed-match claims on imported offline sequences', async () => {
    const result = await evaluateSequence({
      scenario: createFootballSequence('carry-pressure'),
      controllers: scriptedSequenceControllers('carry-pressure'),
    });
    for (const kind of [
      'model-label',
      'paid-usage',
      'completed-match',
      'invalid-horizon',
      'mismatched-horizon',
      'scripted-price',
    ]) {
      const corrupt = structuredClone(result.recording);
      if (kind === 'model-label') corrupt.kind = 'llm';
      if (kind === 'paid-usage') corrupt.generation!.requests[0]!.estimatedUsd = 1;
      if (kind === 'completed-match') corrupt.generation!.status = 'complete';
      if (kind === 'invalid-horizon') corrupt.generation!.limits.maximumPlayingTicks = NaN;
      if (kind === 'mismatched-horizon') corrupt.generation!.limits.maximumPlayingTicks = 481;
      if (kind === 'scripted-price')
        Object.assign(corrupt.generation!.controllers.coral, { inputUsdPerMillion: 1 });
      expect(() => parseRecording(corrupt)).toThrow();
    }
  });
});
