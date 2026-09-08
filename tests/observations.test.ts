import { describe, expect, it } from 'vitest';
import { observe } from '../src/protocol/observation.ts';
import { rulebook } from '../src/protocol/rulebook.ts';
import type { TacticalMemory } from '../src/protocol/schema.ts';
import { RESPONSE_JSON_SCHEMA, PROTOCOL_LIMITS } from '../src/protocol/schema.ts';
import { DEFAULT_LIMITS } from '../src/generation/run.ts';
import { createMatch } from '../src/sim/state.ts';
import { stateHash } from '../src/recording/record.ts';
import { BALL_CONTROL, TACKLE } from '../src/sim/rules.ts';
import { awardRestart, prepareRestartDelivery } from '../src/sim/restarts.ts';

describe('team observations', () => {
  it('exposes opponent motion and owned spacing without choosing tactical targets or sharing memory references', () => {
    const state = createMatch();
    const first = state.players.find((player) => player.id === 'coral-2')!;
    const second = state.players.find((player) => player.id === 'coral-3')!;
    first.position = { x: 10, y: 10 };
    second.position = { x: 11, y: 10 };
    const opponent = state.players.find((player) => player.id === 'cyan-9')!;
    opponent.velocity = { x: -3, y: 2 };
    const memory: TacticalMemory = {
      plan: 'Keep width',
      ballPlayerId: 'coral-7',
      pass: null,
      assignments: [{ playerId: 'coral-2', role: 'width', opponentId: null }],
      threats: [{ opponentId: 'cyan-9', concern: 'Running toward our left goal' }],
      review: 'Unresolved',
    };
    const before = stateHash(state);
    const observation = observe(state, 'coral', memory, 60);
    expect(
      observation.players.find((player) => player.id === first.id)?.actionContext?.nearestTeammate,
    ).toEqual({ playerId: second.id, distance: 1 });
    expect(observation.players.find((player) => player.id === opponent.id)).toMatchObject({
      position: opponent.position,
      velocity: opponent.velocity,
    });
    expect(observation.players.find((player) => player.id === opponent.id)).not.toHaveProperty(
      'currentOrder',
    );
    expect(observation.privateMemory).toEqual(memory);
    observation.privateMemory!.assignments[0]!.role = 'cover';
    expect(memory.assignments[0]!.role).toBe('width');
    expect(stateHash(state)).toBe(before);
    second.dismissed = true;
    expect(
      observe(state, 'coral', memory, 60).players.find((player) => player.id === first.id)
        ?.actionContext?.nearestTeammate?.playerId,
    ).not.toBe(second.id);
  });

  it('identifies both rosters and swaps the explicit goals for both teams at halftime', () => {
    const state = createMatch();
    for (const half of [1, 2] as const) {
      state.half = half;
      const before = stateHash(state);
      const coral = observe(state, 'coral', null, 60);
      const cyan = observe(state, 'cyan', null, 60);
      expect(coral.teamContext.ownGoal).toEqual(cyan.teamContext.opponentGoal);
      expect(coral.teamContext.opponentGoal).toEqual({ x: half === 1 ? 105 : 0, y: 34 });
      expect(coral.teamContext.teammateIds).toEqual(cyan.teamContext.opponentIds);
      expect(coral.teamContext.teammateIds).toHaveLength(11);
      expect(coral.teamContext.possession).toBe('ours');
      expect(cyan.teamContext.possession).toBe('theirs');
      expect(
        coral.players.find((player) => player.id === 'coral-7')!.actionContext?.canKickNow,
      ).toBe(true);
      expect(cyan.players.find((player) => player.id === 'coral-7')).not.toHaveProperty(
        'actionContext',
      );
      expect(stateHash(state)).toBe(before);
    }
    state.ball.owner = null;
    state.players[0]!.dismissed = true;
    const observation = observe(state, 'coral', null, 60);
    expect(observation.teamContext.possession).toBe('loose');
    expect(observation.teamContext.teammateIds).not.toContain('coral-1');
  });

  it('reports tackle reach from exact geometry, cooldown and ball height without predicting success', () => {
    const state = createMatch();
    const carrier = state.players.find((player) => player.id === 'coral-7')!;
    const defender = state.players.find((player) => player.id === 'cyan-2')!;
    carrier.position = { x: 50, y: 34 };
    state.ball.position = { x: 50.65, y: 34, z: BALL_CONTROL.radius };
    defender.position = { x: 51.2, y: 34 };
    const context = () =>
      observe(state, 'cyan', null, 60).players.find((player) => player.id === defender.id)!
        .actionContext!;
    expect(context()).toMatchObject({
      reachableTackleTargetId: carrier.id,
      tackleCooldownTicks: 0,
      canKickNow: false,
    });
    defender.lastTackleTick = state.tick;
    expect(context()).toMatchObject({
      reachableTackleTargetId: null,
      tackleCooldownTicks: TACKLE.recoveryTicks,
    });
    state.tick += TACKLE.recoveryTicks;
    expect(context().reachableTackleTargetId).toBe(carrier.id);
    // The rounded display says 1.80 m; the actual carrier is just beyond the 1.8 m limit.
    defender.position.x = 51.8001;
    expect(context().nearestOpponent).toEqual({ playerId: carrier.id, distance: 1.8 });
    expect(context().reachableTackleTargetId).toBeNull();
    defender.position.x = 51.2;
    state.ball.position.z = BALL_CONTROL.maximumFootControlHeight + 0.01;
    expect(context().reachableTackleTargetId).toBeNull();
  });

  it('only reports kick readiness for an active owner in a delivering or playing phase', () => {
    const state = createMatch();
    awardRestart(state, 'kickoff', 'coral', { x: 52.5, y: 34 });
    const readyIds = () =>
      observe(state, 'coral', null, 60)
        .players.filter((player) => player.actionContext?.canKickNow)
        .map((player) => player.id);
    expect(readyIds()).toEqual([]);
    prepareRestartDelivery(state);
    expect(readyIds()).toEqual([state.ball.owner]);
    state.players.find((player) => player.id === state.ball.owner)!.dismissed = true;
    expect(readyIds()).toEqual([]);
  });

  it('keeps bounded team-specific failure feedback even when other events crowd out recent events', () => {
    const state = createMatch();
    state.events = [
      { id: 0, tick: 10, type: 'order_failed', playerId: 'coral-2', detail: 'old failure' },
      { id: 1, tick: 20, type: 'order_failed', playerId: 'cyan-2', detail: 'opponent failure' },
      {
        id: 2,
        tick: 20,
        type: 'order_failed',
        playerId: 'coral-7',
        detail: 'Kick requires possession',
      },
      ...Array.from({ length: 15 }, (_, index) => ({
        id: index + 3,
        tick: 21,
        type: 'block' as const,
        playerId: 'cyan-2',
        detail: 'contact',
      })),
    ];
    const observation = observe(state, 'coral', null, 60, 20);
    expect(observation.orderFeedback).toEqual([state.events[2]]);
    expect(observation.recentEvents).toContainEqual(state.events[2]);
    expect(observation.recentEvents.some((event) => event.type === 'block')).toBe(false);
    expect(observe(state, 'coral', null, 60, 22).orderFeedback).toEqual([]);
    state.events = Array.from({ length: 20 }, (_, id) => ({
      id,
      tick: 30,
      type: 'order_failed' as const,
      playerId: 'coral-7',
      detail: 'Kick requires possession',
    }));
    expect(observe(state, 'coral', null, 60, 20).orderFeedback).toHaveLength(
      PROTOCOL_LIMITS.recentEvents,
    );
  });

  it('keeps the new duration consistent and a populated request within the existing input limit', () => {
    const state = createMatch();
    for (const player of state.players)
      player.active = {
        order: { type: 'move', playerId: player.id, target: { x: 70, y: 34 }, pace: 1 },
        issued: 0,
        expires: 180,
      };
    state.events = Array.from({ length: 12 }, (_, id) => ({
      id,
      tick: 0,
      type: 'order_failed' as const,
      playerId: 'coral-7',
      detail: 'Tackle did not reach the carrier and ball',
    }));
    const memory: TacticalMemory = {
      plan: 'p'.repeat(PROTOCOL_LIMITS.planCharacters),
      ballPlayerId: 'coral-7',
      pass: { receiverId: 'coral-9', target: { x: 105, y: 68 } },
      assignments: Array.from({ length: 10 }, (_, index) => ({
        playerId: `coral-${index + 2}`,
        role: 'mark',
        opponentId: `cyan-${index + 2}`,
      })),
      threats: ['cyan-10', 'cyan-11'].map((opponentId) => ({
        opponentId,
        concern: 't'.repeat(PROTOCOL_LIMITS.threatCharacters),
      })),
      review: 'r'.repeat(PROTOCOL_LIMITS.reviewCharacters),
    };
    const observation = observe(state, 'coral', memory, 60);
    expect(observation.halfDurationSeconds).toBe(60);
    expect(observation.halfSecondsRemaining).toBe(60);
    expect(observation.matchSecondsRemaining).toBe(120);
    expect(rulebook()).toContain('Two 60-second playing halves');
    expect(rulebook()).toContain('at exactly 60 playing seconds');
    const inputBytes =
      Buffer.byteLength(
        rulebook() + JSON.stringify(observation) + JSON.stringify(RESPONSE_JSON_SCHEMA),
      ) + 1024;
    expect(inputBytes).toBeLessThan(DEFAULT_LIMITS.maximumInputBytes);
  });
});
