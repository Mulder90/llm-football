import { describe, expect, it } from 'vitest';
import { footPosition, handlingRestriction, noteHandlingTouch } from '../src/sim/ball-control.ts';
import { applyDecision, emptyBatch, validateBatch } from '../src/sim/orders.ts';
import { awardRestart, prepareRestartDelivery } from '../src/sim/restarts.ts';
import { BALL_CONTROL, FIELD, KEEPER, MATCH_TIMING, TICK_RATE } from '../src/sim/rules.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import { observe } from '../src/protocol/observation.ts';
import type { MatchState, Order, Team } from '../src/sim/types.ts';

function setup(half: 1 | 2 = 1) {
  const state = createMatch('keeper-test');
  state.half = half;
  state.players.forEach((player, index) => {
    player.position = { x: 35 + index * 2, y: 8 };
  });
  const keeper = state.players[0]!;
  keeper.position = { x: half === 1 ? 8 : 97, y: 34 };
  keeper.facing = { x: half === 1 ? 1 : -1, y: 0 };
  state.ball.owner = keeper.id;
  state.ball.position = footPosition(keeper);
  state.ball.lastTouch = 'cyan-10';
  return { state, keeper };
}
function submit(state: MatchState, orders: Order[], team: Team = 'coral') {
  applyDecision(
    state,
    { ...emptyBatch(state, 'coral'), orders: team === 'coral' ? orders : [] },
    { ...emptyBatch(state, 'cyan'), orders: team === 'cyan' ? orders : [] },
  );
}
function advance(state: MatchState, ticks: number) {
  for (let tick = 0; tick < ticks; tick++) step(state);
}
function pickup(state: MatchState) {
  submit(state, [{ type: 'pickup', playerId: 'coral-1' }]);
  step(state);
}

