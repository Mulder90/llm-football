import { expect, it } from 'vitest';
import { createCarryAndChipFixture } from '../src/fixtures/carry-and-chip.ts';
import { sample, stateHash, verifyRecording } from '../src/recording/record.ts';
import { parseRecording } from '../src/recording/validate.ts';
import { BALL_CONTROL, TICK_RATE } from '../src/sim/rules.ts';

it('carries the owned ball into space, chips over a defender and replays the receiver’s run', () => {
  const recording = createCarryAndChipFixture();
  expect(recording.kind).toBe('fixture');
  expect(recording.description).toContain('Scripted practice, not LLM-controlled');
  expect(recording.generation).toBeUndefined();
  const carrierIndex = recording.initial.players.findIndex((player) => player.id === 'coral-7');
  const kick = recording.events.find((event) => event.type === 'kick')!;
  const beforeKick = sample(recording, kick.tick / TICK_RATE);
  expect(beforeKick.owner).toBe('coral-7');
  expect(
    beforeKick.players[carrierIndex]!.position.x -
      recording.initial.players[carrierIndex]!.position.x,
  ).toBeGreaterThan(9.5);
  expect(
    recording.frames
      .filter((frame) => frame.tick <= kick.tick)
      .every((frame) => frame.owner === 'coral-7'),
  ).toBe(true);
  expect(Math.max(...recording.frames.map((frame) => frame.ball.z))).toBeGreaterThan(
    BALL_CONTROL.bodyHeight,
  );
  expect(
    recording.events.some((event) => event.type === 'receive' && event.playerId === 'coral-9'),
  ).toBe(true);
  expect(recording.events.some((event) => event.type === 'block')).toBe(false);
  const imported = parseRecording(JSON.parse(JSON.stringify(recording)));
  const final = verifyRecording(imported);
  expect(final.ball.owner).toBe('coral-9');
  expect(final.players.find((player) => player.id === 'coral-9')!.position.x).toBeGreaterThan(73);
  expect(final.playingTicks).toBe(8 * TICK_RATE);
  expect(stateHash(final)).toBe(createCarryAndChipFixture().finalHash);
});
