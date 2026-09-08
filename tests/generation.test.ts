import { describe, expect, it } from 'vitest';
import { decideTogether, DEFAULT_LIMITS, generateMatch } from '../src/generation/run.ts';
import { generationProviderUsd } from '../src/generation/budget.ts';
import { ProviderError, openaiController, geminiController } from '../src/generation/providers.ts';
import type { TeamController, ControllerRequest } from '../src/generation/providers.ts';
import type { GenerationProvenance } from '../src/recording/provenance.ts';
import { verifyRecording, stateHash } from '../src/recording/record.ts';
import { parseRecording } from '../src/recording/validate.ts';
import { observe } from '../src/protocol/observation.ts';
import { rulebook } from '../src/protocol/rulebook.ts';
import {
  modelResponseSchema,
  parseModelDecision,
  RESPONSE_JSON_SCHEMA,
} from '../src/protocol/schema.ts';
import { z } from 'zod';
import type { TacticalMemory } from '../src/protocol/schema.ts';
import { createMatch } from '../src/sim/state.ts';
import { emptyBatch } from '../src/sim/orders.ts';
import type { Team } from '../src/sim/types.ts';

function mockController(
  reply: (request: ControllerRequest) => Promise<unknown> | unknown,
): TeamController {
  return {
    config: {
      provider: 'openai',
      model: 'offline-test',
      settings: {},
      inputUsdPerMillion: 0.05,
      outputUsdPerMillion: 0.4,
    },
    async request(request) {
      return {
        text: JSON.stringify(await reply(request)),
        responseId: 'test-response',
        resolvedModel: 'offline-test',
        usage: { inputTokens: 100, outputTokens: 100, reasoningTokens: 0, cachedInputTokens: 0 },
      };
    },
  };
}
function memory(team: Team, plan = `${team} private plan`): TacticalMemory {
  return {
    plan,
    ballPlayerId: `${team}-7`,
    pass: { receiverId: `${team}-9`, target: { x: 52, y: 16 } },
    assignments: [{ playerId: `${team}-11`, role: 'width', opponentId: null }],
    threats: [],
    review: '',
  };
}
function response(request: ControllerRequest) {
  const observation = JSON.parse(request.observation) as ReturnType<typeof observe>;
  return {
    batch: { ...observation.responseIdentity, orders: [] },
    memory: memory(observation.responseIdentity.team),
    intent: 'Hold this shape',
  };
}
function provenance(controllers: Record<Team, TeamController>): GenerationProvenance {
  return {
    protocolVersion: 1,
    rulebook: rulebook(),
    controllers: { coral: controllers.coral.config, cyan: controllers.cyan.config },
    limits: { ...DEFAULT_LIMITS },
    status: 'running',
    stopReason: null,
    wallSeconds: 0,
    requests: [],
    estimatedUsd: 0,
  };
}

