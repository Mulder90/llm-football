import { describe, expect, it } from 'vitest';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { DEFAULT_LIMITS } from '../src/generation/run.ts';
import { observe } from '../src/protocol/observation.ts';
import { rulebook } from '../src/protocol/rulebook.ts';
import {
  PROTOCOL_LIMITS,
  RESPONSE_JSON_SCHEMA,
  tacticalMemorySchema,
  validateTacticalMemory,
} from '../src/protocol/schema.ts';
import type { TacticalMemory } from '../src/protocol/schema.ts';
import { stateHash, verifyRecording } from '../src/recording/record.ts';
import { applyDecision, emptyBatch, validateBatch } from '../src/sim/orders.ts';
import { FIELD, MATCH_TIMING, TICK_RATE } from '../src/sim/rules.ts';
import { cloneState, createMatch, resetFormation } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { MatchState, Team } from '../src/sim/types.ts';

function populatedMemory(state: MatchState, team: Team): TacticalMemory {
  const teammates = state.players.filter((player) => player.team === team && !player.dismissed);
  const opponents = state.players.filter((player) => player.team !== team && !player.dismissed);
  return {
    plan: 'p'.repeat(PROTOCOL_LIMITS.planCharacters),
    ballPlayerId: teammates[0]!.id,
    pass: { receiverId: teammates[1]!.id, target: { x: FIELD.length, y: FIELD.width } },
    assignments: teammates.slice(1).map((player, index) => ({
      playerId: player.id,
      role: 'support',
      opponentId: opponents[index % opponents.length]!.id,
    })),
    threats: opponents.slice(0, PROTOCOL_LIMITS.opponentThreats).map((player) => ({
      opponentId: player.id,
      concern: 't'.repeat(PROTOCOL_LIMITS.threatCharacters),
    })),
    review: 'r'.repeat(PROTOCOL_LIMITS.reviewCharacters),
  };
}

