import { describe, expect, it } from 'vitest';
import { drawPixelArc, drawPixelOutline } from '../src/render/pixels.ts';

function paintedPixels(draw: (context: CanvasRenderingContext2D) => void): Set<string> {
  const pixels = new Set<string>();
  draw({
    fillStyle: '',
    fillRect(x: number, y: number, width: number, height: number) {
      expect([x, y, width, height].every(Number.isInteger)).toBe(true);
      for (let row = y; row < y + height; row++)
        for (let column = x; column < x + width; column++) pixels.add(`${column},${row}`);
    },
  } as unknown as CanvasRenderingContext2D);
  return pixels;
}

describe('pixel pitch markings', () => {
  it('draws the same penalty rectangle from either goal-line direction', () => {
    const left = paintedPixels((context) => drawPixelOutline(context, 10, 20, 30, 40, 'chalk'));
    const right = paintedPixels((context) => drawPixelOutline(context, 40, 20, -30, 40, 'chalk'));
    expect(right).toEqual(left);
    expect(left.has('25,40')).toBe(false);
    expect(left.has('10,40')).toBe(true);
  });

  it('keeps penalty arcs mirrored when the right-facing arc crosses angle zero', () => {
    const right = paintedPixels((context) =>
      drawPixelArc(context, 0, 0, 20, -0.925, 0.925, 'chalk'),
    );
    const left = paintedPixels((context) =>
      drawPixelArc(context, 0, 0, 20, Math.PI - 0.925, Math.PI + 0.925, 'chalk'),
    );
    expect(right.size).toBeGreaterThan(0);
    expect([...right].every((pixel) => Number(pixel.split(',')[0]) > 0)).toBe(true);
    const mirrored = new Set(
      [...right].map((pixel) => {
        const [x, y] = pixel.split(',').map(Number);
        return `${-x! - 1},${y}`;
      }),
    );
    expect(left).toEqual(mirrored);
  });
});
