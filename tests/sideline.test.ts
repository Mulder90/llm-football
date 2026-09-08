import { describe, expect, it } from 'vitest';
import { capture, type Frame } from '../src/recording/record.ts';
import {
  MOMENT_DURATION_TICKS,
  type FootballMoment,
  type MatchAtmosphere,
} from '../src/render/match-atmosphere.ts';
import { drawSidelines, drawSidelineStructures, sidelineMood } from '../src/render/sideline.ts';
import { createMatch } from '../src/sim/state.ts';

const frame: Frame = {
  ...capture(createMatch()),
  tick: 100,
  phase: { type: 'open_play', sinceTick: 0 },
};
const calm: MatchAtmosphere = { attack: null, moment: null };
function moment(
  type: FootballMoment['type'],
  team: FootballMoment['team'] = 'coral',
): FootballMoment {
  return {
    id: `${type}:1`,
    type,
    team,
    tick: 100,
    playerId: null,
    otherPlayerId: null,
    position: { x: 80, y: 34 },
  };
}

type Rectangle = { x: number; y: number; w: number; h: number; color: string };
function paint(run: (context: CanvasRenderingContext2D) => void): Rectangle[] {
  const rectangles: Rectangle[] = [];
  const context = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rectangles.push({ x, y, w, h, color: this.fillStyle });
    },
  };
  run(context as unknown as CanvasRenderingContext2D);
  return rectangles;
}
function draw(atmosphere = calm, animationTick = 0, reducedMotion = false): Rectangle[] {
  return paint((context) =>
    drawSidelines(context, frame, atmosphere, animationTick, reducedMotion),
  );
}

describe('sideline presentation', () => {
  it('keeps club allegiances and reacts only to visible, current outcomes', () => {
    const goal = { ...calm, moment: moment('goal') };
    expect(sidelineMood('coral', frame, goal, false)).toBe('cheer');
    expect(sidelineMood('cyan', frame, goal, false)).toBe('disbelief');
    expect(sidelineMood('coral', { ...frame, tick: 99.99 }, goal, false)).toBe('idle');
    expect(
      sidelineMood('coral', { ...frame, tick: 100 + MOMENT_DURATION_TICKS.goal }, goal, false),
    ).toBe('idle');
    expect(
      sidelineMood(
        'coral',
        { ...frame, phase: { type: 'open_play', sinceTick: 101 } },
        goal,
        false,
      ),
    ).toBe('idle');
    expect(sidelineMood('cyan', frame, { ...calm, moment: moment('save', 'cyan') }, false)).toBe(
      'relief',
    );
    expect(sidelineMood('coral', frame, { ...calm, moment: moment('save', 'cyan') }, false)).toBe(
      'disbelief',
    );
    expect(sidelineMood('coral', frame, { ...calm, moment: moment('near-miss') }, false)).toBe(
      'disbelief',
    );
    expect(sidelineMood('cyan', frame, { ...calm, moment: moment('near-miss') }, false)).toBe(
      'relief',
    );
    const attack: MatchAtmosphere = { ...calm, attack: { team: 'coral', intensity: 0.6 } };
    expect(sidelineMood('coral', frame, attack, false)).toBe('urge');
    expect(sidelineMood('cyan', frame, attack, false)).toBe('tense');
    expect(sidelineMood('coral', { ...frame, half: 2 }, attack, false)).toBe('urge');
    expect(
      sidelineMood(
        'coral',
        { ...frame, phase: { type: 'halftime', sinceTick: 100, endsAtTick: 280 } },
        attack,
        false,
      ),
    ).toBe('idle');
  });

  it('seeks repeatably without changing inputs, and reduced motion stays completely static', () => {
    const goal = { ...calm, moment: moment('goal') };
    const before = JSON.stringify({ frame, goal });
    const first = draw(goal, 13.5);
    draw(calm, 600);
    expect(draw(goal, 13.5)).toEqual(first);
    expect(JSON.stringify({ frame, goal })).toBe(before);
    expect(draw(calm, 0, true)).toEqual(draw(goal, 900, true));
    expect(draw(calm, 0, true)).toEqual(
      draw({ ...calm, attack: { team: 'cyan', intensity: 1 } }, 20, true),
    );
    expect(draw(calm, 0)).not.toEqual(draw(calm, 60));
  });

  it('keeps every pose outside the field, banners, tunnel and south rail', () => {
    const atmospheres: MatchAtmosphere[] = [
      calm,
      { ...calm, attack: { team: 'coral', intensity: 1 } },
      { ...calm, attack: { team: 'cyan', intensity: 1 } },
      ...(['goal', 'save', 'near-miss', 'good-pass'] as const).flatMap((type) =>
        (['coral', 'cyan'] as const).map((team) => ({ ...calm, moment: moment(type, team) })),
      ),
    ];
    const rectangles = paint(drawSidelineStructures);
    for (const atmosphere of atmospheres)
      for (let tick = 0; tick < 360; tick += 13.5) rectangles.push(...draw(atmosphere, tick));
    const forbidden = [
      { x: 450, y: 572, w: 60, h: 81 }, // Tunnel and its aisle.
      { x: 126, y: 589, w: 122, h: 12 },
      { x: 719, y: 589, w: 122, h: 12 },
      { x: 854, y: 558, w: 40, h: 42 }, // Lower-right tree and trunk.
    ];
    for (const r of rectangles) {
      if (![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0)
        throw new Error(`Invalid sideline rectangle: ${JSON.stringify(r)}`);
      if (r.y < 569 || r.y + r.h > 611)
        throw new Error(`Sideline crossed pitch or rail clearance: ${JSON.stringify(r)}`);
      for (const area of forbidden)
        if (
          r.x < area.x + area.w &&
          r.x + r.w > area.x &&
          r.y < area.y + area.h &&
          r.y + r.h > area.y
        )
          throw new Error(`Sideline overlaps an existing stadium feature: ${JSON.stringify(r)}`);
    }
    expect(rectangles.length).toBeGreaterThan(0);
  });
});
