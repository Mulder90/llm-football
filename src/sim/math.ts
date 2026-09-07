import { NUMERIC_TOLERANCE } from './rules.ts';
import type { Vec2 } from './types.ts';

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function vectorLength(vector: Vec2): number {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

export function distanceBetween(first: Vec2, second: Vec2): number {
  return vectorLength({ x: first.x - second.x, y: first.y - second.y });
}

export function unitVector(vector: Vec2): Vec2 {
  const magnitude = vectorLength(vector);
  if (magnitude <= NUMERIC_TOLERANCE.vectorLength) return { x: 0, y: 0 };
  return { x: vector.x / magnitude, y: vector.y / magnitude };
}

/** xorshift32; the shifts are algorithm parameters, not football tuning. */
export function nextRandom(seed: number): { seed: number; value: number } {
  const unsignedIntegerRange = 2 ** 32;
  const nonzeroSeed = 1;
  let nextSeed = seed >>> 0 || nonzeroSeed;
  nextSeed ^= nextSeed << 13;
  nextSeed ^= nextSeed >>> 17;
  nextSeed ^= nextSeed << 5;
  return {
    seed: nextSeed >>> 0,
    value: (nextSeed >>> 0) / unsignedIntegerRange,
  };
}

/** First segment/circle entry as a fraction of the segment, including overlap. */
export function contactTime(from: Vec2, to: Vec2, center: Vec2, radius: number): number | null {
  const travel = { x: to.x - from.x, y: to.y - from.y };
  const offset = { x: from.x - center.x, y: from.y - center.y };
  const distanceOutsideCircle = offset.x ** 2 + offset.y ** 2 - radius ** 2;
  if (distanceOutsideCircle <= 0) return 0;

  // Solve a*t² + b*t + c = 0 for the first intersection of the swept segment.
  const quadratic = travel.x * travel.x + travel.y * travel.y;
  if (quadratic < NUMERIC_TOLERANCE.squaredVectorLength) return null;
  const linear = 2 * (offset.x * travel.x + offset.y * travel.y);
  const discriminant = linear * linear - 4 * quadratic * distanceOutsideCircle;
  if (discriminant < 0) return null;

  const firstIntersection = (-linear - Math.sqrt(discriminant)) / (2 * quadratic);
  return firstIntersection >= 0 && firstIntersection <= 1 ? firstIntersection : null;
}