describe('starting positional briefs', () => {
  it('keeps the actual 4–3–3 roles while left/right and goal direction change with ends', () => {
    const state = createMatch();
    const expectedRoles = [
      'goalkeeper',
      'fullback',
      'centre_back',
      'centre_back',
      'fullback',
      'central_midfielder',
      'holding_midfielder',
      'central_midfielder',
      'winger',
      'striker',
      'winger',
    ];
    for (const half of [1, 2] as const) {
      state.half = half;
      resetFormation(state);
      for (const team of ['coral', 'cyan'] as const) {
        const snapshot = observe(state, team, null, TICK_RATE);
        const own = snapshot.players.filter((player) => player.team === team);
        expect(snapshot.teamContext.keeperId).toBe(`${team}-1`);
        expect(own.map((player) => player.startingPosition!.role)).toEqual(expectedRoles);
        expect(snapshot.teamContext.positioning.startingShape).toBe('4-3-3');
        expect(Object.keys(snapshot.teamContext.positioning.briefs)).toHaveLength(7);
        const { leftTouchlineY, rightTouchlineY } = snapshot.teamContext.positioning;
        expect(leftTouchlineY).toBe(snapshot.attackDirection === 1 ? 0 : FIELD.width);
        expect(rightTouchlineY).toBe(FIELD.width - leftTouchlineY);
        expect(snapshot.teamContext.ownGoal.x).toBe(
          snapshot.attackDirection === 1 ? 0 : FIELD.length,
        );
        for (const player of own) {
          const { role, side } = player.startingPosition!;
          expect(snapshot.teamContext.positioning.briefs[role]).toBeTruthy();
          if (side === 'left')
            expect(Math.abs(player.position.y - leftTouchlineY)).toBeLessThan(FIELD.width / 2);
          if (side === 'right')
            expect(Math.abs(player.position.y - rightTouchlineY)).toBeLessThan(FIELD.width / 2);
        }
      }
    }
  });

  it('reports no available keeper after dismissal without naming an outfield replacement', () => {
    const state = createMatch();
    state.players.find((player) => player.id === 'coral-1')!.dismissed = true;
    const before = stateHash(state);
    expect(observe(state, 'coral', null, TICK_RATE).teamContext.keeperId).toBeNull();
    expect(observe(state, 'cyan', null, TICK_RATE).teamContext.keeperId).toBe('cyan-1');
    expect(stateHash(state)).toBe(before);
  });

  it('does not confuse a temporary marking job or moved player with the starting role', () => {
    const state = createMatch();
    const centreBack = state.players.find((player) => player.id === 'coral-3')!;
    centreBack.position = { x: 90, y: 35 };
    const memory = populatedMemory(state, 'coral');
    memory.assignments.find((assignment) => assignment.playerId === centreBack.id)!.role = 'mark';
    const before = stateHash(state);
    const snapshot = observe(state, 'coral', memory, TICK_RATE);
    const observed = snapshot.players.find((player) => player.id === centreBack.id)!;
    expect(observed.role).toBe('outfield');
    expect(observed.startingPosition).toEqual({ role: 'centre_back', side: 'left' });
    expect(
      snapshot.privateMemory!.assignments.find(
        (assignment) => assignment.playerId === centreBack.id,
      )!.role,
    ).toBe('mark');
    expect(observed.currentOrder).toBeNull();
    expect(stateHash(state)).toBe(before);
    expect(() =>
      validateBatch(
        {
          ...emptyBatch(state, 'coral'),
          orders: [{ type: 'guard', playerId: centreBack.id, target: { x: 5, y: 34 } }],
        },
        state,
        'coral',
      ),
    ).toThrow('Only keepers');
  });

  it('exposes own responsibilities without opponent plans or shared mutable metadata', () => {
    const state = createMatch();
    const snapshot = observe(state, 'coral', null, TICK_RATE);
    for (const player of snapshot.players.filter((player) => player.team === 'cyan')) {
      expect(player).not.toHaveProperty('startingPosition');
      expect(player).not.toHaveProperty('currentOrder');
    }
    snapshot.players.find((player) => player.id === 'coral-2')!.startingPosition!.side = 'right';
    delete (
      snapshot.teamContext.positioning.briefs as Partial<
        typeof snapshot.teamContext.positioning.briefs
      >
    ).fullback;
    const next = observe(state, 'coral', null, TICK_RATE);
    expect(next.players.find((player) => player.id === 'coral-2')!.startingPosition!.side).toBe(
      'left',
    );
    expect(next.teamContext.positioning.briefs.fullback).toBeTruthy();
  });

  it('rounds copied order targets like public geometry while accepted orders stay exact', () => {
    const state = createMatch();
    const target = { x: 73.12345678901235, y: 32.123456789012344 };
    const pace = 0.987654321098765;
    const [accepted] = applyDecision(
      state,
      {
        ...emptyBatch(state, 'coral'),
        orders: [
          { type: 'move', playerId: 'coral-2', target, pace },
          { type: 'guard', playerId: 'coral-1', target },
        ],
      },
      emptyBatch(state, 'cyan'),
    );
    const canonicalOrders = structuredClone(accepted.orders);
    const before = stateHash(state);
    const snapshot = observe(state, 'coral', null, TICK_RATE);
    for (const playerId of ['coral-1', 'coral-2']) {
      const order = snapshot.players.find((player) => player.id === playerId)!.currentOrder!.order;
      expect(order).toHaveProperty('target', { x: 73.12, y: 32.12 });
      if (order.type === 'move') expect(order.pace).toBe(pace);
      if ('target' in order) order.target.x = 0;
    }
    expect(accepted.orders).toEqual(canonicalOrders);
    expect(stateHash(state)).toBe(before);
  });

  it.each(['é', '界', '\u0000'])(
    'fits full UTF-8/JSON-escaped memory (%j), precise orders and bounded feedback without trimming',
    (character) => {
      const state = createMatch('m'.repeat(100));
      state.phase = { type: 'open_play', sinceTick: 4300 };
      state.half = 2;
      state.tick = 4321;
      state.halfPlayingTicks = 700;
      state.playingTicks = MATCH_TIMING.halfPlayingTicks + state.halfPlayingTicks;
      state.decisionId = 123;
      // A busy boundary: all active orders, long numeric representations, and both feedback lists full.
      for (const player of state.players) {
        player.position.x += 0.1299999999;
        player.position.y += 0.1399999999;
        player.velocity = { x: -4.321, y: 3.211 };
        player.facing = { x: -0.8026380845445913, y: 0.5964663476875285 };
      }
      const batches = (['coral', 'cyan'] as const).map((team) => ({
        ...emptyBatch(state, team),
        orders: state.players
          .filter((player) => player.team === team)
          .map((player) => ({
            type: 'move' as const,
            playerId: player.id,
            target: { x: 73.12345678901235, y: 32.123456789012344 },
            pace: 0.987654321098765,
          })),
      }));
      applyDecision(state, batches[0], batches[1]);
      state.events = Array.from({ length: PROTOCOL_LIMITS.recentEvents }, (_, index) => ({
        id: index + 1000,
        tick: 4311 + (index % 10),
        type: 'order_failed',
        playerId: `coral-${(index % 11) + 1}`,
        detail: 'Kick requires foot possession; use distribute or put_down from hands',
        team: 'coral',
      }));
      const memory = populatedMemory(state, 'coral');
      memory.plan = character.repeat(PROTOCOL_LIMITS.planCharacters);
      memory.review = character.repeat(PROTOCOL_LIMITS.reviewCharacters);
      for (const threat of memory.threats)
        threat.concern = character.repeat(PROTOCOL_LIMITS.threatCharacters);
      memory.pass!.target = { x: 75.12345678901235, y: 33.123456789012344 };
      tacticalMemorySchema.parse(memory);
      validateTacticalMemory(memory, state.players, 'coral');
      const snapshot = observe(
        state,
        'coral',
        memory,
        TICK_RATE,
        4310,
        2 * MATCH_TIMING.halfPlayingTicks,
      );
      const serialized = JSON.stringify(snapshot);
      expect(JSON.parse(serialized).privateMemory).toEqual(memory);
      expect(snapshot.orderFeedback).toHaveLength(PROTOCOL_LIMITS.recentEvents);
      const bytes =
        Buffer.byteLength(rulebook() + serialized + JSON.stringify(RESPONSE_JSON_SCHEMA)) + 1024;
      expect(bytes).toBeLessThanOrEqual(DEFAULT_LIMITS.maximumInputBytes);
    },
  );

  it('fits complete requests throughout both halves with full memory and preserves independent replay', () => {
    const recording = createFullMatchFixture();
    const state = cloneState(recording.initial);
    let decisionIndex = 0;
    let maximumBytes = 0;
    const halves = new Set<number>();
    while (state.tick < recording.durationTicks) {
      const decision = recording.decisions[decisionIndex];
      if (decision?.tick === state.tick) {
        halves.add(state.half);
        for (const team of ['coral', 'cyan'] as const) {
          const snapshot = observe(state, team, populatedMemory(state, team), TICK_RATE);
          maximumBytes = Math.max(
            maximumBytes,
            Buffer.byteLength(
              rulebook() + JSON.stringify(snapshot) + JSON.stringify(RESPONSE_JSON_SCHEMA),
            ) + 1024,
          );
        }
        applyDecision(state, ...decision.batches);
        decisionIndex++;
      }
      step(state);
    }
    expect(halves).toEqual(new Set([1, 2]));
    expect(maximumBytes).toBeLessThan(DEFAULT_LIMITS.maximumInputBytes);
    expect(stateHash(state)).toBe(recording.finalHash);
    expect(stateHash(verifyRecording(recording))).toBe(recording.finalHash);
  });
});
