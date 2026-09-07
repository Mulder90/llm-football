import { describe, expect, it } from 'vitest';
import { footPosition } from '../src/sim/ball.ts';
import { notePlayerTouch, snapshotOffside } from '../src/sim/offside.ts';
import { applyDecision, emptyBatch, validateBatch } from '../src/sim/orders.ts';
import { awardRestart, prepareRestartDelivery } from '../src/sim/restarts.ts';
import { BALL_CONTROL, FIELD, MATCH_TIMING, REFEREE, RESTART_RULES } from '../src/sim/rules.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { MatchState, Order, Team } from '../src/sim/types.ts';

function submit(state: MatchState, team: Team, orders: Order[]) {
  const batches = [emptyBatch(state, 'coral'), emptyBatch(state, 'cyan')] as const;
  batches[team === 'coral' ? 0 : 1].orders = orders;
  applyDecision(state, ...batches);
}
function challenge(closingSpeed = 0, incidentX = 50) {
  const state = createMatch('referee');
  const carrier = state.players.find((player) => player.id === 'coral-7')!;
  const tackler = state.players.find((player) => player.id === 'cyan-2')!;
  carrier.position = { x: incidentX, y: 34 };
  carrier.facing = { x: 1, y: 0 };
  tackler.position = { x: incidentX - 1, y: 34 };
  tackler.velocity = { x: closingSpeed, y: 0 };
  state.ball.position = footPosition(carrier);
  submit(state, 'cyan', [{ type: 'tackle', playerId: tackler.id, targetId: carrier.id }]);
  return { state, carrier, tackler };
}

describe('contact referee and discipline', () => {
  it.each([
    [REFEREE.recklessClosingSpeed - 0.01, 0, false],
    [REFEREE.recklessClosingSpeed, 1, false],
    [REFEREE.excessiveClosingSpeed - 0.01, 1, false],
    [REFEREE.excessiveClosingSpeed, 0, true],
  ] as const)(
    'judges contact at closing speed %s without advancing through the foul',
    (speed, yellows, dismissed) => {
      const { state, carrier, tackler } = challenge(speed);
      const location = { ...carrier.position };
      step(state);
      expect(state.phase).toMatchObject({
        type: 'restart_setup',
        restart: { type: 'free_kick', position: location, team: 'coral' },
      });
      expect(tackler.yellowCards).toBe(yellows);
      expect(tackler.dismissed).toBe(dismissed);
      expect(carrier.position).toEqual(location);
      expect(state.events.some((event) => event.type === 'tackle')).toBe(false);
      expect(state.playingTicks).toBe(1);
    },
  );
  it.each([
    [88.49, 'free_kick'],
    [88.5, 'penalty'],
  ] as const)('uses the incident at x=%s to award %s', (location, type) => {
    const { state } = challenge(0, location);
    step(state);
    expect(state.phase).toMatchObject({ restart: { type, team: 'coral' } });
    if (type === 'penalty')
      expect(state.ball.position.x).toBe(FIELD.length - FIELD.penaltySpotDistance);
  });
  it('dismisses on a second caution, excludes the player from contacts, and rejects further orders', () => {
    const { state, tackler } = challenge(5);
    tackler.yellowCards = 1;
    step(state);
    expect(tackler.dismissed).toBe(true);
    expect(state.events.filter((event) => event.type === 'red_card')).toHaveLength(1);
    expect(() =>
      validateBatch(
        { ...emptyBatch(state, 'cyan'), orders: [{ type: 'hold', playerId: tackler.id }] },
        state,
        'cyan',
      ),
    ).toThrow('Dismissed');
    state.phase = { type: 'open_play', sinceTick: state.tick };
    const before = { ...tackler.position };
    state.players
      .filter((player) => player.id !== tackler.id)
      .forEach((player) => {
        player.position = { x: 10, y: 10 };
      });
    state.ball.position = { ...before, z: BALL_CONTROL.radius };
    state.ball.owner = null;
    step(state);
    expect(state.ball.owner).toBe(null);
    expect(tackler.position).toEqual(before);
  });
  it('abandons below seven active players even on the final playing tick', () => {
    const { state, tackler } = challenge(10);
    state.players
      .filter((player) => player.team === 'cyan' && player.id !== tackler.id)
      .slice(0, 4)
      .forEach((player) => {
        player.dismissed = true;
      });
    state.half = 2;
    state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    step(state);
    expect(state.phase).toMatchObject({ type: 'full_time', reason: 'abandoned' });
    expect(state.events.at(-1)?.detail).toContain('fewer than 7');
  });
  it('applies the declared fixed-clock cutoff to a penalty awarded on the last tick', () => {
    const { state } = challenge(0, 90);
    state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    step(state);
    expect(
      state.events.some((event) => event.type === 'restart_awarded' && event.detail === 'penalty'),
    ).toBe(true);
    expect(state.phase.type).toBe('halftime');
  });
});

