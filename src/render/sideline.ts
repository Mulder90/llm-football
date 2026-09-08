import type { Frame } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { Team } from '../sim/types.ts';
import { MOMENT_DURATION_TICKS, type MatchAtmosphere } from './match-atmosphere.ts';
import { drawPixelRect } from './pixels.ts';
import { supporterMood } from './stadium-atmosphere.ts';
import {
  drawRobotHelmetShell,
  drawRobotAntenna,
  TEAM_KITS,
  type RobotHelmet,
  type RobotPixel,
} from './robot-art.ts';

// The field ends at y=566. A shared apron leads to north-facing, cutaway dugouts.
// The south rail starts at y=612; the central tunnel stays clear.
const SIDELINES = [
  { team: 'coral', dugoutX: 307, coachX: 285, equipmentX: 409 },
  { team: 'cyan', dugoutX: 550, coachX: 675, equipmentX: 536 },
] as const;
const SEATS = [16, 40, 64, 88] as const;
const INK = '#122b35';
const FLOOR = '#30454a';
const STEEL = '#536b70';
type Mood = ReturnType<typeof supporterMood>;

// Pitch players are deliberately exaggerated for following play. Supporting robots use
// the same shapes at a quieter scale, closer to the spectators surrounding the dugouts.
const STAFF_SCALE = 0.58;
function staffPixel(context: CanvasRenderingContext2D, x: number, y: number): RobotPixel {
  return (dx, dy, width, height, color) => {
    const left = Math.round(dx * STAFF_SCALE);
    const top = Math.round(dy * STAFF_SCALE);
    drawPixelRect(
      context,
      x + left,
      y + top,
      Math.max(1, Math.round((dx + width) * STAFF_SCALE) - left),
      Math.max(1, Math.round((dy + height) * STAFF_SCALE) - top),
      color,
    );
  };
}

/** Only completed, still-visible outcomes may change the touchline's allegiances. */
export function sidelineMood(
  team: Team,
  frame: Frame,
  atmosphere: MatchAtmosphere,
  reducedMotion: boolean,
): Mood {
  if (reducedMotion) return 'idle';
  const candidate = atmosphere.moment;
  const moment =
    candidate &&
    candidate.tick <= frame.tick &&
    candidate.tick >= frame.phase.sinceTick &&
    frame.tick - candidate.tick < MOMENT_DURATION_TICKS[candidate.type]
      ? candidate
      : null;
  return supporterMood(team, {
    attack: frame.phase.type === 'open_play' ? atmosphere.attack : null,
    moment,
  });
}

/** Cache only the ground, cushions and rear structure. Front edges are painted after people. */
export function drawSidelineStructures(context: CanvasRenderingContext2D): void {
  for (const { team, dugoutX: x, coachX, equipmentX } of SIDELINES) {
    const kit = TEAM_KITS[team];
    const left = Math.min(x - 5, coachX - 10);
    const right = Math.max(x + 104, coachX + 11);
    // One continuous service apron, with a broken technical-area marking at its field edge.
    drawPixelRect(context, left, 575, right - left, 34, '#293e42');
    for (let mark = left + 5; mark < right - 5; mark += 15)
      drawPixelRect(context, mark, 576, 7, 1, '#687c70');
    drawPixelRect(context, x + 3, 584, 103, 25, '#182c32');
    drawPixelRect(context, x, 580, 102, 27, INK);
    drawPixelRect(context, x + 2, 581, 98, 24, FLOOR);
    drawPixelRect(context, x + 3, 582, 96, 4, '#3c5152');
    // Open north edge, floor joints, and a shadow below the shallow rear canopy.
    drawPixelRect(context, x + 2, 580, 98, 1, '#74867c');
    drawPixelRect(context, x + 3, 600, 96, 5, '#253b41');
    for (const seat of SEATS) {
      drawPixelRect(context, x + seat - 6, 593, 13, 8, INK);
      drawPixelRect(context, x + seat - 5, 594, 11, 5, '#4b6468');
      drawPixelRect(context, x + seat - 4, 594, 9, 1, '#6b8380');
      drawPixelRect(context, x + seat - 5, 599, 11, 2, kit.shade);
    }
    // A bottle crate and a folded towel live beside the entrance, not in the walkway.
    drawPixelRect(context, equipmentX - 1, 600, 12, 7, '#182e35');
    drawPixelRect(context, equipmentX, 600, 10, 5, '#536964');
    for (const offset of [1, 5]) {
      drawPixelRect(context, equipmentX + offset, 594, 3, 7, '#759e9b');
      drawPixelRect(context, equipmentX + offset + 1, 593, 1, 2, '#c9d7bb');
    }
    drawPixelRect(context, x + (team === 'coral' ? 83 : 11), 596, 10, 4, '#a0b2a4');
  }
}

