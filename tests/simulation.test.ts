import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import { applyDecision, emptyBatch, validateBatch } from '../src/sim/orders.ts';
import { contactTime, nextRandom } from '../src/sim/math.ts';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { sample, stateHash, verifyRecording } from '../src/recording/record.ts';

describe('deterministic football boundaries', () => {
  it('records and replays the same passing sequence in a headless runtime', () => {
    const firstRecording = createPassingFixture(),
      secondRecording = createPassingFixture();
    expect(firstRecording).toEqual(secondRecording);
    expect(verifyRecording(firstRecording).players).toHaveLength(22);
    expect(firstRecording.durationTicks).toBe(1440);
    expect(
      firstRecording.events.filter((event) => event.type === 'kick').length,
    ).toBeGreaterThanOrEqual(6);
    expect(firstRecording.events.some((event) => event.type === 'interception')).toBe(true);
  });
  it('keeps canonical state unchanged under 30, 60, 144 Hz, seeking and dropped frames', () => {
    const recording = createPassingFixture(),
      before = JSON.stringify(recording);
    for (const hz of [30, 60, 144]) for (let i = 0; i <= 2 * hz; i++) sample(recording, i / hz);
    for (const t of [17, 0, 24, 8.5, 100, -1]) sample(recording, t);
    expect(JSON.stringify(recording)).toBe(before);
    expect(stateHash(verifyRecording(recording))).toBe(recording.finalHash);
    expect(sample(recording, 100).tick).toBe(1440);
  });
  it('rejects non-finite values, stale decisions, wrong teams, duplicates and unknown versions atomically', () => {
    const state = createMatch(),
      before = stateHash(state);
    const valid = {
      ...emptyBatch(state, 'coral'),
      orders: [{ type: 'move', playerId: 'coral-7', target: { x: 45, y: 34 }, pace: 1 }],
    };
    for (const raw of [
      { ...valid, version: 2 },
      { ...valid, tick: 1 },
      { ...valid, decisionId: 1 },
      { ...valid, team: 'cyan' },
      { ...valid, orders: [valid.orders[0], valid.orders[0]] },
      { ...valid, orders: [{ ...valid.orders[0], pace: NaN }] },
      { ...valid, orders: [{ ...valid.orders[0], target: { x: Infinity, y: 0 } }] },
      { ...valid, orders: [{ ...valid.orders[0], playerId: 'cyan-7' }] },
    ])
      expect(() => validateBatch(raw, state, 'coral')).toThrow();
    expect(() => applyDecision(state, valid, { ...emptyBatch(state, 'cyan'), tick: 10 })).toThrow();
    expect(stateHash(state)).toBe(before);
  });
  it('continues omitted movement, brakes on expiry and consumes impossible kicks', () => {
    const state = createMatch(),
      player = state.players.find((player) => player.id === 'coral-2')!;
    applyDecision(
      state,
      {
        ...emptyBatch(state, 'coral'),
        orders: [{ type: 'move', playerId: player.id, target: { x: 80, y: 10 }, pace: 1 }],
      },
      emptyBatch(state, 'cyan'),
    );
    for (let i = 0; i < 60; i++) step(state);
    applyDecision(state, emptyBatch(state, 'coral'), emptyBatch(state, 'cyan'));
    for (let i = 0; i < 180; i++) step(state);
    expect(player.position.x).toBeGreaterThan(30);
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    applyDecision(
      state,
      {
        ...emptyBatch(state, 'coral'),
        orders: [{ type: 'kick', playerId: player.id, target: { x: 105, y: 34 }, speed: 20 }],
      },
      emptyBatch(state, 'cyan'),
    );
    step(state);
    expect(player.active).toBe(null);
    expect(state.events.at(-1)?.type).toBe('order_failed');
  });
  it('uses swept contacts and handles ties with explicit seeded randomness', () => {
    expect(contactTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, 1)).toBe(0.4);
    expect(contactTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 2 }, 1)).toBe(null);
    expect(nextRandom(1).seed).toBe(270369);
    expect(nextRandom(270369).seed).toBe(67634689);
    const state = createMatch();
    state.ball.owner = null;
    state.ball.lastTouch = null;
    state.ball.position = { x: 50, y: 34, z: 0.11 };
    state.players.find((player) => player.id === 'coral-10')!.position = { x: 50, y: 34 };
    state.players.find((player) => player.id === 'cyan-10')!.position = { x: 50, y: 34 };
    const seed = state.seed;
    step(state);
    expect(state.seed).not.toBe(seed);
  });
  it('stops only when the whole ball is outside the pitch', () => {
    const state = createMatch();
    state.ball.owner = null;
    state.ball.position = { x: 50, y: -0.1, z: 0.11 };
    step(state);
    expect(state.phase.type).toBe('open_play');
    state.ball.position.y = -0.12;
    step(state);
    expect(state.phase.type).toBe('restart_setup');
    const tick = state.tick;
    step(state);
    expect(state.tick).toBe(tick + 1);
  });
});
