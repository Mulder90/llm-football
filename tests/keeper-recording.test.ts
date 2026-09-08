import { describe, expect, it } from 'vitest';
import { createKeeperFixture } from '../src/fixtures/keeper.ts';
import { capture, sample, stateHash, verifyRecording } from '../src/recording/record.ts';
import { parseRecording } from '../src/recording/validate.ts';
import { keeperBallFrame, keeperCountdown, keeperReleasePose } from '../src/render/keeper.ts';
import { createFootballMoments } from '../src/render/match-atmosphere.ts';
import { crossedAudioEvents } from '../src/audio/playback-audio.ts';
import { eventSoundCues } from '../src/audio/stadium-sounds.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { cloneState } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import { TICK_RATE, KEEPER } from '../src/sim/rules.ts';
import { parseModelDecision, RESPONSE_JSON_SCHEMA } from '../src/protocol/schema.ts';
import type { Recording } from '../src/recording/record.ts';

const fixture = createKeeperFixture();

describe('keeper recording and display boundaries', () => {
  it('exports, imports and exactly replays the honestly labelled pickup/catch/distribution sequence', () => {
    const record = parseRecording(JSON.parse(JSON.stringify(fixture)));
    expect(record.kind).toBe('fixture');
    expect(record.generation).toBeUndefined();
    expect(stateHash(verifyRecording(record))).toBe(record.finalHash);
    expect(
      record.events.filter((event) => ['order_failed', 'keeper_violation'].includes(event.type)),
    ).toEqual([]);
    expect(
      record.events
        .filter((event) => event.type === 'keeper_release')
        .map((event) => event.delivery),
    ).toEqual(['roll', 'throw']);
    expect(
      record.events.filter((event) => event.type === 'receive').map((event) => event.playerId),
    ).toEqual(['coral-3', 'coral-6']);
    expect(record.events.filter((event) => event.type === 'save')).toHaveLength(1);
    expect(
      createFootballMoments(record).filter((moment) => moment.type === 'good-pass'),
    ).toMatchObject([
      { playerId: 'coral-3', otherPlayerId: 'coral-1' },
      { playerId: 'coral-6', otherPlayerId: 'coral-1' },
    ]);
  });

  it('does not interpolate a same-owner pickup before the real action or mutate canonical frames', () => {
    const before = sample(fixture, 0.999 / TICK_RATE);
    const after = sample(fixture, 1 / TICK_RATE);
    expect(before.owner).toBe(after.owner);
    expect(before.handControl).toBeNull();
    expect(before.ball.z).toBe(fixture.initial.ball.position.z);
    expect(after.handControl?.kind).toBe('pickup');
    expect(after.ball.z).toBe(KEEPER.handHeight);
    const original = JSON.stringify(after);
    expect(keeperBallFrame(after, false).ball.z).toBe(after.handControl!.height);
    expect(keeperBallFrame(after, true)).toBe(after);
    expect(JSON.stringify(after)).toBe(original);
    const settled = sample(fixture, 2);
    expect(keeperBallFrame(settled, false).ball.z).toBe(KEEPER.handHeight);
  });

  it('preserves a discrete same-owner put-down at its real replay frame', () => {
    const state = cloneState(fixture.initial);
    const record: Recording = {
      ...fixture,
      initial: cloneState(state),
      decisions: [],
      frames: [capture(state)],
      events: [],
    };
    for (let tick = 0; tick < 63; tick++) {
      if (tick === 0 || tick === 60) {
        record.decisions.push({
          tick,
          fallback: [],
          batches: applyDecision(
            state,
            {
              ...emptyBatch(state, 'coral'),
              orders: [{ type: tick === 0 ? 'pickup' : 'put_down', playerId: 'coral-1' }],
            },
            emptyBatch(state, 'cyan'),
          ),
        });
      }
      step(state);
      record.frames.push(capture(state));
    }
    record.events = state.events;
    record.durationTicks = state.tick;
    record.finalHash = stateHash(state);
    expect(() => verifyRecording(parseRecording(record))).not.toThrow();
    const before = sample(record, 60.99 / TICK_RATE),
      after = sample(record, 61 / TICK_RATE);
    expect(before.owner).toBe(after.owner);
    expect(before.handControl).not.toBeNull();
    expect(after.handControl).toBeNull();
    expect(before.ball.z).toBe(KEEPER.handHeight);
    expect(after.ball.z).toBe(fixture.initial.ball.position.z);
  });

  it('signals only the final five playing seconds and survives arbitrary seek order', () => {
    const held = sample(fixture, 2);
    const countdownAt = (elapsed: number) =>
      keeperCountdown({ ...held, playingTicks: held.handControl!.sincePlayingTick + elapsed });
    expect(countdownAt(179)).toBeNull();
    expect(countdownAt(180)).toBe(5);
    expect(countdownAt(240)).toBe(4);
    expect(countdownAt(479)).toBe(1);
    expect(countdownAt(480)).toBe(0);
    expect(countdownAt(180)).toBe(5);
    expect(keeperCountdown({ ...held, handControl: null })).toBeNull();
    const release = fixture.events.find((event) => event.type === 'keeper_release')!;
    expect(
      keeperReleasePose(fixture, sample(fixture, release.tick / TICK_RATE), 'coral-1'),
    ).toBeNull();
    expect(
      keeperReleasePose(fixture, sample(fixture, (release.tick + 1) / TICK_RATE), 'coral-1')
        ?.delivery,
    ).toBe('roll');
  });

  it('sounds catches only on physical action frames; backward seeks and fast playback do not replay them', () => {
    const save = fixture.events.find((event) => event.type === 'save')!;
    expect(eventSoundCues(save)).toMatchObject([{ sound: 'catch', gain: 0.13 }]);
    expect(crossedAudioEvents([save], save.tick, save.tick + 0.99, 1)).toEqual([]);
    expect(crossedAudioEvents([save], save.tick, save.tick + 1, 1)).toEqual([save]);
    expect(crossedAudioEvents([save], save.tick + 2, save.tick, 1)).toEqual([]);
    expect(crossedAudioEvents([save], save.tick, save.tick + 1, 4)).toEqual([]);
  });

  it.each([
    'old-engine',
    'outfield-hands',
    'no-owner',
    'future-timer',
    'outside-area',
    'bad-delivery',
    'delivery-range',
    'outfield-action',
    'non-finite',
  ] as const)('rejects %s at import', (kind) => {
    const record = structuredClone(fixture);
    const held = record.frames.find((frame) => frame.handControl)!;
    if (kind === 'old-engine') Object.assign(record, { engine: 'football-0.5' });
    if (kind === 'outfield-hands') held.owner = 'coral-2';
    if (kind === 'no-owner') held.owner = null;
    if (kind === 'future-timer') held.handControl!.sincePlayingTick = held.playingTicks + 1;
    if (kind === 'outside-area') held.ball.x = 50;
    if (kind === 'bad-delivery')
      delete record.events.find((event) => event.type === 'keeper_release')!.delivery;
    if (kind === 'delivery-range') {
      const order = record.decisions
        .flatMap((entry) => entry.batches[0].orders)
        .find((order) => order.type === 'distribute')!;
      if (order.type === 'distribute') order.loft = 1;
    }
    if (kind === 'outfield-action') record.decisions[0]!.batches[0].orders[0]!.playerId = 'coral-2';
    if (kind === 'non-finite') held.ball.z = Infinity;
    expect(() => parseRecording(record)).toThrow();
  });

  it('uses the same bounded distribution schema with runtime delivery and identity checks', () => {
    const state = cloneState(fixture.initial);
    const schemaBefore = JSON.stringify(RESPONSE_JSON_SCHEMA);
    const decision = {
      batch: {
        ...emptyBatch(state, 'coral'),
        orders: [
          {
            type: 'distribute',
            playerId: 'coral-1',
            delivery: 'roll',
            target: { x: 20, y: 34 },
            speed: 12,
            loft: 0,
          },
        ],
      },
      intent: '',
      memory: {
        plan: '',
        review: '',
        ballPlayerId: 'coral-1',
        pass: null,
        assignments: [],
        threats: [],
      },
    };
    expect(() => parseModelDecision(decision, state, 'coral')).not.toThrow();
    decision.batch.orders[0]!.loft = 1;
    expect(() => parseModelDecision(decision, state, 'coral')).toThrow();
    decision.batch.orders[0]!.loft = 0;
    decision.batch.tick++;
    expect(() => parseModelDecision(decision, state, 'coral')).toThrow(/stale/);
    expect(JSON.stringify(RESPONSE_JSON_SCHEMA)).toBe(schemaBefore);
  });
});
