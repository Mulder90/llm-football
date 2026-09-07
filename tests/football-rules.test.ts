import { describe, expect, it } from 'vitest';
import { applyDecision, emptyBatch, validateBatch } from '../src/sim/orders.ts';
import { awardRestart } from '../src/sim/restarts.ts';
import { BALL_CONTROL, FIELD, MATCH_TIMING, RESTART_RULES, TICK_RATE } from '../src/sim/rules.ts';
import { attackDirection, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { MatchState, Order, Team } from '../src/sim/types.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample, verifyRecording } from '../src/recording/record.ts';

function isolatedMatch(): MatchState {
  const state = createMatch('rules-test');
  state.players.forEach((player, index) => {
    player.position = { x: 20 + (index % 11) * 2, y: 8 + Math.floor(index / 11) * 3 };
  });
  state.ball.owner = null;
  state.ball.lastTouch = 'coral-10';
  state.ball.position = { x: 100, y: FIELD.width / 2, z: BALL_CONTROL.radius };
  state.ball.velocity = { x: 25, y: 0, z: 0 };
  return state;
}

function advanceTicks(state: MatchState, ticks: number): void {
  for (let index = 0; index < ticks; index++) step(state);
}

function submit(state: MatchState, team: Team, orders: Order[]): void {
  const coral = emptyBatch(state, 'coral');
  const cyan = emptyBatch(state, 'cyan');
  (team === 'coral' ? coral : cyan).orders = orders;
  applyDecision(state, coral, cyan);
}

describe('shots, saves and swept incidents', () => {
  it('scores only on a whole-ball crossing, then awards the conceding kickoff', () => {
    const state = isolatedMatch();
    state.ball.position.x = FIELD.length + BALL_CONTROL.radius - 0.01;
    state.ball.velocity.x = 0;
    step(state);
    expect(state.score).toEqual({ coral: 0, cyan: 0 });
    state.ball.velocity.x = 10;
    step(state);
    expect(state.score).toEqual({ coral: 1, cyan: 0 });
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'kickoff', team: 'cyan' },
    });
    expect(state.events.filter((event) => event.type === 'goal')).toHaveLength(1);
  });

  it('lets an above-bar shot miss instead of scoring from its top-down position', () => {
    const state = isolatedMatch();
    state.ball.position = { x: 104, y: FIELD.width / 2, z: 3.5 };
    advanceTicks(state, 5);
    expect(state.score.coral).toBe(0);
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'goal_kick', team: 'cyan' },
    });
  });

  it.each(['post', 'crossbar'] as const)(
    'rebounds from the %s before the goal line can count',
    (framePart) => {
      const state = isolatedMatch();
      state.ball.position = {
        x: 104,
        y: framePart === 'post' ? FIELD.width / 2 - FIELD.goalWidth / 2 : FIELD.width / 2,
        z: framePart === 'crossbar' ? FIELD.goalHeight : BALL_CONTROL.radius,
      };
      advanceTicks(state, 5);
      expect(state.events.some((event) => event.type === 'post')).toBe(true);
      expect(state.ball.velocity.x).toBeLessThan(0);
      expect(state.score.coral).toBe(0);
    },
  );

  it('gives a guarding keeper extended catching reach without chasing the ball', () => {
    const state = isolatedMatch();
    const keeper = state.players.find((player) => player.id === 'cyan-1')!;
    keeper.position = { x: 102, y: 34 };
    state.ball.position = { x: 99, y: 35.2, z: 0.3 };
    submit(state, 'cyan', [{ type: 'guard', playerId: keeper.id, target: { ...keeper.position } }]);
    advanceTicks(state, 12);
    expect(state.ball.owner).toBe(keeper.id);
    expect(state.events.some((event) => event.type === 'save')).toBe(true);
    expect(keeper.position).toEqual({ x: 102, y: 34 });
  });

  it('does not give a stationary uncommanded keeper the same extended reach', () => {
    const state = isolatedMatch();
    state.players.find((player) => player.id === 'cyan-1')!.position = { x: 102, y: 34 };
    state.ball.position = { x: 99, y: 35.2, z: 0.3 };
    advanceTicks(state, 20);
    expect(state.events.some((event) => event.type === 'save')).toBe(false);
    expect(state.score.coral).toBe(1);
  });

  it('resolves a defender block before a later goal crossing', () => {
    const state = isolatedMatch();
    state.ball.position.x = 101;
    state.players.find((player) => player.id === 'cyan-3')!.position = { x: 103, y: 34 };
    for (let tick = 0; tick < 14 && !state.events.some((event) => event.type === 'block'); tick++)
      step(state);
    expect(state.events.some((event) => event.type === 'block')).toBe(true);
    expect(state.ball.velocity.x).toBeLessThan(0);
    expect(state.score.coral).toBe(0);
  });
});

