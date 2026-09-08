import type { Recording } from '../recording/record.ts';
import { clamp } from '../sim/math.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { activeGoal, GOAL_PRESENTATION } from './celebration.ts';

type CelebrationWindow = {
  recordingStart: number;
  recordingEnd: number;
  watchStart: number;
  watchEnd: number;
};
export type PresentationTimeline = {
  recordingDurationSeconds: number;
  durationSeconds: number;
  celebrations: CelebrationWindow[];
};

/** Give stopped-clock goals room to breathe without adding football ticks or changing a record. */
export function createPresentationTimeline(recording: Recording): PresentationTimeline {
  const recordingDurationSeconds = recording.durationTicks / TICK_RATE;
  const celebrations: CelebrationWindow[] = [];
  let addedTicks = 0;
  for (const goal of recording.events) {
    if (goal.type !== 'goal') continue;
    const startTick = goal.tick + 1;
    // Incident frames have exact integer ticks. A seconds round trip (e.g. 123/60)
    // can land just before that frame and incorrectly hide an entire celebration.
    const firstFrame = recording.frames.find((frame) => frame.tick === startTick);
    if (!firstFrame || activeGoal(recording, firstFrame)?.event.id !== goal.id) continue;
    const nextPhase = recording.frames.find(
      (frame) => frame.tick > startTick && frame.phase.sinceTick !== goal.tick,
    );
    const endTick = Math.min(
      startTick + GOAL_PRESENTATION.durationTicks,
      nextPhase?.tick ?? recording.durationTicks,
      recording.durationTicks,
    );
    if (endTick <= startTick) continue;
    const recordingStart = startTick / TICK_RATE;
    const recordingEnd = endTick / TICK_RATE;
    const recordedLengthTicks = endTick - startTick;
    const watchLengthTicks =
      recordedLengthTicks *
      ((GOAL_PRESENTATION.watchDurationSeconds * TICK_RATE) / GOAL_PRESENTATION.durationTicks);
    const watchStart = (startTick + addedTicks) / TICK_RATE;
    const watchEnd = (startTick + addedTicks + watchLengthTicks) / TICK_RATE;
    celebrations.push({ recordingStart, recordingEnd, watchStart, watchEnd });
    addedTicks += watchLengthTicks - recordedLengthTicks;
  }
  return {
    recordingDurationSeconds,
    durationSeconds: (recording.durationTicks + addedTicks) / TICK_RATE,
    celebrations,
  };
}

/** Slider, keyboard and rAF all use watch seconds; state and event readers use recording seconds. */
export function recordingSecondsAt(timeline: PresentationTimeline, watchSeconds: number): number {
  if (watchSeconds >= timeline.durationSeconds) return timeline.recordingDurationSeconds;
  const bounded = clamp(watchSeconds, 0, timeline.durationSeconds);
  let addedSeconds = 0;
  for (const window of timeline.celebrations) {
    if (bounded < window.watchStart) break;
    if (bounded < window.watchEnd) {
      const progress = (bounded - window.watchStart) / (window.watchEnd - window.watchStart);
      return window.recordingStart + progress * (window.recordingEnd - window.recordingStart);
    }
    addedSeconds = window.watchEnd - window.recordingEnd;
  }
  return bounded - addedSeconds;
}

export function watchSecondsAt(timeline: PresentationTimeline, recordingSeconds: number): number {
  if (recordingSeconds >= timeline.recordingDurationSeconds) return timeline.durationSeconds;
  const bounded = clamp(recordingSeconds, 0, timeline.recordingDurationSeconds);
  let addedSeconds = 0;
  for (const window of timeline.celebrations) {
    if (bounded < window.recordingStart) break;
    if (bounded < window.recordingEnd) {
      const progress =
        (bounded - window.recordingStart) / (window.recordingEnd - window.recordingStart);
      return window.watchStart + progress * (window.watchEnd - window.watchStart);
    }
    addedSeconds = window.watchEnd - window.recordingEnd;
  }
  return bounded + addedSeconds;
}