/** Rear panels dominate; an occasional side glance reveals one edge of the visor. */
function drawTouchlineHead(pixel: RobotPixel, helmet: RobotHelmet, team: Team, turn: number): void {
  const kit = TEAM_KITS[team];
  drawRobotHelmetShell(pixel, helmet, kit);
  pixel(-4, -21, 9, 7, kit.shade);
  pixel(-3, -20, 7, 2, INK);
  pixel(-2, -16, 5, 1, kit.highlight);
  if (turn !== 0) {
    const sideX = turn < 0 ? -7 : 5;
    pixel(sideX, -21, 3, 8, '#183342');
    pixel(sideX + (turn < 0 ? 0 : 1), -19, 2, 2, '#e4ffe8');
  }
  drawRobotAntenna(pixel, helmet, kit.highlight);
}

function drawCoach(
  context: CanvasRenderingContext2D,
  x: number,
  team: Team,
  mood: Mood,
  tick: number,
  reducedMotion: boolean,
): void {
  const kit = TEAM_KITS[team];
  const localTick = tick + (team === 'cyan' ? 163 : 0);
  const glance = !reducedMotion && localTick % (9 * TICK_RATE) < 0.9 * TICK_RATE;
  const gesture = !reducedMotion && localTick % (2.8 * TICK_RATE) < 0.7 * TICK_RATE;
  const turn = glance ? (team === 'coral' ? 1 : -1) : 0;
  const slump = mood === 'disbelief' ? 2 : 0;
  const rect = staffPixel(context, x, 600);
  rect(-8, 0, 17, 3, '#1a3034');
  for (const side of [-1, 1]) {
    rect(side * 4 - 1, -5, 3, 6, INK);
    rect(side * 4 - 2, 0, 5, 2, '#718984');
  }
  rect(-6, -13 + slump, 13, 10, INK);
  rect(-5, -12 + slump, 11, 8, kit.shade);
  rect(-4, -11 + slump, 2, 6, kit.shirt);
  rect(3, -11 + slump, 1, 6, kit.highlight);
  for (const side of [-1, 1]) {
    const lift =
      mood === 'cheer'
        ? 11
        : mood === 'disbelief'
          ? 9
          : side === (team === 'coral' ? 1 : -1) &&
              gesture &&
              (mood === 'urge' || mood === 'acknowledge' || mood === 'relief')
            ? 7
            : 0;
    rect(side < 0 ? -9 : 7, -11 - lift + slump, 3, 8 + lift, INK);
    rect(side < 0 ? -8 : 7, -10 - lift + slump, 2, 6 + lift, kit.shade);
    rect(side < 0 ? -9 : 7, -12 - lift + slump, 3, 3, kit.highlight);
  }
  drawTouchlineHead(
    (dx, dy, w, h, color) => rect(dx + turn, dy + slump, w, h, color),
    team === 'coral' ? 'square' : 'round',
    team,
    turn,
  );
  // A coach's headset and plain clipboard identify a staff role without tactical decoration.
  rect(-10 + turn, -21 + slump, 2, 7, '#a8b9ac');
  rect(9 + turn, -21 + slump, 2, 7, '#4f6668');
  if (mood === 'idle' || mood === 'tense') {
    rect(team === 'coral' ? -11 : 7, -8, 6, 8, '#857b63');
    rect(team === 'coral' ? -10 : 8, -7, 4, 5, '#c3bb98');
  }
}