describe('restart awards and delivery', () => {
  it.each([
    ['right', 'coral-10', 'goal_kick', 'cyan'],
    ['right', 'cyan-3', 'corner', 'coral'],
    ['left', 'coral-3', 'corner', 'cyan'],
    ['left', 'cyan-10', 'goal_kick', 'coral'],
    ['top', 'coral-10', 'throw_in', 'cyan'],
    ['bottom', 'cyan-10', 'throw_in', 'coral'],
  ] as const)('awards %s crossing after %s as %s for %s', (side, lastTouch, type, team) => {
    const state = isolatedMatch();
    state.ball.lastTouch = lastTouch;
    state.ball.position = {
      x: side === 'left' ? -0.12 : side === 'right' ? FIELD.length + 0.12 : 50,
      y: side === 'top' ? -0.12 : side === 'bottom' ? FIELD.width + 0.12 : 5,
      z: BALL_CONTROL.radius,
    };
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    step(state);
    expect(state.phase).toMatchObject({ type: 'restart_setup', restart: { type, team } });
    const playingTicks = state.playingTicks;
    advanceTicks(state, 10);
    expect(state.playingTicks).toBe(playingTicks);
  });

  it('accepts taker selection only in setup and enforces opponent separation at ready', () => {
    const state = createMatch();
    awardRestart(state, 'corner', 'coral', { x: FIELD.length, y: 0 });
    state.players.find((player) => player.id === 'cyan-2')!.position = { x: FIELD.length, y: 0 };
    submit(state, 'coral', [{ type: 'restart_taker', playerId: 'coral-9' }]);
    advanceTicks(state, MATCH_TIMING.restartSetupTicks);
    expect(state.phase).toMatchObject({ type: 'restart_ready', restart: { takerId: 'coral-9' } });
    const defender = state.players.find((player) => player.id === 'cyan-2')!;
    expect(
      Math.hypot(defender.position.x - FIELD.length, defender.position.y),
    ).toBeGreaterThanOrEqual(RESTART_RULES.opponentDistance - 1e-8);
    expect(() =>
      validateBatch(
        {
          ...emptyBatch(state, 'cyan'),
          orders: [{ type: 'kick', playerId: 'cyan-2', target: { x: 50, y: 34 }, speed: 12 }],
        },
        state,
        'cyan',
      ),
    ).toThrow('selected taker');
    submit(state, 'coral', [
      { type: 'kick', playerId: 'coral-9', target: { x: 85, y: 20 }, speed: 12, loft: 3 },
    ]);
    step(state);
    expect(state.phase.type).toBe('open_play');
    expect(state.playingTicks).toBe(1);
    expect(state.ball.velocity.z).toBeGreaterThan(0);
  });

  it('cancels stale shots across phase transitions and marks a missing delivery incomplete', () => {
    const state = createMatch();
    submit(state, 'coral', [
      { type: 'shoot', playerId: 'coral-7', target: { x: 105, y: 34 }, speed: 25 },
    ]);
    awardRestart(state, 'throw_in', 'cyan', { x: 50, y: 0 });
    expect(state.players.every((player) => player.active === null)).toBe(true);
    advanceTicks(state, MATCH_TIMING.restartSetupTicks + MATCH_TIMING.restartDeliveryTicks);
    expect(state.phase).toMatchObject({ type: 'full_time', reason: 'abandoned' });
    expect(state.playingTicks).toBe(0);
    expect(state.events.some((event) => event.type === 'shot')).toBe(false);
  });

  it('does not count a direct throw-in goal', () => {
    const state = isolatedMatch();
    state.ball.restartTouch = { type: 'throw_in', team: 'coral', takerId: 'coral-10' };
    advanceTicks(state, 20);
    expect(state.score.coral).toBe(0);
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'goal_kick', team: 'cyan' },
    });
  });

  it('penalizes a taker touching its own delivery before anyone else', () => {
    const state = isolatedMatch();
    const taker = state.players.find((player) => player.id === 'coral-10')!;
    taker.position = { x: 50, y: 34 };
    state.ball.position = { x: 50, y: 34, z: BALL_CONTROL.radius };
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.ball.restartTouch = { type: 'kickoff', team: 'coral', takerId: taker.id };
    step(state);
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'free_kick', team: 'cyan' },
    });
  });
});

