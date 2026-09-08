import { describe, expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample, verifyRecording, SAMPLE_INTERVAL_TICKS } from '../src/recording/record.ts';
import { parseRecording, readRecordingStream } from '../src/recording/validate.ts';
import { celebrationFrame } from '../src/render/celebration.ts';
import { crossedAudioEvents } from '../src/audio/playback-audio.ts';
import { MatchMoment } from '../src/ui/MatchMoment.tsx';
import { TICK_RATE } from '../src/sim/rules.ts';

const passing = createPassingFixture();
describe('recording import and presentation boundaries', () => {
  it('lands on the final frame even when converting seconds back to ticks loses precision', () => {
    // 512.05 seconds × 60 becomes 30722.999999999996 in JavaScript.
    const durationTicks = 30723;
    const finalFrame = { ...passing.frames.at(-1)!, tick: durationTicks };
    const timeline = { ...passing, durationTicks, frames: [passing.frames[0]!, finalFrame] };
    expect(sample(timeline, durationTicks / TICK_RATE)).toBe(finalFrame);
  });
  it('only sounds events crossed forward, with no historical effects after seeking backwards', () => {
    const kick = passing.events.find((event) => event.type === 'kick')!;
    expect(crossedAudioEvents(passing.events, kick.tick - 1, kick.tick, 1)).toContain(kick);
    expect(crossedAudioEvents(passing.events, kick.tick, kick.tick, 1)).toEqual([]);
    expect(crossedAudioEvents(passing.events, 1000, 0, 1)).toEqual([]);
    expect(crossedAudioEvents(passing.events, kick.tick - 1, kick.tick, 4)).toEqual([]);
  });
  it('validates exported bytes without rewriting the canonical property order', async () => {
    const decoded = await readRecordingStream(new Blob([JSON.stringify(passing)]).stream());
    expect(verifyRecording(decoded).tick).toBe(passing.durationTicks);
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(passing));
  });
  it('rejects non-finite frames, broken identities, missing endpoints and unsupported versions', () => {
    for (const corrupt of [
      (record: typeof passing) => {
        record.frames[1]!.ball.x = Infinity;
      },
      (record: typeof passing) => {
        record.initial.players[1]!.id = record.initial.players[0]!.id;
      },
      (record: typeof passing) => {
        record.frames.splice(0, 1);
      },
      (record: typeof passing) => {
        record.frames[1]!.tick = 0;
      },
      (record: typeof passing) => {
        record.decisions[0]!.batches[1].team = 'coral';
      },
      (record: typeof passing) => {
        // @ts-expect-error Deliberately corrupt the external recording boundary.
        record.engine = 'future-engine';
      },
      (record: typeof passing) => {
        record.kind = 'llm';
      },
    ]) {
      const record = structuredClone(passing);
      corrupt(record);
      expect(() => parseRecording(record)).toThrow();
    }
  });
  it('creates a goal huddle from past footage without altering any match state or showing it early', () => {
    const recording = createFullMatchFixture();
    const goal = recording.events.find((event) => event.type === 'goal')!;
    // Events inside a step become visible in the following frame, after its score updates.
    const sampledGoal = recording.events.find(
      (event) => event.type === 'goal' && event.tick % SAMPLE_INTERVAL_TICKS === 0,
    )!;
    const atContact = sample(recording, sampledGoal.tick / TICK_RATE);
    expect(atContact.tick).toBe(sampledGoal.tick);
    expect(MatchMoment({ recording, frame: atContact })).toBeNull();
    expect(
      crossedAudioEvents(recording.events, sampledGoal.tick - 1, sampledGoal.tick, 1),
    ).not.toContain(sampledGoal);
    expect(
      crossedAudioEvents(recording.events, sampledGoal.tick, sampledGoal.tick + 1, 1),
    ).toContain(sampledGoal);
    expect(
      MatchMoment({ recording, frame: sample(recording, (sampledGoal.tick + 1) / TICK_RATE) }),
    ).not.toBeNull();
    const before = JSON.stringify(recording);
    const early = celebrationFrame(
      recording,
      sample(recording, (goal.tick - 1) / TICK_RATE),
      false,
    );
    expect(early.playerIds.size).toBe(0);
    const during = celebrationFrame(
      recording,
      sample(recording, (goal.tick + 45) / TICK_RATE),
      false,
    );
    expect(during.playerIds.size).toBe(5);
    expect([...during.playerIds].every((id) => id.startsWith(goal.team!))).toBe(true);
    expect(JSON.stringify(recording)).toBe(before);
    expect(verifyRecording(parseRecording(recording)).phase).toMatchObject({
      type: 'full_time',
      reason: 'completed',
    });
  });
});
