import { Children, isValidElement } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import {
  capture,
  sample,
  SAMPLE_INTERVAL_TICKS,
  stateHash,
  verifyRecording,
} from '../src/recording/record.ts';
import type { Recording } from '../src/recording/record.ts';
import { parseRecording } from '../src/recording/validate.ts';
import { celebrationFrame, GOAL_PRESENTATION } from '../src/render/celebration.ts';
import {
  createPresentationTimeline,
  recordingSecondsAt,
  watchSecondsAt,
} from '../src/render/presentation-time.ts';
import { BALL_CONTROL, FIELD, MATCH_TIMING, TICK_RATE } from '../src/sim/rules.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import { PlaybackControls } from '../src/ui/PlaybackControls.tsx';
import type { Playback } from '../src/ui/usePlayback.ts';

const recording = createFullMatchFixture();
const timeline = createPresentationTimeline(recording);

function goalRecording(goalTick: number, visibleTicks: number): Recording {
  const state = createMatch('presentation-goal-boundary');
  state.players.forEach((player, index) => {
    player.position = { x: 10 + index * 2, y: 8 };
  });
  const speed = 15;
  const distanceAfter = (ticks: number) =>
    (speed * ticks) / TICK_RATE -
    (BALL_CONTROL.groundDeceleration * ticks * (ticks - 1)) / (2 * TICK_RATE ** 2);
  state.ball.owner = null;
  state.ball.lastTouch = 'coral-10';
  // The ball crosses halfway between these two steps, with no players in its path.
  state.ball.position = {
    x:
      FIELD.length +
      BALL_CONTROL.radius -
      (distanceAfter(goalTick) + distanceAfter(goalTick + 1)) / 2,
    y: FIELD.width / 2,
    z: BALL_CONTROL.radius,
  };
  state.ball.velocity = { x: speed, y: 0, z: 0 };
  const result: Recording = {
    ...recording,
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
    durationTicks: goalTick + 1 + visibleTicks,
    finalHash: '',
  };
  while (state.tick < result.durationTicks) {
    const previousEventCount = state.events.length;
    step(state);
    if (state.tick % SAMPLE_INTERVAL_TICKS === 0 || state.events.length !== previousEventCount)
      result.frames.push(capture(state));
  }
  if (result.frames.at(-1)!.tick !== state.tick) result.frames.push(capture(state));
  result.events = state.events;
  result.finalHash = stateHash(state);
  return result;
}

function replaySlider(
  node: ReactNode,
): ReactElement<InputHTMLAttributes<HTMLInputElement>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string }>(child)) continue;
    if (child.type === 'input' && child.props['aria-label'] === 'Replay position') return child;
    const found = replaySlider(child.props.children);
    if (found) return found;
  }
}

