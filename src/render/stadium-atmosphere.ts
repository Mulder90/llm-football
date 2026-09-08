import type { Frame } from '../recording/record.ts';
import type { Team } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { PITCH_LAYOUT, worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';
import { MOMENT_DURATION_TICKS } from './match-atmosphere.ts';
import type { MatchAtmosphere } from './match-atmosphere.ts';
import { goalWatchSeconds, GOAL_PRESENTATION } from './celebration.ts';

const SUPPORTERS = {
  coral: { shirt: '#cc6559', bright: '#f7a184', dark: '#773e43', banner: '#963f42' },
  cyan: { shirt: '#54aeba', bright: '#9ae0dc', dark: '#305b72', banner: '#326c82' },
} as const;
const SKIN_COLORS = ['#e2c39c', '#b68c70', '#815e50', '#e9d6b6'];
const STAND_COLOR = '#182d3b';
const ROW_HEIGHT = 12;
const SEAT_SPACING = 9;
const STANDS = [
  { x: 112, y: 13, width: 735, height: 49 },
  { x: 112, y: 600, width: 735, height: 49 },
  { x: 12, y: 110, width: 55, height: 432 },
  { x: 893, y: 110, width: 55, height: 432 },
] as const;
const FLAGS = [
  { x: 148, y: 66, direction: 1, team: 'coral' },
  { x: 356, y: 66, direction: 1, team: 'coral' },
  { x: 615, y: 66, direction: 1, team: 'cyan' },
  { x: 815, y: 66, direction: 1, team: 'cyan' },
  { x: 148, y: 649, direction: 1, team: 'coral' },
  { x: 815, y: 649, direction: 1, team: 'cyan' },
  { x: 72, y: 204, direction: -1, team: 'coral' },
  { x: 72, y: 466, direction: -1, team: 'coral' },
  { x: 887, y: 204, direction: 1, team: 'cyan' },
  { x: 887, y: 466, direction: 1, team: 'cyan' },
] as const;
const CORNER_FLAGS = [
  { x: PITCH_LAYOUT.left, y: PITCH_LAYOUT.top, direction: -1 },
  { x: PITCH_LAYOUT.left + PITCH_LAYOUT.width, y: PITCH_LAYOUT.top, direction: 1 },
  { x: PITCH_LAYOUT.left, y: PITCH_LAYOUT.top + PITCH_LAYOUT.height, direction: -1 },
  {
    x: PITCH_LAYOUT.left + PITCH_LAYOUT.width,
    y: PITCH_LAYOUT.top + PITCH_LAYOUT.height,
    direction: 1,
  },
] as const;
const FLAG_WIND = {
  wavePeriodTicks: 1.9 * TICK_RATE,
  gustPeriodTicks: 6.4 * TICK_RATE,
  edgeLiftPixels: 3,
  cornerPoleHeight: 10,
  cornerClothWidth: 8,
} as const;
const TREES = [
  { x: 40, y: 42 },
  { x: 910, y: 42 },
  { x: 40, y: 605 },
  { x: 910, y: 605 },
  { x: 76, y: 75 },
  { x: 874, y: 575 },
] as const;
const TREE_WIND = {
  gustPeriodTicks: 8 * TICK_RATE,
  swayPeriodTicks: 3 * TICK_RATE,
  flutterPeriodTicks: 1.7 * TICK_RATE,
  maximumSwayPixels: 3,
} as const;

// Coordinate-only decoration: this never consumes the match's seeded randomness.
export function decorationNoise(x: number, y: number, seed = 0): number {
  let hash = Math.imul(x + seed, 374761393) + Math.imul(y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/** Grounded parts remain in the cache; no old canopy pose can show through a new one. */
export function drawTreeBases(context: CanvasRenderingContext2D): void {
  for (const { x, y } of TREES) {
    drawPixelRect(context, x - 12, y + 15, 31, 7, '#172d31');
    drawPixelRect(context, x - 8, y + 13, 26, 10, '#193533');
    drawPixelRect(context, x + 1, y + 7, 5, 17, '#352f24');
    drawPixelRect(context, x + 2, y + 10, 2, 12, '#66513a');
  }
}

function drawTreeCanopies(
  context: CanvasRenderingContext2D,
  tick: number,
  reducedMotion: boolean,
): void {
  const fullTurn = Math.PI * 2;
  for (const { x, y } of TREES) {
    const phase = decorationNoise(x, y, 31) * fullTurn;
    const gust = (1 + Math.sin((tick / TREE_WIND.gustPeriodTicks) * fullTurn + phase)) / 2;
    const strength = 0.35 + 0.65 * gust * gust;
    const sway = reducedMotion
      ? 0
      : Math.sin((tick / TREE_WIND.swayPeriodTicks) * fullTurn + phase) *
        strength *
        TREE_WIND.maximumSwayPixels;
    const upperShift = Math.round(sway);
    const lowerShift = Math.round(sway * 0.45);
    const dip = Math.round(Math.abs(sway) * 0.25);
    const flutter = reducedMotion
      ? 0
      : Math.round(Math.sin((tick / TREE_WIND.flutterPeriodTicks) * fullTurn - phase) * gust);
    // Leaf layers bend around the fixed trunk rather than moving the whole tree rigidly.
    drawPixelRect(context, x - 13 + lowerShift, y - 6, 29, 20, '#123e32');
    drawPixelRect(context, x - 17 + lowerShift, y - 2, 30, 12, '#15563c');
    drawPixelRect(context, x - 11 + upperShift, y - 14 + dip, 23, 23, '#29734b');
    drawPixelRect(context, x - 9 + upperShift, y - 12 + dip, 13, 10, '#4b8e57');
    drawPixelRect(context, x - 2 + lowerShift, y - 5 + flutter, 16, 10, '#36804c');
    drawPixelRect(context, x - 7 + upperShift, y - 10 + dip, 5, 2, '#659e61');
    drawPixelRect(context, x + 8 + lowerShift, y - 3 + flutter, 3, 2, '#559457');
  }
}

type Spectator = {
  x: number;
  y: number;
  team: Team;
  shirt: string;
  skin: string;
  variety: number;
  section: number;
};
type SupporterMood = 'idle' | 'urge' | 'tense' | 'cheer' | 'disbelief' | 'relief' | 'acknowledge';

/** Supporters keep their allegiance when teams swap ends. A save belongs to the keeper's side. */
export function supporterMood(team: Team, atmosphere: MatchAtmosphere): SupporterMood {
  const { moment, attack } = atmosphere;
  if (moment) {
    const supporting = moment.team === team;
    if (moment.type === 'goal') return supporting ? 'cheer' : 'disbelief';
    if (moment.type === 'save') return supporting ? 'relief' : 'disbelief';
    if (moment.type === 'near-miss') return supporting ? 'disbelief' : 'relief';
    if (moment.type === 'good-pass' && supporting) return 'acknowledge';
  }
  return attack ? (attack.team === team ? 'urge' : 'tense') : 'idle';
}

const spectators: Spectator[] = STANDS.flatMap((stand, section) => {
  const seats: Spectator[] = [];
  for (let row = 0; row < stand.height - 5; row += ROW_HEIGHT) {
    for (let column = 5, seat = 0; column < stand.width - 5; column += SEAT_SPACING, seat++) {
      const x = stand.x + column;
      const y = stand.y + row + 10;
      // Vertical aisles and the south tunnel stay clear, including during celebrations.
      if (seat % 18 === 17 || (stand.y === 600 && x > 440 && x < 518)) continue;
      const variety = decorationNoise(x, y);
      if (variety < 0.1) continue;
      const team = x < 480 ? 'coral' : 'cyan';
      seats.push({
        x,
        y,
        team,
        variety,
        section,
        shirt:
          variety < 0.65
            ? SUPPORTERS[team].shirt
            : variety < 0.85
              ? SUPPORTERS[team].dark
              : '#a4b6ab',
        skin: SKIN_COLORS[Math.floor(decorationNoise(y, x, 9) * SKIN_COLORS.length)]!,
      });
    }
  }
  return seats;
});
function drawSpectator(
  context: CanvasRenderingContext2D,
  spectator: Spectator,
  raisedArms = false,
  bob = 0,
  scarf = false,
  mood: SupporterMood = 'idle',
): void {
  const { x, y, shirt, skin, team } = spectator;
  const slump = mood === 'disbelief' ? 2 : 0;
  const headY = y - 7 - bob + slump;
  drawPixelRect(context, x, y - 4 - bob + slump, 5, 4 + bob - slump, shirt);
  drawPixelRect(context, x + 1, headY, 3, 3, skin);
  drawPixelRect(context, x + 1, headY, 3, 1, '#353843');
  drawPixelRect(context, x, y, 2, 1, '#081823');
  drawPixelRect(context, x + 3, y, 2, 1, '#081823');
  if (raisedArms) {
    drawPixelRect(context, x - 1, y - 6 - bob, 1, 4, shirt);
    drawPixelRect(context, x + 5, y - 6 - bob, 1, 4, shirt);
    drawPixelRect(context, x - 1, y - 7 - bob, 1, 2, skin);
    drawPixelRect(context, x + 5, y - 7 - bob, 1, 2, skin);
  }
  if (mood === 'disbelief') {
    // Sink into the seat with one hand to the face; clearly below the cheering silhouette.
    drawPixelRect(context, x + 4, y - 3, 2, 2, shirt);
    drawPixelRect(context, x + 3, y - 4, 2, 1, skin);
  } else if (mood === 'tense') {
    drawPixelRect(context, x, y - 4, 1, 2, skin);
    drawPixelRect(context, x + 4, y - 4, 1, 2, skin);
  } else if (mood === 'acknowledge') {
    drawPixelRect(context, x + 5, y - 5, 1, 3, shirt);
    drawPixelRect(context, x + 5, y - 6, 1, 2, skin);
  }
  if (scarf) {
    drawPixelRect(context, x - 1, y - 8 - bob, 7, 2, SUPPORTERS[team].bright);
    drawPixelRect(context, x + 1, y - 8 - bob, 1, 2, '#f1e5c9');
    drawPixelRect(context, x + 4, y - 8 - bob, 1, 2, '#f1e5c9');
  }
}

export function drawSupporterStands(context: CanvasRenderingContext2D): void {
  for (const stand of STANDS) {
    drawPixelRect(context, stand.x + 3, stand.y + 4, stand.width, stand.height, '#060e17');
    drawPixelRect(context, stand.x, stand.y, stand.width, stand.height, STAND_COLOR);
    for (let row = 0; row < stand.height - 5; row += ROW_HEIGHT) {
      drawPixelRect(context, stand.x, stand.y + row + 10, stand.width, 2, '#294252');
      for (let aisle = 5 + 17 * SEAT_SPACING; aisle < stand.width - 5; aisle += 18 * SEAT_SPACING) {
        drawPixelRect(context, stand.x + aisle - 1, stand.y + row, 8, 10, '#425961');
        drawPixelRect(context, stand.x + aisle, stand.y + row + 8, 6, 1, '#82908a');
      }
    }
    drawPixelRect(context, stand.x, stand.y, stand.width, 2, '#547080');
    drawPixelRect(context, stand.x, stand.y + stand.height - 2, stand.width, 2, '#38546a');
  }
  for (const spectator of spectators) {
    const scarf = spectator.variety > 0.94;
    drawSpectator(context, spectator, scarf, 0, scarf);
  }
}

function drawBanner(context: CanvasRenderingContext2D, x: number, y: number, team: Team): void {
  const colors = SUPPORTERS[team];
  drawPixelRect(context, x + 2, y + 2, 120, 10, '#0a1a24');
  drawPixelRect(context, x, y, 120, 10, colors.banner);
  drawPixelRect(context, x, y, 120, 1, colors.bright);
  for (const end of [x + 3, x + 108]) {
    drawPixelRect(context, end, y + 2, 3, 6, colors.bright);
    drawPixelRect(context, end + 5, y + 2, 3, 6, '#e1dec6');
  }
  context.fillStyle = '#f4e8d1';
  context.font = 'bold 7px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillText(team === 'coral' ? 'CORAL TOGETHER' : 'COME ON CYAN', x + 60, y + 2);
}

function flagRipple(tick: number, phase: number, freeEdge: number, energy = 0): number {
  const fullTurn = Math.PI * 2;
  const gust = (1 + Math.sin((tick / FLAG_WIND.gustPeriodTicks) * fullTurn + phase)) / 2;
  const wave = (tick / FLAG_WIND.wavePeriodTicks) * fullTurn;
  return (
    Math.sin(wave + phase - freeEdge * 2.6) * freeEdge * (FLAG_WIND.edgeLiftPixels + gust + energy)
  );
}

/** Only the fixed poles enter the cached pitch; their cloth is redrawn after every restore. */
export function drawCornerFlagPoles(context: CanvasRenderingContext2D): void {
  for (const flag of CORNER_FLAGS)
    drawPixelRect(
      context,
      flag.x,
      flag.y - FLAG_WIND.cornerPoleHeight,
      1,
      FLAG_WIND.cornerPoleHeight + 1,
      '#e4e8c9',
    );
}

function drawCornerFlags(context: CanvasRenderingContext2D, tick: number): void {
  for (const flag of CORNER_FLAGS) {
    const phase = decorationNoise(flag.x, flag.y, 47) * Math.PI * 2;
    for (let column = 0; column < FLAG_WIND.cornerClothWidth; column++) {
      const freeEdge = column / (FLAG_WIND.cornerClothWidth - 1);
      const ripple = Math.round(flagRipple(tick, phase, freeEdge) * 0.55);
      const x = flag.x + flag.direction * (column + 1);
      const y = flag.y - FLAG_WIND.cornerPoleHeight + ripple;
      drawPixelRect(context, x, y, 1, 5, column % 3 === 0 ? '#ffe28b' : '#f9c24b');
      drawPixelRect(context, x, y + 4, 1, 1, '#c18c36');
    }
  }
}

function drawFlags(
  context: CanvasRenderingContext2D,
  tick: number,
  celebratingTeam: Team | null,
): void {
  for (const flag of FLAGS) {
    const colors = SUPPORTERS[flag.team];
    const energy = celebratingTeam === flag.team ? 4 : 0;
    const phase = decorationNoise(flag.x, flag.y) * Math.PI * 2;
    drawPixelRect(context, flag.x, flag.y - 24, 1, 25, '#8a9d98');
    for (let strip = 0; strip < 9; strip++) {
      const ripple = Math.round(flagRipple(tick, phase, strip / 8, energy));
      const x = flag.x + flag.direction * (1 + strip * 2) - (flag.direction < 0 ? 1 : 0);
      const y = flag.y - 24 + ripple;
      drawPixelRect(context, x, y, 2, 11, strip % 3 === 0 ? colors.bright : colors.shirt);
      drawPixelRect(context, x, y + 4, 2, 2, '#e9dfc3');
    }
  }
}

export function drawStadiumAtmosphere(context: CanvasRenderingContext2D): void {
  // Rails and supporter banners sit entirely outside the playing surface.
  for (const y of [64, 597]) {
    if (y === 597) {
      drawPixelRect(context, 112, y, 328, 1, '#81918a');
      drawPixelRect(context, 518, y, 329, 1, '#81918a');
    } else drawPixelRect(context, 112, y, 735, 1, '#81918a');
    for (let x = 116; x < 847; x += 24) {
      if (y === 597 && x > 440 && x < 518) continue;
      drawPixelRect(context, x, y, 1, 4, '#536965');
    }
  }
  drawPixelRect(context, 69, 110, 2, 432, '#718782');
  drawPixelRect(context, 889, 110, 2, 432, '#718782');
  drawBanner(context, 135, 77, 'coral');
  drawBanner(context, 706, 77, 'cyan');
  drawBanner(context, 135, 588, 'coral');
  drawBanner(context, 706, 588, 'cyan');
  // Only poles belong to the cached painting; cloth must not leave an old pose behind.
  for (const flag of FLAGS) drawPixelRect(context, flag.x, flag.y - 24, 1, 25, '#8a9d98');
}

export function drawCrowd(
  context: CanvasRenderingContext2D,
  frame: Frame,
  reducedMotion: boolean,
  animationTick = frame.tick,
  atmosphere: MatchAtmosphere = { attack: null, moment: null },
): void {
  // Pitch restores a painting with no canopy or flag cloth, including paused redraws.
  drawTreeCanopies(context, animationTick, reducedMotion);
  drawCornerFlags(context, reducedMotion ? 0 : animationTick);
  if (reducedMotion) {
    drawFlags(context, 0, null);
    return;
  }
  const { moment, attack } = atmosphere;
  const reactionPosition = moment ? worldToScreen(moment.position) : null;
  const goal = moment?.type === 'goal';
  const reactionAge = moment
    ? goal
      ? goalWatchSeconds(frame.tick - moment.tick) * TICK_RATE
      : frame.tick - moment.tick
    : 0;
  const reactionDuration = moment
    ? goal
      ? GOAL_PRESENTATION.watchDurationSeconds * TICK_RATE
      : MOMENT_DURATION_TICKS[moment.type]
    : 0;
  for (const spectator of spectators) {
    const seed = decorationNoise(spectator.x, spectator.y, 19);
    const idleParticipant = seed > 0.78;
    // End stands lead the jumping; the north stand raises scarves; south responds in waves.
    const sectionDelay = spectator.section === 1 ? 9 : spectator.section >= 2 ? 0 : 4;
    const delay = sectionDelay + Math.floor(decorationNoise(spectator.y, spectator.x) * 12);
    const nearby = reactionPosition
      ? Math.max(
          0.25,
          1 - Math.hypot(spectator.x - reactionPosition.x, spectator.y - reactionPosition.y) / 900,
        )
      : 0;
    const responding =
      moment &&
      reactionAge >= delay &&
      reactionAge < reactionDuration - delay &&
      (moment.type === 'goal' || seed < 0.35 + nearby * 0.6);
    const anticipating = attack && seed < attack.intensity * (spectator.section >= 2 ? 0.95 : 0.8);
    if (!idleParticipant && !responding && !anticipating) continue;
    const mood = responding
      ? supporterMood(spectator.team, atmosphere)
      : anticipating
        ? supporterMood(spectator.team, { attack, moment: null })
        : 'idle';
    const rhythm = Math.floor(animationTick / (12 + spectator.variety * 18) + spectator.x) % 12;
    const urgeBeat =
      Math.floor(animationTick / 14 + spectator.section * 2 + spectator.variety * 3) % 4 < 2;
    const raisedArms =
      mood === 'cheer' ||
      mood === 'relief' ||
      (mood === 'urge' && urgeBeat) ||
      (mood === 'idle' && rhythm < 2);
    const jumping = mood === 'cheer' || (mood === 'urge' && spectator.section >= 2);
    const sectionWave = reactionAge / 7 - spectator.x / 38 + spectator.section * 1.5;
    const bob =
      mood === 'cheer'
        ? Math.round(Math.max(0, Math.sin(sectionWave + spectator.variety)) * 3)
        : jumping && Math.floor(animationTick / 9 + spectator.y) % 3 === 0
          ? 1
          : 0;
    const scarf = raisedArms && spectator.variety > (spectator.section === 0 ? 0.6 : 0.88);
    // Erase the cached seated pose only. The larger leap fits the empty row gap;
    // every frame restores the whole painting, so it leaves no old airborne pose behind.
    drawPixelRect(context, spectator.x - 1, spectator.y - 8, 8, 9, STAND_COLOR);
    drawPixelRect(context, spectator.x - 1, spectator.y, 8, 1, '#294252');
    drawSpectator(context, spectator, raisedArms, bob, scarf, mood);
  }
  drawFlags(context, animationTick, moment?.type === 'goal' ? moment.team : null);
}
