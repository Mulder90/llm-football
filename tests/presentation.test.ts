import { describe, expect, it, vi } from 'vitest';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { capture, sample } from '../src/recording/record.ts';
import type { Frame } from '../src/recording/record.ts';
import { celebrationFrame } from '../src/render/celebration.ts';
import { drawGoalEffects } from '../src/render/goal-effects.ts';
import { BALL_CONTROL, FIELD, MATCH_TIMING, TICK_RATE } from '../src/sim/rules.ts';
import { createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import { MatchMoment } from '../src/ui/MatchMoment.tsx';

const fixture = createFullMatchFixture();
const firstGoal = fixture.events.find((event) => event.type === 'goal')!;
const afterGoal = (ticks: number) => sample(fixture, (firstGoal.tick + ticks) / TICK_RATE);
const moving = (frame: Frame) =>
  frame.players.some((player) => Math.hypot(player.velocity.x, player.velocity.y) > 0);

function drawingContext() {
  const fillRect = vi.fn();
  return {
    fillRect,
    context: {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect,
      globalAlpha: 1,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('goal presentation boundaries', () => {
  it('runs to the huddle, celebrates while settled, then returns to canonical poses before delivery', () => {
    const before = JSON.stringify(fixture);
    const gathering = celebrationFrame(fixture, afterGoal(22), false);
    const settled = celebrationFrame(fixture, afterGoal(56), false);
    const returning = celebrationFrame(fixture, afterGoal(90), false);
    expect(gathering.playerIds.size).toBe(0);
    expect(moving(gathering.frame)).toBe(true);
    expect(settled.playerIds.size).toBeGreaterThan(0);
    for (const playerId of settled.playerIds) {
      const index = fixture.initial.players.findIndex((player) => player.id === playerId);
      const velocity = settled.frame.players[index]!.velocity;
      expect(Math.hypot(velocity.x, velocity.y)).toBe(0);
      expect(gathering.frame.players[index]!.distanceTravelled).toBeLessThanOrEqual(
        settled.frame.players[index]!.distanceTravelled,
      );
    }
    expect(returning.playerIds.size).toBe(0);
    expect(moving(returning.frame)).toBe(true);
    const canonical = afterGoal(112);
    expect(canonical.phase.type).toBe('restart_setup');
    const finished = celebrationFrame(fixture, canonical, false);
    expect(finished.frame).toBe(canonical);
    expect(finished.playerIds.size).toBe(0);
    expect(MatchMoment({ recording: fixture, frame: canonical })).toBeNull();
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('preserves canonical poses with reduced motion and never shows a future goal effect', () => {
    const before = JSON.stringify(fixture);
    const active = afterGoal(22);
    const reduced = celebrationFrame(fixture, active, true);
    expect(reduced.frame).toBe(active);
    expect(reduced.playerIds.size).toBe(0);
    const { context, fillRect } = drawingContext();
    drawGoalEffects(context, active, fixture, true);
    expect(fillRect).not.toHaveBeenCalled();
    for (const frame of [afterGoal(-1), afterGoal(0)]) {
      expect(celebrationFrame(fixture, frame, false).frame).toBe(frame);
      expect(celebrationFrame(fixture, frame, false).playerIds.size).toBe(0);
      expect(MatchMoment({ recording: fixture, frame })).toBeNull();
      drawGoalEffects(context, frame, fixture, false);
    }
    expect(fillRect).not.toHaveBeenCalled();
    drawGoalEffects(context, active, fixture, false);
    expect(fillRect).toHaveBeenCalled();
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('celebrates only with the scoring team when the last toucher scored an own goal', () => {
    const recording = structuredClone(fixture);
    const goal = recording.events.find((event) => event.type === 'goal')!;
    const defender = recording.initial.players.find(
      (player) => player.team !== goal.team && player.role === 'outfield',
    )!;
    // A presentation fixture keeps the awarded team while changing the credited last touch.
    goal.playerId = defender.id;
    const before = JSON.stringify(recording);
    const frame = sample(recording, (goal.tick + 56) / TICK_RATE);
    const huddle = celebrationFrame(recording, frame, false);
    expect(huddle.playerIds.size).toBeGreaterThan(0);
    expect(huddle.playerIds.has(defender.id)).toBe(false);
    expect(
      [...huddle.playerIds].every(
        (id) => recording.initial.players.find((player) => player.id === id)!.team === goal.team,
      ),
    ).toBe(true);
    expect(JSON.stringify(recording)).toBe(before);
  });

  it('leaves a final-tick goal at full time without moving players or starting a goal banner', () => {
    const state = createMatch('last-tick-presentation');
    state.half = 2;
    state.halfPlayingTicks = MATCH_TIMING.halfPlayingTicks - 1;
    state.playingTicks = 2 * MATCH_TIMING.halfPlayingTicks - 1;
    state.tick = state.playingTicks;
    state.ball.owner = null;
    state.ball.position = {
      x: FIELD.length + BALL_CONTROL.radius - 0.01,
      y: FIELD.width / 2,
      z: BALL_CONTROL.radius,
    };
    state.ball.velocity = { x: 10, y: 0, z: 0 };
    step(state);
    const frame = capture(state);
    const goal = state.events.find((event) => event.type === 'goal')!;
    expect(goal.tick).toBe(frame.tick - 1);
    expect(frame.phase).toMatchObject({ type: 'full_time', reason: 'completed' });
    const recording = { ...fixture, events: state.events };
    const before = JSON.stringify({ recording, frame });
    const result = celebrationFrame(recording, frame, false);
    expect(result.frame).toBe(frame);
    expect(result.playerIds.size).toBe(0);
    expect(MatchMoment({ recording, frame })).toBeNull();
    const { context, fillRect } = drawingContext();
    drawGoalEffects(context, frame, recording, false);
    expect(fillRect).not.toHaveBeenCalled();
    expect(JSON.stringify({ recording, frame })).toBe(before);
  });
});
