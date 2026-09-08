import type { Team } from '../sim/types.ts';

export type KitPalette = { highlight: string; shirt: string; shade: string; boots: string };
export const TEAM_KITS: Record<Team, KitPalette> = {
  coral: { highlight: '#ff9780', shirt: '#ec6e60', shade: '#943f46', boots: '#ffbc9b' },
  cyan: { highlight: '#99e2d8', shirt: '#54bbc6', shade: '#2a7189', boots: '#b9f1e3' },
};

export type RobotHelmet = 'round' | 'square' | 'twin';
export type RobotPixel = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => void;
const OUTLINE = '#122b35';

/** Shared helmet construction for players, seated substitutes and coaches. */
export function drawRobotHelmetShell(
  pixel: RobotPixel,
  helmet: RobotHelmet,
  kit: KitPalette,
): void {
  if (helmet === 'round') {
    pixel(-7, -25, 15, 15, OUTLINE);
    pixel(-9, -23, 19, 11, OUTLINE);
    pixel(-7, -23, 15, 12, kit.shirt);
    pixel(-8, -22, 17, 9, kit.shirt);
    pixel(-5, -24, 11, 2, kit.highlight);
  } else if (helmet === 'square') {
    pixel(-9, -24, 19, 14, OUTLINE);
    pixel(-8, -23, 17, 12, kit.shirt);
    pixel(-7, -22, 15, 2, kit.highlight);
    pixel(-11, -20, 3, 6, OUTLINE);
    pixel(9, -20, 3, 6, OUTLINE);
    pixel(-10, -19, 2, 4, kit.highlight);
    pixel(9, -19, 2, 4, kit.shade);
    pixel(-2, -27, 5, 3, OUTLINE);
    pixel(-1, -26, 3, 3, kit.highlight);
  } else {
    pixel(-7, -27, 15, 17, OUTLINE);
    pixel(-6, -26, 13, 15, kit.shirt);
    pixel(-5, -25, 11, 2, '#eff0cb');
    pixel(-9, -21, 3, 7, OUTLINE);
    pixel(7, -21, 3, 7, OUTLINE);
    pixel(-8, -20, 2, 5, kit.highlight);
    pixel(7, -20, 2, 5, kit.shade);
  }
}

export function drawRobotAntenna(
  pixel: RobotPixel,
  helmet: RobotHelmet,
  light: string,
  sway = 0,
): void {
  if (helmet === 'round') {
    pixel(sway, -29, 1, 4, OUTLINE);
    pixel(-1 + sway, -31, 4, 3, light);
  } else if (helmet === 'twin') {
    for (const side of [-1, 1]) {
      pixel(side * 4 + sway, -30, 1, 4, OUTLINE);
      pixel(side * 4 - 1 + sway, -32, 3, 3, light);
    }
  }
}
