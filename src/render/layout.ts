import { FIELD } from '../sim/rules.ts';
import type { Vec2 } from '../sim/types.ts';

export const STADIUM_SIZE = { width: 960, height: 660 } as const;
const PIXELS_PER_METRE = 7;
export const PITCH_LAYOUT = {
  left: 112,
  top: 90,
  pixelsPerMetre: PIXELS_PER_METRE,
  width: FIELD.length * PIXELS_PER_METRE,
  height: FIELD.width * PIXELS_PER_METRE,
} as const;

/** Drawing alone snaps to pixels; simulation coordinates retain full precision. */
export function worldToScreen(position: Vec2): Vec2 {
  return {
    x: Math.round(PITCH_LAYOUT.left + position.x * PITCH_LAYOUT.pixelsPerMetre),
    y: Math.round(PITCH_LAYOUT.top + position.y * PITCH_LAYOUT.pixelsPerMetre),
  };
}
