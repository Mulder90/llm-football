import { describe, expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { createRefereeTrack, sampleReferee } from '../src/render/referee.ts';
import { capture, stateHash, verifyRecording } from '../src/recording/record.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { awardRestart } from '../src/sim/restarts.ts';
import { step } from '../src/sim/step.ts';

describe('referee presentation', () => {
  it('signals a restart timeout on the exact terminal frame, without waiting for a nonexistent tick', () => {
    const state = createMatch('referee-timeout');
    awardRestart(state, 'kickoff', 'coral', { x: 52.5, y: 34 });
    const recording = {
      ...createPassingFixture(),
      initial: cloneState(state),
      decisions: [],
      frames: [capture(state)],
    };
    while (state.phase.type !== 'full_time') {
      step(state);
      recording.frames.push(capture(state));
    }
    recording.events = state.events;
    recording.durationTicks = state.tick;
    recording.finalHash = stateHash(state);
    expect(verifyRecording(recording).phase).toMatchObject({
      type: 'full_time',
      reason: 'abandoned',
    });
    const track = createRefereeTrack(recording);
    expect(sampleReferee(track, state.tick - 0.25).signal).toBeNull();
    expect(sampleReferee(track, state.tick).signal).toMatchObject({
      type: 'whistle',
      tick: state.tick,
    });
  });
  it('signals clock boundaries on their recorded frame, including the exact final frame', () => {
    const recording = createFullMatchFixture();
    const track = createRefereeTrack(recording);
    for (const event of recording.events.filter((event) =>
      ['restart_ready', 'halftime', 'full_time'].includes(event.type),
    )) {
      expect(sampleReferee(track, event.tick).signal).toMatchObject({
        type: 'whistle',
        tick: event.tick,
      });
    }
    expect(sampleReferee(track, recording.durationTicks).signal?.type).toBe('whistle');
  });
  it('does not anticipate future ball positions or a card, including fractional playheads', () => {
    const recording = createPassingFixture();
    const changed = structuredClone(recording);
    const incidentTick = 300;
    for (const frame of changed.frames) {
      if (frame.tick < incidentTick) continue;
      frame.ball.x = 100;
      frame.ball.y = 5;
    }
    changed.events = changed.events.filter((event) => event.tick < incidentTick);
    changed.events.push({
      id: changed.events.length,
      tick: incidentTick,
      type: 'yellow_card',
      playerId: 'coral-4',
      team: 'coral',
      detail: 'Recorded caution',
    });
    const originalTrack = createRefereeTrack(recording);
    const changedTrack = createRefereeTrack(changed);
    expect(changedTrack.slice(0, incidentTick)).toEqual(originalTrack.slice(0, incidentTick));
    expect(sampleReferee(changedTrack, incidentTick - 0.25)).toEqual(
      sampleReferee(originalTrack, incidentTick - 0.25),
    );
    expect(sampleReferee(changedTrack, incidentTick).signal).toBeNull();
    const beforeVisibleIncident = sampleReferee(changedTrack, incidentTick + 0.75);
    expect(beforeVisibleIncident.signal).toBeNull();
    expect(beforeVisibleIncident.facing).toEqual(
      sampleReferee(originalTrack, incidentTick + 0.75).facing,
    );
    expect(sampleReferee(changedTrack, incidentTick + 1).signal?.type).toBe('yellow_card');
    expect(changedTrack[incidentTick + 60]!.position).not.toEqual(
      originalTrack[incidentTick + 60]!.position,
    );
  });

  it('keeps movement and acceleration bounded when the recorded ball jumps across the pitch', () => {
    const recording = createPassingFixture();
    recording.events = [];
    recording.frames.forEach((frame, index) => {
      frame.ball.x = index % 2 ? 2 : 103;
      frame.ball.y = index % 2 ? 2 : 66;
    });
    const track = createRefereeTrack(recording);
    let maximumStep = 0;
    let maximumVelocityChange = 0;
    for (let index = 1; index < track.length; index++) {
      const previous = track[index - 1]!;
      const current = track[index]!;
      maximumStep = Math.max(
        maximumStep,
        Math.hypot(
          current.position.x - previous.position.x,
          current.position.y - previous.position.y,
        ),
      );
      maximumVelocityChange = Math.max(
        maximumVelocityChange,
        Math.hypot(
          current.velocity.x - previous.velocity.x,
          current.velocity.y - previous.velocity.y,
        ),
      );
    }
    expect(maximumStep).toBeLessThanOrEqual(6 / 60 + 1e-9);
    expect(maximumVelocityChange).toBeLessThanOrEqual(10 / 60 + 1e-9);
    expect(track.at(-1)!.distanceTravelled).toBeGreaterThan(1);
  });

  it('repeats a pose after arbitrary seeks without modifying the recording', () => {
    const recording = createPassingFixture();
    const original = structuredClone(recording);
    const track = createRefereeTrack(recording);
    const pose = sampleReferee(track, 421.25);
    for (const tick of [0, 900.75, 150, recording.durationTicks, 42.5]) sampleReferee(track, tick);
    expect(sampleReferee(track, 421.25)).toEqual(pose);
    expect(recording).toEqual(original);
    expect(createRefereeTrack(recording)).toEqual(track);
  });
});
