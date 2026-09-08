import { describe, expect, it } from 'vitest';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { capture, sample } from '../src/recording/record.ts';
import { kickoffFrame } from '../src/render/kickoff.ts';
import { awardRestart } from '../src/sim/restarts.ts';
import {
  BALL_CONTROL,
  FIELD,
  MATCH_TIMING,
  MOVEMENT,
  RESTART_RULES,
  TICK_RATE,
} from '../src/sim/rules.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';

const record = createFullMatchFixture();

describe('opening kickoff presentation', () => {
  it('shows the taker at the centre, a central teammate nearby and legal opposing positions in each half', () => {
    for (const half of [1, 2] as const) {
      const frame = record.frames.find(
        (frame) =>
          frame.half === half &&
          frame.phase.type === 'restart_setup' &&
          frame.phase.restart.type === 'kickoff' &&
          frame.playingTicks === (half - 1) * MATCH_TIMING.halfPlayingTicks,
      )!;
      if (frame.phase.type !== 'restart_setup') throw new Error('Expected kickoff setup');
      const before = JSON.stringify({ record, frame });
      const shown = kickoffFrame(record, frame, false);
      const restart = frame.phase.restart;
      const takingDirection = (restart.team === 'coral') === (half === 1) ? 1 : -1;
      const takerIndex = record.initial.players.findIndex(
        (player) => player.id === restart.takerId,
      );
      expect(shown.players[takerIndex]!.position).toEqual({
        x: FIELD.length / 2 - takingDirection * BALL_CONTROL.carryingOffset,
        y: FIELD.width / 2,
      });
      expect(shown.players[takerIndex]!.facing).toEqual({ x: takingDirection, y: 0 });
      const supportIndex = record.initial.players.findIndex(
        (player) => player.id === `${restart.team}-7`,
      );
      expect(shown.players[supportIndex]!.position).toEqual({
        x: FIELD.length / 2 - takingDirection * 5,
        y: FIELD.width / 2,
      });
      shown.players.forEach((pose, index) => {
        const player = record.initial.players[index]!;
        if (player.id === restart.takerId || pose.dismissed) return;
        const direction = (player.team === 'coral') === (half === 1) ? 1 : -1;
        expect((pose.position.x - FIELD.length / 2) * direction).toBeLessThanOrEqual(
          -MOVEMENT.playerRadius + 1e-9,
        );
        if (player.team !== restart.team)
          expect(
            Math.hypot(pose.position.x - FIELD.length / 2, pose.position.y - FIELD.width / 2),
          ).toBeGreaterThanOrEqual(RESTART_RULES.opponentDistance - 1e-9);
      });
      expect(shown.ball).toBe(frame.ball);
      expect(shown.owner).toBe(frame.owner);
      expect(shown.phase).toBe(frame.phase);
      expect(JSON.stringify({ record, frame })).toBe(before);
    }
  });

  it('removes the support offset smoothly and meets the actual referee placement at delivery', () => {
    const state = createMatch('kickoff-boundary');
    awardRestart(state, 'kickoff', 'coral', { x: FIELD.length / 2, y: FIELD.width / 2 });
    const initial = cloneState(state);
    const frames = [capture(state)];
    while (state.tick < MATCH_TIMING.restartSetupTicks) {
      step(state);
      frames.push(capture(state));
    }
    const match = {
      ...record,
      initial,
      frames,
      events: state.events,
      decisions: [],
      durationTicks: state.tick,
    };
    const ready = frames.at(-1)!;
    const nearReady = kickoffFrame(match, frames.at(-2)!, false);
    nearReady.players.forEach((player, index) => {
      expect(
        Math.hypot(
          player.position.x - ready.players[index]!.position.x,
          player.position.y - ready.players[index]!.position.y,
        ),
      ).toBeLessThan(0.003);
    });
    expect(kickoffFrame(match, ready, false)).toBe(ready);
    expect(ready.owner).toBe('coral-10');
    const mid = kickoffFrame(match, frames[MATCH_TIMING.restartSetupTicks / 2]!, false);
    expect(mid.players[6]!.velocity.x).toBeLessThan(0);
    expect(mid.players[6]!.distanceTravelled).toBeGreaterThan(0);
    const reduced = kickoffFrame(match, frames[0]!, true);
    expect(reduced.players.map((player) => player.position)).toEqual(
      ready.players.map((player) => player.position),
    );
  });

  it('keeps the support choice tied to the starting formation until the designated taker changes', () => {
    const frame = structuredClone(record.frames[0]!);
    if (frame.phase.type !== 'restart_setup') throw new Error('Expected kickoff setup');
    frame.tick = 60;
    frame.players[6]!.position = { x: 20, y: 20 };
    frame.players[5]!.position = { x: 49, y: 34 };
    const shown = kickoffFrame(record, frame, false);
    const legal = kickoffFrame(record, frame, true);
    expect(shown.players[6]!.position).not.toEqual(legal.players[6]!.position);
    expect(shown.players[5]!.position).toEqual(legal.players[5]!.position);
    frame.phase.restart.takerId = 'coral-7';
    const changed = kickoffFrame(record, frame, false);
    const changedLegal = kickoffFrame(record, frame, true);
    expect(changed.players[6]!.position).toEqual(changedLegal.players[6]!.position);
    expect(changed.players[9]!.position).not.toEqual(changedLegal.players[9]!.position);
  });

  it('leaves goal celebrations, other restarts and live play untouched', () => {
    for (const goal of record.events.filter((event) => event.type === 'goal')) {
      const frame = sample(record, (goal.tick + 30) / TICK_RATE);
      expect(kickoffFrame(record, frame, false)).toBe(frame);
    }
    for (const frame of record.frames.filter(
      (frame) => frame.phase.type !== 'restart_setup' || frame.phase.restart.type !== 'kickoff',
    ))
      expect(kickoffFrame(record, frame, false)).toBe(frame);
  });

  it('repeats exact seeks without reading future poses or changing the recording', () => {
    const frame = sample(record, 0.5);
    const before = JSON.stringify(record);
    const shown = kickoffFrame(record, frame, false);
    const pastOnly = {
      ...record,
      frames: record.frames.filter((candidate) => candidate.tick <= frame.tick),
      events: record.events.filter((event) => event.tick < frame.tick),
    };
    expect(kickoffFrame(pastOnly, frame, false)).toEqual(shown);
    kickoffFrame(record, sample(record, 40), false);
    expect(kickoffFrame(record, frame, false)).toEqual(shown);
    expect(JSON.stringify(record)).toBe(before);
  });
});