describe('persistent keeper hand possession', () => {
  it.each([1, 2] as const)(
    'catches a legal moving ball in half %i using declared reach',
    (half) => {
      const { state, keeper } = setup(half);
      const direction = keeper.facing.x;
      state.ball.owner = null;
      state.ball.position = { x: keeper.position.x + direction * 3, y: 35.2, z: 1.7 };
      state.ball.velocity = { x: -direction * 18, y: 0, z: 0 };
      submit(state, [{ type: 'guard', playerId: keeper.id, target: { ...keeper.position } }]);
      advance(state, 15);
      expect(state.ball.owner).toBe(keeper.id);
      expect(state.ball.handControl?.kind).toBe('catch');
      expect(state.ball.position.z).toBe(KEEPER.handHeight);
      expect(state.events.filter((event) => event.type === 'save')).toHaveLength(1);
      expect(keeper.position.x).toBe(half === 1 ? 8 : 97);
    },
  );

  it('keeps hands and timer through move, hold, omitted orders, expiry and repeated pickup', () => {
    const { state, keeper } = setup();
    pickup(state);
    const control = { ...state.ball.handControl! };
    const copy = cloneState(state);
    copy.ball.handControl!.sinceTick = 999;
    expect(state.ball.handControl).toEqual(control);
    submit(state, [{ type: 'move', playerId: keeper.id, target: { x: 12, y: 34 }, pace: 0.5 }]);
    advance(state, 80);
    submit(state, [{ type: 'hold', playerId: keeper.id }]);
    advance(state, 190);
    submit(state, []);
    pickup(state);
    expect(state.ball.handControl).toEqual(control);
    expect(state.ball.position.x).toBeCloseTo(
      keeper.position.x + keeper.facing.x * BALL_CONTROL.carryingOffset,
    );
    expect(state.events.at(-1)).toMatchObject({ type: 'order_failed', playerId: keeper.id });
    const context = observe(state, 'coral', null, TICK_RATE).players[0]!.actionContext!;
    expect(context.canKickNow).toBe(false);
    expect(context.canDistributeNow).toBe(true);
    expect(context.canPickUpNow).toBe(false);
    expect(observe(state, 'cyan', null, TICK_RATE).ball.possessionMode).toBe('hands');
  });

  it('rejects an ordinary kick from hands without losing ownership', () => {
    const { state } = setup();
    pickup(state);
    submit(state, [{ type: 'kick', playerId: 'coral-1', target: { x: 25, y: 34 }, speed: 12 }]);
    step(state);
    expect(state.ball.handControl).not.toBeNull();
    expect(state.events.at(-1)?.type).toBe('order_failed');
  });

  it.each(['roll', 'throw', 'punt'] as const)(
    'executes a %s with the chosen direction and bounded launch',
    (delivery) => {
      const { state, keeper } = setup();
      pickup(state);
      const before = { ...state.ball.position };
      submit(state, [
        {
          type: 'distribute',
          delivery,
          playerId: keeper.id,
          target: { x: 30, y: before.y },
          speed: 10,
          loft: delivery === 'roll' ? 0 : 4,
        },
      ]);
      step(state);
      expect(state.ball.owner).toBeNull();
      expect(state.ball.handControl).toBeNull();
      expect(state.ball.position.x).toBeCloseTo(before.x + 10 / TICK_RATE);
      expect(state.ball.velocity.y).toBe(0);
      expect(state.ball.position.z).toBeCloseTo(
        delivery === 'roll' ? BALL_CONTROL.radius : KEEPER.handHeight + 4 / TICK_RATE,
      );
      expect(state.ball.handling.releasedBy).toBe(keeper.id);
      expect(state.events.at(-1)).toMatchObject({ type: 'keeper_release', delivery });
    },
  );

  it('puts down for normal foot play, but cannot handle again after its own kick', () => {
    const { state, keeper } = setup();
    pickup(state);
    submit(state, [{ type: 'put_down', playerId: keeper.id }]);
    step(state);
    expect(state.ball.owner).toBe(keeper.id);
    expect(state.ball.handControl).toBeNull();
    expect(state.ball.position.z).toBe(BALL_CONTROL.radius);
    expect(observe(state, 'coral', null, TICK_RATE).players[0]!.actionContext!.canKickNow).toBe(
      true,
    );
    submit(state, [{ type: 'kick', playerId: keeper.id, target: { x: 30, y: 34 }, speed: 12 }]);
    step(state);
    expect(handlingRestriction(state, keeper)).toMatch(/another player touch/);
    noteHandlingTouch(state, state.players[1]!, false);
    expect(handlingRestriction(state, keeper)).toBeNull();
  });

  it('penalizes a reachable challenge of protected hands without transferring ownership', () => {
    const { state, keeper } = setup();
    pickup(state);
    const attacker = state.players.find((player) => player.id === 'cyan-10')!;
    attacker.position = { x: keeper.position.x + 1, y: 34 };
    expect(
      observe(state, 'cyan', null, TICK_RATE).players.find((player) => player.id === attacker.id)!
        .actionContext!.reachableTackleTargetId,
    ).toBeNull();
    submit(state, [{ type: 'tackle', playerId: attacker.id, targetId: keeper.id }], 'cyan');
    step(state);
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'indirect_free_kick', team: 'coral' },
    });
    expect(state.events.some((event) => event.type === 'tackle')).toBe(false);
    expect(state.ball.handControl).toBeNull();
  });
});

