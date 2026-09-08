import { describe, expect, it } from 'vitest';
import { createCarryAndChipFixture } from '../src/fixtures/carry-and-chip.ts';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { sample, verifyRecording } from '../src/recording/record.ts';
import {
  actionAccentAt,
  drawActionAccent,
  drawCarryAccents,
} from '../src/render/action-accents.ts';
import { PITCH_LAYOUT, worldToScreen } from '../src/render/layout.ts';
import { createFootballMoments } from '../src/render/match-atmosphere.ts';

function drawing() {
  const rectangles: number[][] = [];
  const stack: number[] = [];
  const context = {
    globalAlpha: 1,
    fillStyle: '',
    save() {
      stack.push(this.globalAlpha);
    },
    restore() {
      this.globalAlpha = stack.pop()!;
    },
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(x: number, y: number, width: number, height: number) {
      expect([x, y, width, height, this.globalAlpha].every(Number.isFinite)).toBe(true);
      expect(width).toBeGreaterThanOrEqual(0);
      expect(height).toBeGreaterThanOrEqual(0);
      expect(this.globalAlpha).toBeGreaterThanOrEqual(0);
      expect(this.globalAlpha).toBeLessThanOrEqual(1);
      rectangles.push([x, y, width, height, this.globalAlpha]);
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, rectangles };
}

describe('playful action accents', () => {
  it('only marks a visible completed pass while the actual receiver retains possession', () => {
    const record = createPassingFixture();
    const moments = createFootballMoments(record);
    const pass = moments.find((moment) => moment.type === 'good-pass')!;
    const frame = {
      ...sample(record, (pass.tick + 4) / 60),
      tick: pass.tick + 4,
      owner: pass.playerId,
    };
    expect(actionAccentAt(record, { ...frame, tick: pass.tick - 0.01 }, moments)).toBeNull();
    expect(actionAccentAt(record, frame, moments)?.type).toBe('good-pass');
    expect(actionAccentAt(record, { ...frame, owner: null }, moments)).toBeNull();
    expect(actionAccentAt(record, { ...frame, tick: pass.tick + 40 }, [pass])).toBeNull();
    expect(
      actionAccentAt(
        record,
        { ...frame, phase: { type: 'open_play', sinceTick: pass.tick + 1 } },
        moments,
      ),
    ).toBeNull();
  });

  it('keeps punctuation on the grass and suppresses it when every nearby space contains a player', () => {
    const record = createPassingFixture();
    const moment = createFootballMoments(record).find((entry) => entry.type === 'good-pass')!;
    const frame = structuredClone(sample(record, (moment.tick + 5) / 60));
    frame.tick = moment.tick + 5;
    frame.owner = moment.playerId;
    const accent = actionAccentAt(record, frame, [moment])!;
    expect(accent.position.x).toBeGreaterThanOrEqual(PITCH_LAYOUT.left + 10);
    expect(accent.position.y).toBeGreaterThanOrEqual(PITCH_LAYOUT.top + 10);
    const index = record.initial.players.findIndex((player) => player.id === moment.playerId);
    const receiver = frame.players[index]!;
    const ground = worldToScreen(receiver.position);
    const blockers = frame.players.filter((_, otherIndex) => otherIndex !== index).slice(0, 3);
    for (const [blockerIndex, target] of [
      { x: ground.x, y: ground.y - 37 },
      { x: ground.x + 25, y: ground.y - 22 },
      { x: ground.x - 25, y: ground.y - 22 },
    ].entries()) {
      blockers[blockerIndex]!.position = {
        x: (target.x - PITCH_LAYOUT.left) / PITCH_LAYOUT.pixelsPerMetre,
        y: (target.y + 16 - PITCH_LAYOUT.top) / PITCH_LAYOUT.pixelsPerMetre,
      };
    }
    expect(actionAccentAt(record, frame, [moment])).toBeNull();
  });

  it('draws carry puffs only for actual fast carrying and clears them on release or reduced motion', () => {
    const record = createCarryAndChipFixture();
    const before = JSON.stringify(record);
    const frame = sample(record, 1);
    const fast = drawing();
    drawCarryAccents(fast.context, record, frame, false);
    expect(fast.rectangles.length).toBeGreaterThan(0);
    expect(fast.context.globalAlpha).toBe(1);
    for (const [candidate, reduced] of [
      [{ ...frame, owner: null }, false],
      [record.frames[0]!, false],
      [frame, true],
    ] as const) {
      const output = drawing();
      drawCarryAccents(output.context, record, candidate, reduced);
      expect(output.rectangles).toEqual([]);
    }
    expect(JSON.stringify(record)).toBe(before);
    expect(verifyRecording(record).tick).toBe(record.durationTicks);
  });

  it('keeps every mark bounded and repeatable, with static reduced-motion poses', () => {
    for (const type of ['save', 'near-miss', 'good-pass'] as const) {
      const reducedFrames: number[][][] = [];
      for (const ageTicks of [0, 4, 12, 24, 38]) {
        const accent = { type, team: 'coral' as const, ageTicks, position: { x: 400, y: 300 } };
        const first = drawing();
        const repeat = drawing();
        drawActionAccent(first.context, accent, false);
        drawActionAccent(repeat.context, accent, false);
        expect(first.rectangles).toEqual(repeat.rectangles);
        expect(first.context.globalAlpha).toBe(1);
        const reduced = drawing();
        drawActionAccent(reduced.context, accent, true);
        reducedFrames.push(reduced.rectangles);
      }
      expect(
        reducedFrames.every(
          (rectangles) => JSON.stringify(rectangles) === JSON.stringify(reducedFrames[0]),
        ),
      ).toBe(true);
    }
  });
});