function drawBenchCrew(
  context: CanvasRenderingContext2D,
  x: number,
  team: Team,
  mood: Mood,
  frame: Frame,
  tick: number,
  reducedMotion: boolean,
  atmosphere: MatchAtmosphere,
): void {
  const kit = TEAM_KITS[team];
  const helmets: RobotHelmet[] = ['round', 'square', 'twin'];
  for (let person = 0; person < 3; person++) {
    const seat = team === 'coral' ? person : person + 1;
    const localTick = tick + person * 83 + (team === 'cyan' ? 137 : 0);
    const glance = !reducedMotion && localTick % (10 * TICK_RATE) < 0.7 * TICK_RATE;
    const briefGesture = !reducedMotion && localTick % (3.6 * TICK_RATE) < 0.65 * TICK_RATE;
    // A shared recorded incident starts individual reactions after small, fixed delays.
    // No remembered animation state: seeking to the same frame reconstructs the same pose.
    const delay = person * 7 + (team === 'cyan' ? 3 : 0);
    const waiting = atmosphere.moment && frame.tick - atmosphere.moment.tick < delay;
    const reaction = waiting ? 'idle' : mood;
    const rise = reaction === 'cheer' ? (person === 1 ? 3 : 1) : 0;
    const lean = person === 0 || reaction === 'tense' ? -1 : 0;
    const turn = glance ? (person === 1 ? -1 : 1) : 0;
    const rect = staffPixel(context, x + SEATS[seat]!, 600 - rise);
    // Bent legs project either side of the seat; the seat back occludes the lower torso.
    rect(-6, -3, 4, 4, INK);
    rect(3, -4 + (person % 2), 4, 4, INK);
    rect(-7, -1, 5, 2, kit.shade);
    rect(3, -2 + (person % 2), 5, 2, kit.shade);
    rect(-6, -9, 13, 9, INK);
    rect(-5, -8, 11, 7, person === 2 ? kit.shade : kit.shirt);
    rect(-3, -7, 7, 2, kit.highlight);
    for (const side of [-1, 1]) {
      const raised =
        reaction === 'cheer' ||
        (briefGesture &&
          side === (person % 2 === 0 ? -1 : 1) &&
          (reaction === 'acknowledge' || reaction === 'relief' || reaction === 'urge'));
      const handY = raised ? -21 : reaction === 'disbelief' && side < 0 ? -15 : -4;
      rect(side < 0 ? -9 : 7, Math.min(-7, handY), 3, Math.abs(handY + 7) + 3, INK);
      rect(side < 0 ? -8 : 7, Math.min(-6, handY + 1), 2, Math.abs(handY + 7) + 1, kit.shirt);
      rect(side < 0 ? -9 : 7, handY, 3, 3, kit.highlight);
    }
    drawTouchlineHead(
      (dx, dy, w, h, color) => rect(dx + turn, dy + 3 + lean, w, h, color),
      helmets[person]!,
      team,
      turn,
    );
    // Upholstered backs stay anchored when a substitute rises to celebrate.
    drawPixelRect(context, x + SEATS[seat]! - 6, 600, 13, 5, INK);
    drawPixelRect(context, x + SEATS[seat]! - 5, 601, 11, 3, '#4b6468');
    drawPixelRect(context, x + SEATS[seat]! - 4, 601, 9, 1, '#7c9189');
  }
}

function drawDugoutForeground(context: CanvasRenderingContext2D, x: number, team: Team): void {
  const kit = TEAM_KITS[team];
  // Flat roof strip at the south/rear edge: a deliberate cutaway keeps the occupants visible.
  drawPixelRect(context, x - 2, 605, 106, 5, INK);
  drawPixelRect(context, x - 1, 604, 104, 4, '#4a6266');
  drawPixelRect(context, x, 604, 102, 1, '#90a19a');
  drawPixelRect(context, x + 5, 607, 92, 1, kit.shade);
  for (const post of [x, x + 100]) {
    drawPixelRect(context, post, 581, 2, 24, INK);
    drawPixelRect(context, post, 582, 1, 21, STEEL);
  }
}

/** Watch time moves decorative limbs; recorded state alone determines their reaction. */
export function drawSidelines(
  context: CanvasRenderingContext2D,
  frame: Frame,
  atmosphere: MatchAtmosphere,
  animationTick: number,
  reducedMotion: boolean,
): void {
  for (const { team, dugoutX, coachX } of SIDELINES) {
    const mood = sidelineMood(team, frame, atmosphere, reducedMotion);
    drawCoach(context, coachX, team, mood, animationTick, reducedMotion);
    drawBenchCrew(context, dugoutX, team, mood, frame, animationTick, reducedMotion, atmosphere);
    drawDugoutForeground(context, dugoutX, team);
  }
}