describe('handling eligibility and separate touch histories', () => {
  it('allows foot control of a deliberate back-pass and penalizes an explicit pickup', () => {
    const { state, keeper } = setup();
    const teammate = state.players[2]!;
    teammate.position = { x: 20, y: 34 };
    teammate.facing = { x: -1, y: 0 };
    state.ball.owner = teammate.id;
    state.ball.position = footPosition(teammate);
    submit(state, [
      { type: 'kick', playerId: teammate.id, target: keeper.position, speed: 12 },
      { type: 'guard', playerId: keeper.id, target: keeper.position },
    ]);
    advance(state, 70);
    expect(state.ball.owner).toBe(keeper.id);
    expect(state.ball.handControl).toBeNull();
    expect(state.events.some((event) => event.type === 'save')).toBe(false);
    expect(handlingRestriction(state, keeper)).toMatch(/teammate kick/);
    pickup(state);
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'indirect_free_kick', team: 'cyan' },
    });
  });

  it('keeps a direct teammate throw-in restricted through keeper foot control', () => {
    const { state, keeper } = setup();
    awardRestart(state, 'throw_in', 'coral', { x: 8, y: 0 });
    if (state.phase.type !== 'restart_setup') throw new Error('Expected restart');
    state.phase.restart.takerId = 'coral-2';
    prepareRestartDelivery(state);
    submit(state, [{ type: 'kick', playerId: 'coral-2', target: { x: 8, y: 34 }, speed: 12 }]);
    step(state);
    expect(state.ball.handling.directThrowInTeam).toBe('coral');
    noteHandlingTouch(state, keeper, true);
    state.ball.position = footPosition(keeper);
    expect(handlingRestriction(state, keeper)).toMatch(/throw-in/);
    noteHandlingTouch(state, state.players[2]!, false);
    expect(state.ball.handling.directThrowInTeam).toBeNull();
  });

  it('an opponent deflection clears rehandling but preserves a teammate-kick restriction', () => {
    const { state, keeper } = setup();
    state.ball.handling.deliberateKick = { playerId: 'coral-2', team: 'coral' };
    state.ball.handling.releasedBy = keeper.id;
    const attacker = state.players.find((player) => player.id === 'cyan-10')!;
    noteHandlingTouch(state, attacker, false);
    expect(state.ball.handling.releasedBy).toBeNull();
    expect(handlingRestriction(state, keeper)).toMatch(/teammate kick/);
    noteHandlingTouch(state, attacker, true);
    expect(handlingRestriction(state, keeper)).toBeNull();
  });

  it('penalizes immediate rehandling after putting down and cannot reset the restriction with guard', () => {
    const { state } = setup();
    pickup(state);
    submit(state, [{ type: 'put_down', playerId: 'coral-1' }]);
    step(state);
    pickup(state);
    expect(state.phase).toMatchObject({ restart: { type: 'indirect_free_kick', team: 'cyan' } });
  });

  it.each([-0.000001, 0, 0.000001])(
    'checks the ball centre at the penalty line (%f m)',
    (offset) => {
      const { state, keeper } = setup();
      keeper.position.x = FIELD.penaltyAreaDepth - 1;
      state.ball.owner = null;
      state.ball.position = { x: FIELD.penaltyAreaDepth + offset, y: 34, z: 1 };
      state.ball.velocity = { x: 0, y: 0, z: 0 };
      submit(state, [{ type: 'guard', playerId: keeper.id, target: keeper.position }]);
      step(state);
      expect(Boolean(state.ball.handControl)).toBe(offset <= 0);
    },
  );

  it.each([1, 2] as const)(
    'awards a direct free kick when held movement exits the area in half %i',
    (half) => {
      const { state, keeper } = setup(half);
      pickup(state);
      const edge = half === 1 ? FIELD.penaltyAreaDepth : FIELD.length - FIELD.penaltyAreaDepth;
      submit(state, [
        {
          type: 'move',
          playerId: keeper.id,
          target: { x: edge + keeper.facing.x * 2, y: 34 },
          pace: 1,
        },
      ]);
      for (let tick = 0; tick < 150 && state.phase.type === 'open_play'; tick++) step(state);
      expect(state.phase).toMatchObject({ restart: { type: 'free_kick', team: 'cyan' } });
      expect(state.ball.handControl).toBeNull();
    },
  );

  it.each(['opponent', 'own'] as const)(
    'applies direct hand-distribution scoring to the %s goal',
    (goal) => {
      const { state } = setup();
      state.ball.owner = null;
      state.ball.handling.directThrowBy = 'coral-1';
      state.ball.lastTouch = 'coral-1';
      state.ball.position = {
        x: goal === 'opponent' ? FIELD.length : 0,
        y: 34,
        z: BALL_CONTROL.radius,
      };
      state.ball.velocity = { x: goal === 'opponent' ? 20 : -20, y: 0, z: 0 };
      step(state);
      expect(state.score).toEqual(
        goal === 'opponent' ? { coral: 0, cyan: 0 } : { coral: 0, cyan: 1 },
      );
      expect(state.phase).toMatchObject({
        restart: { type: goal === 'opponent' ? 'goal_kick' : 'kickoff' },
      });
    },
  );
});

