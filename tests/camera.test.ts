import { describe, expect, it } from 'vitest';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample } from '../src/recording/record.ts';
import { cameraAt } from '../src/render/camera.ts';
import type { Camera } from '../src/render/camera.ts';
import { celebrationFrame, GOAL_PRESENTATION } from '../src/render/celebration.ts';
import { STADIUM_SIZE, worldToScreen } from '../src/render/layout.ts';
import { FIELD, TICK_RATE } from '../src/sim/rules.ts';
import type { Vec2 } from '../src/sim/types.ts';

const recording = createFullMatchFixture();
const wide = { x: STADIUM_SIZE.width / 2, y: STADIUM_SIZE.height / 2, zoom: 1 };
const pitchCorners = [
  { x: 0, y: 0 },
  { x: FIELD.length, y: 0 },
  { x: 0, y: FIELD.width },
  { x: FIELD.length, y: FIELD.width },
];

function expectVisible(camera: Camera, point: Vec2) {
  const position = worldToScreen(point);
  const x = (position.x - camera.x) * camera.zoom + STADIUM_SIZE.width / 2;
  const y = (position.y - camera.y) * camera.zoom + STADIUM_SIZE.height / 2;
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(STADIUM_SIZE.width);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(STADIUM_SIZE.height);
}

describe('top-down broadcast camera', () => {
  it('keeps the playing field and touchline action visible throughout open play', () => {
    for (const frame of recording.frames.filter((frame) => frame.phase.type === 'open_play')) {
      const camera = cameraAt(recording, frame, false, false);
      for (const corner of pitchCorners) expectVisible(camera, corner);
      expectVisible(camera, frame.ball);
      expect(camera.zoom).toBeGreaterThan(1);
      // The transformed background must cover the viewport: no trails at its edges.
      expect(camera.x - STADIUM_SIZE.width / camera.zoom / 2).toBeGreaterThanOrEqual(0);
      expect(camera.y - STADIUM_SIZE.height / camera.zoom / 2).toBeGreaterThanOrEqual(0);
      expect(camera.x + STADIUM_SIZE.width / camera.zoom / 2).toBeLessThanOrEqual(
        STADIUM_SIZE.width,
      );
      expect(camera.y + STADIUM_SIZE.height / camera.zoom / 2).toBeLessThanOrEqual(
        STADIUM_SIZE.height,
      );
    }
  });

  it('frames the net, ball and celebrating group, including a long-range scorer', () => {
    const goal = recording.events.find((event) => event.type === 'goal')!;
    const longShot = structuredClone(recording);
    const scorerIndex = longShot.initial.players.findIndex((player) => player.id === goal.playerId);
    const beforeGoal = sample(recording, (goal.tick - 1) / TICK_RATE);
    const oppositeGoalX = beforeGoal.ball.x > FIELD.length / 2 ? 0 : FIELD.length;
    for (const frame of longShot.frames) {
      if (frame.tick <= goal.tick)
        frame.players[scorerIndex]!.position = { x: oppositeGoalX, y: FIELD.width / 2 };
    }
    for (const match of [recording, longShot]) {
      for (const ageTicks of [1, 15, 30, 56, 90, GOAL_PRESENTATION.durationTicks - 1]) {
        const frame = sample(match, (goal.tick + 1 + ageTicks) / TICK_RATE);
        const celebration = celebrationFrame(match, frame, false);
        const camera = cameraAt(match, frame, false, false);
        expectVisible(camera, beforeGoal.ball);
        expectVisible(camera, celebration.frame.ball);
        expectVisible(camera, celebration.focus!);
        for (const playerId of celebration.playerIds) {
          const index = match.initial.players.findIndex((player) => player.id === playerId);
          expectVisible(camera, celebration.frame.players[index]!.position);
        }
        expect(camera.zoom).toBeGreaterThanOrEqual(1);
        expect(camera.zoom).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it('offers a static whole view and respects reduced motion and interval states', () => {
    for (const frame of recording.frames.filter((_, index) => index % 30 === 0)) {
      expect(cameraAt(recording, frame, true, false)).toEqual(wide);
      expect(cameraAt(recording, frame, false, true)).toEqual(wide);
    }
    for (const frame of recording.frames.filter(
      (frame) => frame.phase.type === 'halftime' || frame.phase.type === 'full_time',
    )) {
      expect(cameraAt(recording, frame, false, false)).toEqual(wide);
    }
  });

  it('is seek-deterministic, does not reveal future goals and leaves the recording unchanged', () => {
    const before = JSON.stringify(recording);
    const goal = recording.events.find((event) => event.type === 'goal')!;
    const earlyFrame = sample(recording, (goal.tick - 1) / TICK_RATE);
    const withoutFutureGoals = {
      ...recording,
      events: recording.events.filter((event) => event.tick < earlyFrame.tick),
    };
    expect(cameraAt(recording, earlyFrame, false, false)).toEqual(
      cameraAt(withoutFutureGoals, earlyFrame, false, false),
    );
    const frame = sample(recording, (goal.tick + 56) / TICK_RATE);
    const first = cameraAt(recording, frame, false, false);
    cameraAt(recording, sample(recording, 60), false, false);
    cameraAt(recording, sample(recording, 0), false, false);
    expect(cameraAt(recording, frame, false, false)).toEqual(first);
    expect(JSON.stringify(recording)).toBe(before);
  });
});