describe('contested play and match completion', () => {
  it('requires a tackle to physically reach the ball and named opponent', () => {
    const state = createMatch();
    state.players.find((player) => player.id === 'coral-7')!.position = { x: 50, y: 34 };
    state.ball.position = { x: 50.65, y: 34, z: BALL_CONTROL.radius };
    const tackler = state.players.find((player) => player.id === 'cyan-2')!;
    tackler.position = { x: 51.2, y: 34 };
    submit(state, 'cyan', [{ type: 'tackle', playerId: tackler.id, targetId: 'coral-7' }]);
    step(state);
    expect(state.ball.owner).toBe(tackler.id);
    expect(state.events.some((event) => event.type === 'tackle')).toBe(true);
    submit(state, 'coral', [{ type: 'tackle', playerId: 'coral-2', targetId: tackler.id }]);
    step(state);
    expect(state.ball.owner).toBe(tackler.id);
  });

  it('swaps ends at halftime without changing IDs or advancing the playing clock during the interval', () => {
    const state = isolatedMatch();
    const playerIds = state.players.map((player) => player.id);
    state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    state.playingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    step(state);
    expect(state.phase.type).toBe('halftime');
    advanceTicks(state, MATCH_TIMING.halftimeTicks);
    expect(state.half).toBe(2);
    expect(state.playingTicks).toBe(MATCH_TIMING.halfPlayingTicks);
    expect(attackDirection(state, 'coral')).toBe(-1);
    expect(state.players.map((player) => player.id)).toEqual(playerIds);
    expect(state.phase).toMatchObject({
      type: 'restart_setup',
      restart: { type: 'kickoff', team: 'cyan' },
    });
  });

  it('counts a goal on the final playing tick, then freezes the canonical state', () => {
    const state = isolatedMatch();
    state.half = 2;
    state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    state.playingTicks = 2 * MATCH_TIMING.halfPlayingTicks - 1;
    state.ball.position.x = FIELD.length - 0.05;
    step(state);
    expect(state.score.cyan).toBe(1);
    expect(state.phase).toMatchObject({ type: 'full_time', reason: 'completed' });
    const finished = JSON.stringify(state);
    advanceTicks(state, 100);
    expect(JSON.stringify(state)).toBe(finished);
  });

  it('runs and replays a complete six-minute scripted baseline with both halves and no fabricated completion', () => {
    const recording = createFullMatchFixture();
    const final = verifyRecording(recording);
    expect(recording.kind).toBe('fixture');
    expect(final.phase).toMatchObject({ type: 'full_time', reason: 'completed' });
    expect(final.playingTicks).toBe(360 * TICK_RATE);
    expect(final.half).toBe(2);
    expect(recording.events.some((event) => event.type === 'goal')).toBe(true);
    expect(recording.events.filter((event) => event.type === 'halftime')).toHaveLength(1);
    const secondHalfStart = recording.frames.find((frame) => frame.half === 2)!;
    expect(sample(recording, (secondHalfStart.tick - 0.5) / TICK_RATE).half).toBe(1);
  }, 20_000);
});