describe('playing-tick timer and action boundaries', () => {
  it.each([1, 2] as const)(
    'allows exactly eight seconds, then awards the correct corner in half %i',
    (half) => {
      const { state, keeper } = setup(half);
      pickup(state);
      advance(state, KEEPER.maximumHoldTicks - 2);
      expect(state.playingTicks).toBe(479);
      expect(state.ball.handControl).not.toBeNull();
      step(state);
      expect(state.playingTicks).toBe(480);
      expect(state.ball.handControl).not.toBeNull();
      expect(observe(state, 'coral', null, TICK_RATE).ball.holdTicksRemaining).toBe(0);
      step(state);
      expect(state.playingTicks).toBe(481);
      expect(state.phase).toMatchObject({
        restart: {
          type: 'corner',
          team: 'cyan',
          position: { x: half === 1 ? 0 : FIELD.length, y: FIELD.width },
        },
      });
      const paused = state.playingTicks;
      advance(state, 10);
      expect(state.playingTicks).toBe(paused);
      expect(keeper.active).toBeNull();
    },
  );

  it('allows a release at the exact limit before the next playing interval', () => {
    const { state } = setup();
    pickup(state);
    advance(state, 479);
    submit(state, [
      {
        type: 'distribute',
        delivery: 'roll',
        playerId: 'coral-1',
        target: { x: 25, y: 34 },
        speed: 10,
        loft: 0,
      },
    ]);
    step(state);
    expect(state.phase.type).toBe('open_play');
    expect(state.events.some((event) => event.type === 'keeper_violation')).toBe(false);
  });

  it.each([1, 2] as const)(
    'records an overdue hold before the same-tick end of half %i',
    (half) => {
      const { state } = setup(half);
      state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - KEEPER.maximumHoldTicks - 1;
      state.tick = state.playingTicks =
        (half - 1) * MATCH_TIMING.halfPlayingTicks + state.halfPlayingTicks;
      pickup(state);
      advance(state, KEEPER.maximumHoldTicks - 1);
      step(state);
      const terminal = half === 1 ? 'halftime' : 'full_time';
      expect(state.phase.type).toBe(terminal);
      expect(state.events.slice(-3).map((event) => event.type)).toEqual([
        'keeper_violation',
        'restart_awarded',
        terminal,
      ]);
      expect(state.ball.handControl).toBeNull();
      expect(state.ball.owner).toBeNull();
    },
  );

  it.each([1, 2] as const)('clears hand state at the end of half %i', (half) => {
    const { state } = setup(half);
    state.tick = state.playingTicks = 100;
    state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    pickup(state);
    expect(state.phase.type).toBe(half === 1 ? 'halftime' : 'full_time');
    expect(state.ball.handControl).toBeNull();
    expect(state.ball.owner).toBeNull();
  });

  it('rejects wrong-team, stale, outfield, stopped-phase, non-finite and delivery-specific bounds', () => {
    const { state } = setup();
    const payload = (order: unknown) => ({ ...emptyBatch(state, 'coral'), orders: [order] });
    const base = {
      type: 'distribute',
      delivery: 'roll',
      playerId: 'coral-1',
      target: { x: 25, y: 34 },
      speed: 10,
      loft: 0,
    };
    for (const invalid of [
      { playerId: 'cyan-1' },
      { playerId: 'coral-2' },
      { speed: NaN },
      { speed: Infinity },
      { speed: 13 },
      { loft: 1 },
      { delivery: 'throw', loft: 7 },
      { delivery: 'punt', speed: 31 },
      { target: { x: Infinity, y: 34 } },
      { delivery: 'lob' },
    ])
      expect(() => validateBatch(payload({ ...base, ...invalid }), state, 'coral')).toThrow();
    expect(() => validateBatch({ ...payload(base), tick: 1 }, state, 'coral')).toThrow(/stale/);
    expect(() => validateBatch(payload(base), state, 'coral')).not.toThrow();
    awardRestart(state, 'goal_kick', 'coral', { x: 5.5, y: 34 });
    expect(() => validateBatch(payload(base), state, 'coral')).toThrow(/open play/);
  });
});