describe('penalty and indirect delivery', () => {
  it.each([1, -1] as const)(
    'places a penalty in attack direction %s and penalizes backward delivery',
    (direction) => {
      const state = createMatch();
      state.half = direction === 1 ? 1 : 2;
      const spot = { x: direction === 1 ? 94 : 11, y: 34 };
      state.players.forEach((player) => {
        player.position = { ...spot };
      });
      awardRestart(state, 'penalty', 'coral', spot);
      prepareRestartDelivery(state);
      if (state.phase.type !== 'restart_ready') throw new Error('Expected ready penalty');
      const taker = state.phase.restart.takerId;
      for (const player of state.players) {
        if (player.id === taker) continue;
        if (player.team === 'cyan' && player.role === 'keeper')
          expect(player.position.x).toBe(direction === 1 ? 105 : 0);
        else {
          expect(
            Math.hypot(player.position.x - spot.x, player.position.y - spot.y),
          ).toBeGreaterThanOrEqual(RESTART_RULES.opponentDistance - 1e-8);
          expect((player.position.x - spot.x) * direction).toBeLessThan(0);
        }
      }
      submit(state, 'coral', [
        { type: 'kick', playerId: taker, target: { x: 52.5, y: 34 }, speed: 15 },
      ]);
      step(state);
      expect(state.phase).toMatchObject({
        type: 'restart_setup',
        restart: { type: 'indirect_free_kick', team: 'cyan' },
      });
      expect(state.playingTicks).toBe(0);
    },
  );
  it('does not award a direct goal from an indirect free kick', () => {
    const state = createMatch();
    state.ball.owner = null;
    state.ball.lastTouch = 'coral-7';
    state.ball.restartTouch = { type: 'indirect_free_kick', team: 'coral', takerId: 'coral-7' };
    state.ball.position = { x: 104.99, y: 34, z: BALL_CONTROL.radius };
    state.ball.velocity = { x: 20, y: 0, z: 0 };
    step(state);
    expect(state.score.coral).toBe(0);
    expect(state.phase).toMatchObject({ restart: { type: 'goal_kick', team: 'cyan' } });
  });
});

function offsidePosition(direction: 1 | -1 = 1) {
  const state = createMatch();
  state.half = direction === 1 ? 1 : 2;
  const x = (positive: number) => (direction === 1 ? positive : FIELD.length - positive);
  state.players.forEach((player) => {
    player.position = { x: x(player.team === 'coral' ? 30 : 70), y: 8 + player.number * 2 };
  });
  const passer = state.players.find((player) => player.id === 'coral-7')!;
  const receiver = state.players.find((player) => player.id === 'coral-10')!;
  passer.position = { x: x(60), y: 34 };
  receiver.position = { x: x(80), y: 34 };
  state.ball.position = { x: x(60), y: 34, z: BALL_CONTROL.radius };
  return { state, passer, receiver, x };
}

describe('offside touch snapshots', () => {
  it.each([1, -1] as const)(
    'retains the position at touch when a receiver returns onside, direction %s',
    (direction) => {
      const { state, passer, receiver, x } = offsidePosition(direction);
      snapshotOffside(state, passer);
      expect(state.offside?.playerIds).toContain(receiver.id);
      receiver.position = { x: x(50), y: 34 };
      state.ball.owner = null;
      state.ball.position = { ...receiver.position, z: BALL_CONTROL.radius };
      state.ball.velocity = { x: 0, y: 0, z: 0 };
      step(state);
      expect(
        state.events.some((event) => event.type === 'offside' && event.playerId === receiver.id),
      ).toBe(true);
      expect(state.phase).toMatchObject({
        restart: { type: 'indirect_free_kick', team: 'cyan', position: receiver.position },
      });
    },
  );
  it.each([1, -1] as const)(
    'allows level players, players behind the ball and the own half, direction %s',
    (direction) => {
      const { state, passer, receiver, x } = offsidePosition(direction);
      for (const position of [70, 70 + REFEREE.offsideTolerance, 50]) {
        receiver.position.x = x(position);
        snapshotOffside(state, passer);
        expect(state.offside?.playerIds).not.toContain(receiver.id);
      }
      receiver.position.x = x(80);
      state.ball.position.x = x(81);
      snapshotOffside(state, passer);
      expect(state.offside?.playerIds).not.toContain(receiver.id);
    },
  );
  it('exempts direct throws, corners and goal kicks, but not free kicks', () => {
    const { state, passer, receiver } = offsidePosition();
    for (const restart of ['throw_in', 'corner', 'goal_kick'] as const) {
      snapshotOffside(state, passer, restart);
      expect(state.offside).toBe(null);
    }
    snapshotOffside(state, passer, 'free_kick');
    expect(state.offside?.playerIds).toContain(receiver.id);
  });
  it('keeps candidates through a rebound or guarding save and resets on opponent control', () => {
    const { state, passer, receiver } = offsidePosition();
    const defender = state.players.find((player) => player.id === 'cyan-1')!;
    snapshotOffside(state, passer);
    const cloned = cloneState(state);
    notePlayerTouch(state, defender, false, false);
    expect(state.offside?.playerIds).toContain(receiver.id);
    notePlayerTouch(state, defender, true, true);
    expect(state.offside?.playerIds).toContain(receiver.id);
    notePlayerTouch(state, defender, true, false);
    expect(state.offside?.team).toBe('cyan');
    expect(cloned.offside?.playerIds).toContain(receiver.id);
  });
});
