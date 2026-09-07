import { describe, expect, it } from 'vitest';
import { decideTogether, DEFAULT_LIMITS, generateMatch } from '../src/generation/run.ts';
import { ProviderError, openaiController, geminiController } from '../src/generation/providers.ts';
import type { TeamController, ControllerRequest } from '../src/generation/providers.ts';
import type { GenerationProvenance } from '../src/recording/provenance.ts';
import { verifyRecording, stateHash } from '../src/recording/record.ts';
import { observe, rulebook } from '../src/protocol/observation.ts';
import { parseModelDecision } from '../src/protocol/schema.ts';
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
function response(request: ControllerRequest) {
  const observation = JSON.parse(request.observation) as ReturnType<typeof observe>;
  return {
    batch: { ...observation.responseIdentity, orders: [] },
    memory: 'private plan',
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
  it('exposes public state, owned orders and bounded events without opponent orders or random state', () => {
    const state = createMatch();
    state.players[0]!.active = {
      order: { type: 'hold', playerId: state.players[0]!.id },
      issued: 0,
      expires: 60,
    };
    const coral = observe(state, 'coral', 'coral notebook', 60);
    const cyan = observe(state, 'cyan', 'cyan notebook', 60);
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
    expect(JSON.stringify(coral)).not.toContain('cyan notebook');
    expect(coral.ball).toEqual(cyan.ball);
  });

  it('rejects invalid ownership, non-finite actions, oversized memory and stale identities', () => {
    const state = createMatch();
    const valid = { batch: emptyBatch(state, 'coral'), memory: '', intent: '' };
    for (const raw of [
      { ...valid, memory: 'x'.repeat(501) },
      { ...valid, batch: { ...valid.batch, tick: 1 } },
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
        return calls.cyan.length === 1 ? { broken: true } : response(request);
      }),
    };
    const record = provenance(controllers);
    const pending = decideTogether(
      state,
      controllers,
      { coral: 'secret coral', cyan: 'secret cyan' },
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
    expect(calls.cyan[1]!.feedback).toContain('Invalid response');
    expect(result.fallback).toEqual([]);
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
      { coral: '', cyan: '' },
      record,
      new AbortController().signal,
    );
    expect(record.requests).toHaveLength(4);
    expect(result.fallback).toEqual(['coral', 'cyan']);
    expect(result.decisions.every((decision) => decision.batch.orders.length === 0)).toBe(true);
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

  it('checkpoints and replay-verifies a bounded run, never labelling the cap full time', async () => {
    const controller = mockController(response);
    const recording = await generateMatch({
      matchId: 'bounded-run',
      controllers: { coral: controller, cyan: controller },
      limits: { ...DEFAULT_LIMITS, maximumDecisions: 2 },
    });
    expect(recording.decisions).toHaveLength(2);
    expect(recording.generation).toMatchObject({
      status: 'incomplete',
      stopReason: 'decision_limit',
    });
    expect(recording.decisions[0]!.observations?.coral).toContain('privateMemory');
    expect(verifyRecording(recording).phase.type).toBe('restart_ready');
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
