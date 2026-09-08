import { describe, expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import {
  capture,
  sample,
  stateHash,
  verifyRecording,
  SAMPLE_INTERVAL_TICKS,
} from '../src/recording/record.ts';
import { parseRecording, readRecordingStream } from '../src/recording/validate.ts';
import type { Recording } from '../src/recording/record.ts';
import type { TacticalMemory } from '../src/protocol/schema.ts';
import { celebrationFrame } from '../src/render/celebration.ts';
import { crossedAudioEvents } from '../src/audio/playback-audio.ts';
import { MatchMoment } from '../src/ui/MatchMoment.tsx';
import { BALL_CONTROL, FIELD, REFEREE, TICK_RATE } from '../src/sim/rules.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';

const passing = createPassingFixture();
function recordedPlan(): TacticalMemory {
  return {
    plan: 'Pass wide with support behind the ball.',
    ballPlayerId: 'coral-7',
    pass: { receiverId: 'coral-9', target: { x: 52, y: 12 } },
    assignments: [{ playerId: 'coral-4', role: 'mark', opponentId: 'cyan-2' }],
    threats: [{ opponentId: 'cyan-2', concern: 'Closing down the carrier.' }],
    review: '',
  };
}
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
    expect(crossedAudioEvents(passing.events, kick.tick - 1, kick.tick, 1)).not.toContain(kick);
    expect(crossedAudioEvents(passing.events, kick.tick, kick.tick + 1, 1)).toContain(kick);
    expect(crossedAudioEvents(passing.events, kick.tick, kick.tick, 1)).toEqual([]);
    expect(crossedAudioEvents(passing.events, 1000, 0, 1)).toEqual([]);
    expect(crossedAudioEvents(passing.events, kick.tick, kick.tick + 1, 4)).toEqual([]);
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
  it('rejects imported plans with wrong-side references, duplicate assignments or an incoherent pass', () => {
    const plan = recordedPlan();
    const invalidPlans: TacticalMemory[] = [
      { ...plan, ballPlayerId: 'cyan-7' },
      { ...plan, pass: { ...plan.pass!, receiverId: 'cyan-9' } },
      { ...plan, assignments: [{ playerId: 'cyan-4', role: 'cover', opponentId: null }] },
      { ...plan, assignments: [{ playerId: 'coral-4', role: 'mark', opponentId: 'coral-2' }] },
      { ...plan, threats: [{ opponentId: 'coral-2', concern: '' }] },
      { ...plan, assignments: [plan.assignments[0]!, plan.assignments[0]!] },
      { ...plan, pass: { ...plan.pass!, receiverId: plan.ballPlayerId! } },
      { ...plan, ballPlayerId: null },
    ];
    for (const memory of invalidPlans) {
      const record = structuredClone(passing);
      record.decisions[0]!.notes = {
        coral: { intent: '', memory },
        cyan: { intent: '', memory: null },
      };
      expect(() => parseRecording(record)).toThrow(/Memory|pass plan/);
    }
    const record = structuredClone(passing);
    record.decisions[0]!.notes = {
      coral: { intent: '', memory: null },
      cyan: { intent: '', memory: plan },
    };
    expect(() => parseRecording(record)).toThrow('allowed roster');
  });
  it('roundtrips historical and fallback plans after a referenced player is dismissed', async () => {
    const state = createMatch('historical-memory');
    const carrier = state.players.find((player) => player.id === 'coral-7')!;
    const tackler = state.players.find((player) => player.id === 'cyan-2')!;
    tackler.position = { x: carrier.position.x - 1, y: carrier.position.y };
    tackler.velocity = { x: REFEREE.excessiveClosingSpeed, y: 0 };
    const coralMemory = recordedPlan();
    const cyanMemory: TacticalMemory = {
      ...recordedPlan(),
      ballPlayerId: 'cyan-2',
      pass: null,
      assignments: [],
      threats: [],
    };
    const record: Recording = {
      ...passing,
      initial: cloneState(state),
      decisions: [],
      frames: [capture(state)],
      events: [],
      durationTicks: 0,
      finalHash: '',
    };
    for (const boundary of [0, 1]) {
      const coral = emptyBatch(state, 'coral');
      const cyan = emptyBatch(state, 'cyan');
      if (boundary === 0)
        cyan.orders = [{ type: 'tackle', playerId: tackler.id, targetId: carrier.id }];
      record.decisions.push({
        tick: state.tick,
        batches: applyDecision(state, coral, cyan),
        fallback: boundary === 0 ? [] : ['coral', 'cyan'],
        notes: {
          coral: { intent: '', memory: coralMemory },
          cyan: { intent: '', memory: cyanMemory },
        },
      });
      step(state);
      record.frames.push(capture(state));
    }
    expect(tackler.dismissed).toBe(true);
    expect(record.frames[1]!.players[state.players.indexOf(tackler)]!.dismissed).toBe(true);
    record.events = state.events;
    record.durationTicks = state.tick;
    record.finalHash = stateHash(state);
    const decoded = await readRecordingStream(new Blob([JSON.stringify(record)]).stream());
    expect(decoded.decisions.map((decision) => decision.notes)).toEqual(
      record.decisions.map((decision) => decision.notes),
    );
    expect(
      verifyRecording(decoded).players.find((player) => player.id === tackler.id)!.dismissed,
    ).toBe(true);
  });
  it('waits for the updated score before displaying or sounding a goal on a sampled tick', () => {
    const state = createMatch('sampled-goal');
    const speed = 10;
    state.ball.owner = null;
    state.ball.lastTouch = 'coral-10';
    // Start 3.5 steps before the whole-ball goal plane: the crossing occurs inside tick 3.
    state.ball.position = {
      x: FIELD.length + BALL_CONTROL.radius - (speed * (SAMPLE_INTERVAL_TICKS + 0.5)) / TICK_RATE,
      y: FIELD.width / 2,
      z: BALL_CONTROL.radius,
    };
    state.ball.velocity = { x: speed, y: 0, z: 0 };
    const initial = cloneState(state);
    const frames = [capture(state)];
    while (state.tick <= SAMPLE_INTERVAL_TICKS) {
      step(state);
      frames.push(capture(state));
    }
    const recording = {
      ...passing,
      initial,
      decisions: [],
      frames,
      events: state.events,
      durationTicks: state.tick,
      finalHash: stateHash(state),
    };
    const sampledGoal = recording.events.find((event) => event.type === 'goal')!;
    expect(sampledGoal.tick).toBe(SAMPLE_INTERVAL_TICKS);
    // Events inside a step become visible in the following frame, after its score updates.
    const atContact = sample(recording, sampledGoal.tick / TICK_RATE);
    expect(atContact.tick).toBe(sampledGoal.tick);
    expect(atContact.score.coral).toBe(0);
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
    expect(verifyRecording(parseRecording(recording)).score.coral).toBe(1);
  });
  it('creates a goal huddle from past footage without altering any match state or showing it early', () => {
    const recording = createFullMatchFixture();
    const goal = recording.events.find((event) => event.type === 'goal')!;
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