describe('broadcast presentation time', () => {
  it('extends a real goal even when its visible tick loses precision in seconds', () => {
    const boundaryGoal = goalRecording(122, GOAL_PRESENTATION.durationTicks);
    expect(boundaryGoal.events.find((event) => event.type === 'goal')?.tick).toBe(122);
    expect(boundaryGoal.frames.find((frame) => frame.tick === 123)?.score.coral).toBe(1);
    const goalTimeline = createPresentationTimeline(boundaryGoal);
    expect(goalTimeline.celebrations).toHaveLength(1);
    const window = goalTimeline.celebrations[0]!;
    expect(window.watchEnd - window.watchStart).toBeCloseTo(9);
    expect(
      sample(boundaryGoal, recordingSecondsAt(goalTimeline, window.watchStart - 1 / TICK_RATE))
        .score.coral,
    ).toBe(0);
    expect(
      sample(boundaryGoal, recordingSecondsAt(goalTimeline, window.watchStart + 2)).score.coral,
    ).toBe(1);
    expect(verifyRecording(parseRecording(boundaryGoal)).tick).toBe(boundaryGoal.durationTicks);
  });

  it('seeks the slider maximum to the exact endpoint, including a partial celebration', () => {
    for (const match of [recording, goalRecording(122, 1)]) {
      const matchTimeline = createPresentationTimeline(match);
      const seekTo = vi.fn();
      const playback: Playback = {
        durationSeconds: matchTimeline.durationSeconds,
        timeline: matchTimeline,
        recordingSeconds: 0,
        playhead: { current: 0 },
        isPlaying: false,
        seconds: 0,
        speed: 1,
        seekRevision: 0,
        hasEnded: false,
        setSpeed: vi.fn(),
        seekTo,
        togglePlayback: vi.fn(),
        replay: vi.fn(),
        onAdvance: vi.fn(),
        rewind: vi.fn(),
      };
      const controls = PlaybackControls({
        playback,
        showPlayerNumbers: false,
        wholePitch: false,
        reducedMotion: false,
        isFullscreen: false,
        onToggleNumbers: vi.fn(),
        onToggleWholePitch: vi.fn(),
        onToggleFullscreen: vi.fn(),
        sound: {
          audio: { current: null },
          muted: true,
          volume: 0.45,
          toggleMute: vi.fn(async () => {}),
          changeVolume: vi.fn(),
          unlockFromGesture: vi.fn(async () => {}),
        },
      });
      const slider = replaySlider(controls)!;
      for (const [position, expected] of [
        [0, 0],
        [TICK_RATE, 1],
        [slider.props.max, matchTimeline.durationSeconds],
      ]) {
        slider.props.onChange!({
          target: { value: String(position) },
        } as ChangeEvent<HTMLInputElement>);
        expect(seekTo).toHaveBeenLastCalledWith(expected);
      }
      const endpoint = seekTo.mock.lastCall![0] as number;
      expect(sample(match, recordingSecondsAt(matchTimeline, endpoint)).tick).toBe(
        match.durationTicks,
      );
      expect(verifyRecording(parseRecording(match)).tick).toBe(match.durationTicks);
    }
  });

  it('gives each goal nine watch seconds, with a held celebration and unchanged playing clock', () => {
    const goals = recording.events.filter((event) => event.type === 'goal');
    expect(goals.length).toBeGreaterThan(0);
    expect(timeline.celebrations).toHaveLength(goals.length);
    for (const window of timeline.celebrations) {
      expect(window.watchEnd - window.watchStart).toBeCloseTo(9);
      const first = sample(recording, window.recordingStart);
      for (const secondsIntoCelebration of [4, 5, 6]) {
        const frame = sample(
          recording,
          recordingSecondsAt(timeline, window.watchStart + secondsIntoCelebration),
        );
        expect(frame.playingTicks).toBe(first.playingTicks);
        expect(frame.score).toEqual(first.score);
        expect(celebrationFrame(recording, frame, false).playerIds.size).toBe(5);
      }
      const end = sample(recording, window.recordingEnd);
      expect(celebrationFrame(recording, end, false).frame).toBe(end);
    }
  });

  it('maps arbitrary seeks both ways and reaches the exact final recording tick', () => {
    for (let seconds = 0; seconds < timeline.durationSeconds; seconds += 0.137) {
      const recorded = recordingSecondsAt(timeline, seconds);
      expect(watchSecondsAt(timeline, recorded)).toBeCloseTo(seconds, 10);
    }
    for (const window of timeline.celebrations) {
      expect(recordingSecondsAt(timeline, window.watchStart)).toBeCloseTo(window.recordingStart);
      expect(recordingSecondsAt(timeline, window.watchEnd)).toBeCloseTo(window.recordingEnd);
    }
    const end = sample(recording, recordingSecondsAt(timeline, timeline.durationSeconds));
    expect(end.tick).toBe(recording.durationTicks);
    expect(end.playingTicks).toBe(2 * MATCH_TIMING.halfPlayingTicks);
    expect(end.phase).toEqual({
      type: 'full_time',
      reason: 'completed',
      sinceTick: recording.durationTicks,
    });
    expect(recordingSecondsAt(timeline, -1)).toBe(0);
    expect(recordingSecondsAt(timeline, timeline.durationSeconds + 1)).toBe(
      timeline.recordingDurationSeconds,
    );
  });

  it('does not show a goal early or let later goals alter an earlier playhead', () => {
    const first = timeline.celebrations[0]!;
    const before = sample(
      recording,
      recordingSecondsAt(timeline, first.watchStart - 1 / TICK_RATE),
    );
    expect(before.score).toEqual({ coral: 0, cyan: 0 });
    const changed = structuredClone(recording);
    changed.events = changed.events.filter(
      (event) => event.type !== 'goal' || event.tick / TICK_RATE < first.recordingEnd,
    );
    const changedTimeline = createPresentationTimeline(changed);
    for (const watchTime of [
      0,
      first.watchStart - 0.25,
      first.watchStart + 3,
      first.watchEnd + 1,
    ]) {
      expect(recordingSecondsAt(changedTimeline, watchTime)).toBe(
        recordingSecondsAt(timeline, watchTime),
      );
    }
  });

  it('leaves ordinary play and canonical replay untouched', () => {
    const passing = createPassingFixture();
    const ordinary = createPresentationTimeline(passing);
    expect(ordinary.durationSeconds).toBe(passing.durationTicks / TICK_RATE);
    expect(ordinary.celebrations).toEqual([]);
    expect(recordingSecondsAt(ordinary, 5.25)).toBe(5.25);
    const original = JSON.stringify(recording);
    createPresentationTimeline(recording);
    expect(JSON.stringify(recording)).toBe(original);
    expect(verifyRecording(recording).tick).toBe(recording.durationTicks);
  });
});