describe('shared model protocol', () => {
  it('rejects the malformed keeper replies observed in the paired trials', () => {
    const state = createMatch();
    const reply = (orders: unknown[]) => ({
      batch: { ...emptyBatch(state, 'coral'), orders },
      memory: memory('coral'),
      intent: '',
    });
    const guard = { type: 'guard', playerId: 'coral-1', target: { x: 8, y: 34 } };
    expect(parseModelDecision(reply([guard]), state, 'coral').batch.orders).toEqual([guard]);
    expect(() =>
      parseModelDecision(reply([{ ...guard, playerId: 'coral-3' }]), state, 'coral'),
    ).toThrow(
      'Only keepers may guard; coral-3 is outfield. Defend with move (target + pace) or hold.',
    );
    expect(() =>
      parseModelDecision(reply([guard, { ...guard, type: 'move' }]), state, 'coral'),
    ).toThrow('batch.orders.1.pace');
    expect(() =>
      parseModelDecision(reply([guard, { ...guard, type: 'move', pace: 1 }]), state, 'coral'),
    ).toThrow('Duplicate player');
  });

  it.each([
    [{ type: 'guard', pace: 1, target: { x: 8, y: 34 } }, 'Unrecognized key: "pace"'],
    [{ type: 'move', pace: 1, target: { x: NaN, y: 34 } }, 'batch.orders.0.target.x'],
    [{ type: 'move', pace: 2, target: { x: 8, y: 34 } }, 'batch.orders.0.pace'],
    [{ type: 'invented_action' }, 'batch.orders.0: Invalid input'],
  ])('reports the recognized action’s invalid field without accepting it (%j)', (order, error) => {
    const state = createMatch();
    const raw = {
      batch: { ...emptyBatch(state, 'coral'), orders: [{ ...order, playerId: 'coral-1' }] },
      memory: memory('coral'),
      intent: '',
    };
    const before = structuredClone(raw);
    expect(() => parseModelDecision(raw, state, 'coral')).toThrow(error);
    expect(raw).toEqual(before);
  });

  it('omits only the problematic provider orders cap while rejecting excess orders locally', () => {
    const strictWire = z.toJSONSchema(modelResponseSchema, { target: 'draft-7' });
    const expected = structuredClone(strictWire);
    const batch = expected.properties!.batch as z.core.JSONSchema.BaseSchema;
    const orders = batch.properties!.orders as z.core.JSONSchema.BaseSchema;
    expect(orders.maxItems).toBe(11);
    delete orders.maxItems;
    expect(RESPONSE_JSON_SCHEMA).toEqual(expected);

    const state = createMatch();
    const fullRoster = state.players
      .filter((player) => player.team === 'coral')
      .map((player) => ({ type: 'hold', playerId: player.id }));
    const valid = {
      batch: { ...emptyBatch(state, 'coral'), orders: fullRoster },
      memory: memory('coral'),
      intent: '',
    };
    expect(parseModelDecision(valid, state, 'coral').batch.orders).toHaveLength(11);
    const tooMany = { ...valid, batch: { ...valid.batch, orders: [...fullRoster, fullRoster[0]] } };
    const rejected = modelResponseSchema.safeParse(tooMany);
    expect(rejected.success).toBe(false);
    if (!rejected.success)
      expect(rejected.error.issues[0]).toMatchObject({
        code: 'too_big',
        path: ['batch', 'orders'],
        maximum: 11,
      });
    expect(() => parseModelDecision(tooMany, state, 'coral')).toThrow('batch.orders');
  });

  it('exposes public state, owned orders and bounded events without opponent orders or random state', () => {
    const state = createMatch();
    state.players[0]!.active = {
      order: { type: 'hold', playerId: state.players[0]!.id },
      issued: 0,
      expires: 60,
    };
    const coral = observe(state, 'coral', memory('coral'), 60);
    const cyan = observe(state, 'cyan', memory('cyan'), 60);
    expect(coral.responseIdentity).toEqual({
      version: 1,
      matchId: state.matchId,
      decisionId: 0,
      tick: 0,
      team: 'coral',
    });
    expect(coral.players).toHaveLength(22);
    expect(coral.players.find((player) => player.id === state.players[0]!.id)).toHaveProperty(
      'currentOrder',
    );
    expect(cyan.players.find((player) => player.id === state.players[0]!.id)).not.toHaveProperty(
      'currentOrder',
    );
    expect(coral).not.toHaveProperty('seed');
    expect(coral.privateMemory).toEqual(memory('coral'));
    expect(cyan.privateMemory).toEqual(memory('cyan'));
    expect(JSON.stringify(coral)).not.toContain('cyan private plan');
    expect(coral.ball).toEqual(cyan.ball);
  });

  it('rejects invalid ownership, non-finite actions and stale identities', () => {
    const state = createMatch();
    const valid = { batch: emptyBatch(state, 'coral'), memory: memory('coral'), intent: '' };
    expect(() => parseModelDecision(valid, state, 'coral')).not.toThrow();
    for (const raw of [
      { ...valid, batch: { ...valid.batch, tick: 1 } },
      { ...valid, batch: { ...valid.batch, decisionId: 1 } },
      { ...valid, batch: { ...valid.batch, matchId: 'another-match' } },
      { ...valid, batch: { ...valid.batch, team: 'cyan' } },
      { ...valid, batch: { ...valid.batch, version: 2 } },
      { ...valid, batch: { ...valid.batch, orders: [{ type: 'hold', playerId: 'cyan-2' }] } },
      {
        ...valid,
        batch: {
          ...valid.batch,
          orders: [{ type: 'move', playerId: 'coral-2', target: { x: NaN, y: 4 }, pace: 1 }],
        },
      },
    ])
      expect(() => parseModelDecision(raw, state, 'coral')).toThrow();
  });

  it('reuses one provider schema across changing identities while rejecting stale replies', async () => {
    const seen: ControllerRequest[] = [];
    const controller = mockController((request) => {
      seen.push(request);
      return response(request);
    });
    const recording = await generateMatch({
      matchId: 'stable-schema',
      controllers: { coral: controller, cyan: controller },
      limits: { ...DEFAULT_LIMITS, maximumDecisions: 3 },
    });
    expect(seen).toHaveLength(6);
    expect(new Set(seen.map((request) => JSON.stringify(request.responseSchema))).size).toBe(1);
    expect(recording.generation!.responseSchema).toBe(JSON.stringify(seen[0]!.responseSchema));
    const identities = seen.map((request) => JSON.parse(request.observation).responseIdentity);
    expect(new Set(identities.map((identity) => identity.tick)).size).toBe(3);
    expect(new Set(identities.map((identity) => identity.team)).size).toBe(2);
    const state = createMatch('stable-schema');
    const stale = response(seen[0]!);
    state.tick++;
    expect(() => parseModelDecision(stale, state, 'coral')).toThrow('stale');
  });

  it('keeps acquisition and restart decisions but lets a released ball travel until the heartbeat', async () => {
    const controller = mockController((request) => {
      const observation = JSON.parse(request.observation) as ReturnType<typeof observe>;
      const reply = response(request);
      const carrier = observation.players.find((player) => player.actionContext?.canKickNow);
      if (!carrier) return reply;
      const restarting = observation.phase.type === 'restart_ready';
      return {
        ...reply,
        batch: {
          ...reply.batch,
          orders: [
            {
              type: 'kick',
              playerId: carrier.id,
              target: { x: restarting ? 40 : 80, y: 34 },
              speed: restarting ? 8 : 10,
              loft: restarting ? 0 : 8,
            },
          ],
        },
      };
    });
    const recording = await generateMatch({
      matchId: 'pass-flight-cadence',
      controllers: { coral: controller, cyan: controller },
      limits: { ...DEFAULT_LIMITS, maximumDecisions: 9 },
    });
    const observations = recording.decisions.map(
      (decision) => JSON.parse(decision.observations!.coral) as ReturnType<typeof observe>,
    );
    const acquisition = observations.findIndex(
      (observation) =>
        observation.phase.type === 'open_play' && observation.ball.owner === 'coral-7',
    );
    expect(acquisition).toBeGreaterThan(0);
    const received = observations[acquisition]!;
    expect(
      received.responseIdentity.tick - observations[acquisition - 1]!.responseIdentity.tick,
    ).toBeLessThan(60);
    const afterRelease = observations[acquisition + 1]!;
    expect(afterRelease.responseIdentity.tick - received.responseIdentity.tick).toBe(60);
    expect(afterRelease.ball.owner).toBeNull();
    expect(afterRelease.ball.position.z).toBeGreaterThan(1);
    expect(observations.some((observation) => observation.phase.type === 'restart_ready')).toBe(
      true,
    );
    expect(verifyRecording(recording).tick).toBe(recording.durationTicks);
  });

  it('locks an accepted reply while repairing only the rejected team on the same unchanged snapshot', async () => {
    const state = createMatch();
    const before = stateHash(state);
    const calls: Record<Team, ControllerRequest[]> = { coral: [], cyan: [] };
    let releaseCyan!: () => void;
    const cyanGate = new Promise<void>((resolve) => {
      releaseCyan = resolve;
    });
    const controllers = {
      coral: mockController((request) => {
        calls.coral.push(request);
        return response(request);
      }),
      cyan: mockController(async (request) => {
        calls.cyan.push(request);
        await cyanGate;
        const valid = response(request);
        return calls.cyan.length === 1
          ? {
              ...valid,
              batch: {
                ...valid.batch,
                orders: [{ type: 'move', playerId: 'cyan-1', target: { x: 98, y: 34 } }],
              },
            }
          : valid;
      }),
    };
    const record = provenance(controllers);
    const pending = decideTogether(
      state,
      controllers,
      { coral: memory('coral', 'prior coral plan'), cyan: memory('cyan', 'prior cyan plan') },
      record,
      new AbortController().signal,
    );
    await Promise.resolve();
    expect(calls.coral).toHaveLength(1);
    expect(calls.cyan).toHaveLength(1);
    expect(stateHash(state)).toBe(before);
    releaseCyan();
    const result = await pending;
    expect(calls.coral).toHaveLength(1);
    expect(calls.cyan).toHaveLength(2);
    expect(calls.cyan[0]!.observation).toBe(calls.cyan[1]!.observation);
    expect(calls.cyan[1]!.feedback).toContain('batch.orders.0.pace');
    expect(result.fallback).toEqual([]);
    expect(result.decisions.map((decision) => decision.memory)).toEqual([
      memory('coral'),
      memory('cyan'),
    ]);
    expect(record.requests.map((receipt) => receipt.status)).toEqual([
      'accepted',
      'rejected',
      'accepted',
    ]);
    expect(stateHash(state)).toBe(before);
  });

  it('records neutral continuation after bounded failures without inventing tactics', async () => {
    const bad = mockController(() => ({}));
    const controllers = { coral: bad, cyan: bad };
    const record = provenance(controllers);
    const result = await decideTogether(
      createMatch(),
      controllers,
      { coral: memory('coral'), cyan: null },
      record,
      new AbortController().signal,
    );
    expect(record.requests).toHaveLength(4);
    expect(result.fallback).toEqual(['coral', 'cyan']);
    expect(result.decisions.every((decision) => decision.batch.orders.length === 0)).toBe(true);
    expect(result.decisions.map((decision) => decision.memory)).toEqual([memory('coral'), null]);
  });

  it('reserves the entire paired boundary and retries before issuing any paid request', async () => {
    let calls = 0;
    const controller = mockController((request) => {
      calls++;
      return response(request);
    });
    const recording = await generateMatch({
      matchId: 'no-budget',
      controllers: { coral: controller, cyan: controller },
      limits: { ...DEFAULT_LIMITS, maximumEstimatedUsd: 0.00001 },
    });
    expect(calls).toBe(0);
    expect(recording.generation).toMatchObject({
      status: 'incomplete',
      stopReason: 'estimated_cost_limit',
    });
    expect(verifyRecording(recording).tick).toBe(0);
  });

  it.each(['openai', 'gemini'] as const)(
    'starts neither team when %s cannot fund its repair allowance',
    async (provider) => {
      let calls = 0;
      const controller = mockController((request) => {
        calls++;
        return response(request);
      });
      const recording = await generateMatch({
        matchId: 'provider-budget',
        controllers: {
          coral: controller,
          cyan: { ...controller, config: { ...controller.config, provider: 'gemini' } },
        },
        limits: {
          ...DEFAULT_LIMITS,
          maximumEstimatedUsd: 1,
          // One request costs $0.0032768 at this mock's rates: enough for it, not its repair.
          maximumEstimatedUsdByProvider: { [provider]: 0.004 },
        },
      });
      expect(calls).toBe(0);
      expect(recording.generation!.stopReason).toBe(`${provider}_estimated_cost_limit`);
      expect(generationProviderUsd(recording.generation!)).toEqual({ openai: 0, gemini: 0 });
      expect(verifyRecording(recording).tick).toBe(0);
    },
  );

  it('charges unreported repairs to their providers, then checkpoints before an unaffordable pair', async () => {
    const calls: Record<Team, number> = { coral: 0, cyan: 0 };
    const controller = mockController((request) => {
      const { team } = JSON.parse(request.observation).responseIdentity as { team: Team };
      calls[team]++;
      return request.feedback ? response(request) : { invalid: true };
    });
    const unreported: TeamController = {
      ...controller,
      async request(request, signal) {
        return { ...(await controller.request(request, signal)), usage: null };
      },
    };
    const checkpoints: { status: string; decisions: number; usd: number }[] = [];
    const recording = await generateMatch({
      matchId: 'spent-provider-budget',
      controllers: {
        coral: unreported,
        cyan: { ...unreported, config: { ...unreported.config, provider: 'gemini' } },
      },
      limits: {
        ...DEFAULT_LIMITS,
        maximumEstimatedUsd: 1,
        maximumEstimatedUsdByProvider: { openai: 1, gemini: 0.0066 },
      },
      async onCheckpoint(recording) {
        checkpoints.push({
          status: recording.generation!.status,
          decisions: recording.decisions.length,
          usd: generationProviderUsd(recording.generation!).gemini,
        });
      },
    });
    expect(calls).toEqual({ coral: 2, cyan: 2 });
    expect(recording.decisions).toHaveLength(1);
    expect(recording.generation!.stopReason).toBe('gemini_estimated_cost_limit');
    const spent = generationProviderUsd(recording.generation!);
    expect(spent.openai).toBeCloseTo(0.0065536, 10);
    expect(spent.gemini).toBeCloseTo(0.0065536, 10);
    expect(checkpoints.at(-1)).toMatchObject({ status: 'incomplete', decisions: 1 });
    expect(checkpoints.at(-1)!.usd).toBeCloseTo(0.0065536, 10);
    const imported = parseRecording(JSON.parse(JSON.stringify(recording)));
    expect(imported.generation!.limits.maximumEstimatedUsdByProvider).toEqual({
      openai: 1,
      gemini: 0.0066,
    });
    expect(verifyRecording(imported).tick).toBeGreaterThan(0);
    for (const invalid of [-1, Infinity, NaN]) {
      const corrupt = structuredClone(recording);
      corrupt.generation!.limits.maximumEstimatedUsdByProvider!.gemini = invalid;
      expect(() => parseRecording(corrupt)).toThrow();
    }
  });

  it('retains each cancelled in-flight request reservation without committing either team', async () => {
    const abort = new AbortController();
    let calls = 0;
    const controller = mockController(() => ({}));
    const cancelled: TeamController = {
      ...controller,
      async request(_request, signal) {
        calls++;
        await Promise.resolve(); // Both teams must be in flight before cancellation.
        abort.abort();
        signal.throwIfAborted();
        throw new Error('unreachable');
      },
    };
    const recording = await generateMatch({
      matchId: 'cancelled-budget',
      controllers: {
        coral: cancelled,
        cyan: { ...cancelled, config: { ...cancelled.config, provider: 'gemini' } },
      },
      limits: { ...DEFAULT_LIMITS },
      signal: abort.signal,
    });
    expect(calls).toBe(2);
    expect(recording.decisions).toHaveLength(0);
    expect(recording.generation!.stopReason).toBe('cancelled_or_wall_time_limit');
    const spent = generationProviderUsd(recording.generation!);
    expect(spent.openai).toBeCloseTo(0.0032768, 10);
    expect(spent.gemini).toBeCloseTo(0.0032768, 10);
    expect(verifyRecording(recording).tick).toBe(0);
  });

  it('carries only each team’s accepted memory through repairs and fallbacks in a replayable bounded run', async () => {
    const requests: Record<Team, ControllerRequest[]> = { coral: [], cyan: [] };
    const controller = mockController((request) => {
      const observation = JSON.parse(request.observation) as ReturnType<typeof observe>;
      const { team, decisionId } = observation.responseIdentity;
      requests[team].push(request);
      const reply = { ...response(request), memory: memory(team, `${team} plan ${decisionId}`) };
      if (decisionId === 1 && (team === 'cyan' || !request.feedback))
        return {
          ...reply,
          memory: { ...reply.memory, ballPlayerId: team === 'coral' ? 'cyan-7' : 'coral-7' },
        };
      return reply;
    });
    const recording = await generateMatch({
      matchId: 'bounded-run',
      controllers: { coral: controller, cyan: controller },
      limits: { ...DEFAULT_LIMITS, maximumDecisions: 3 },
    });
    expect(recording.decisions).toHaveLength(3);
    expect(recording.generation).toMatchObject({
      status: 'incomplete',
      stopReason: 'decision_limit',
    });
    for (const team of ['coral', 'cyan'] as const) {
      const observations = requests[team].map(
        (request) => JSON.parse(request.observation) as ReturnType<typeof observe>,
      );
      expect(observations.map((observation) => observation.privateMemory?.plan ?? null)).toEqual([
        null,
        `${team} plan 0`,
        `${team} plan 0`,
        `${team} plan ${team === 'coral' ? 1 : 0}`,
      ]);
      expect(requests[team][1]!.observation).toBe(requests[team][2]!.observation);
      expect(
        requests[team].every(
          (request) => !request.observation.includes(`${team === 'coral' ? 'cyan' : 'coral'} plan`),
        ),
      ).toBe(true);
    }
    expect(recording.decisions[1]!.fallback).toEqual(['cyan']);
    expect(recording.decisions[1]!.notes?.coral.memory).toEqual(memory('coral', 'coral plan 1'));
    expect(recording.decisions[1]!.notes?.cyan.memory).toEqual(memory('cyan', 'cyan plan 0'));
    const imported = parseRecording(JSON.parse(JSON.stringify(recording)));
    expect(imported.decisions[1]!.notes).toEqual(recording.decisions[1]!.notes);
    expect(verifyRecording(imported).phase.type).toBe('restart_ready');
    expect(recording.generation!.estimatedUsd).toBeGreaterThan(0);
  });

  it('stops on permanent provider failure and conservatively charges missing usage', async () => {
    const controller = mockController(() => {
      throw new ProviderError('http_401', false);
    });
    const recording = await generateMatch({
      matchId: 'no-access',
      controllers: { coral: controller, cyan: controller },
      limits: { ...DEFAULT_LIMITS },
    });
    expect(recording.generation!.requests).toHaveLength(2);
    expect(recording.generation).toMatchObject({
      status: 'incomplete',
      stopReason: 'provider_unavailable',
    });
    expect(recording.generation!.estimatedUsd).toBeGreaterThan(0);
    expect(recording.decisions).toHaveLength(0);
  });

  it('fails closed for unreviewed model prices instead of silently upgrading', () => {
    expect(() => openaiController('unused', 'unknown')).toThrow('price');
    expect(() => geminiController('unused', 'unknown')).toThrow('price');
  });
});
