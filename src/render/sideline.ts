import type { Frame } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { Team } from '../sim/types.ts';
import { MOMENT_DURATION_TICKS, type MatchAtmosphere } from './match-atmosphere.ts';
import { drawPixelRect } from './pixels.ts';
import { supporterMood } from './stadium-atmosphere.ts';

// Logical canvas pixels: these fixed pockets end before the south rail at y=597.
const FOOT_Y = 592;
const DRUM_BPM = 130;
const DRUM_TWO_BEAT_TICKS = (2 * 60 * TICK_RATE) / DRUM_BPM;
const SIDELINES = [
  { team: 'coral', dugoutX: 305, coachX: 286, drummerX: 112 },
  { team: 'cyan', dugoutX: 560, coachX: 674, drummerX: 840 },
] as const;
const CLUB = {
  coral: { kit: '#c76a5b', light: '#f3ac87', shade: '#773f44', shell: '#f3d6ac' },
  cyan: { kit: '#5fb4bd', light: '#b0e6dd', shade: '#315c73', shell: '#d0e2d3' },
} as const;
const INK = '#10232e';
const BOOTS = '#0a1822';
type Mood = ReturnType<typeof supporterMood>;

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

function drawClubMark(context: CanvasRenderingContext2D, x: number, y: number, team: Team): void {
  const color = CLUB[team].light;
  // Coral's little sun and Cyan's twin waves also distinguish the clubs without colour.
  if (team === 'coral') {
    drawPixelRect(context, x + 3, y, 2, 6, color);
    drawPixelRect(context, x + 1, y + 2, 6, 2, color);
    drawPixelRect(context, x + 2, y + 1, 4, 4, color);
  } else {
    for (const row of [0, 3]) {
      drawPixelRect(context, x, y + row + 1, 3, 1, color);
      drawPixelRect(context, x + 3, y + row, 3, 1, color);
      drawPixelRect(context, x + 6, y + row + 1, 2, 1, color);
    }
  }
}

/** The cached layer contains empty seats and architecture, never animated silhouettes. */
export function drawSidelineStructures(context: CanvasRenderingContext2D): void {
  for (const { team, dugoutX, coachX, drummerX } of SIDELINES) {
    const club = CLUB[team];
    drawPixelRect(context, coachX - 14, 569, 28, 26, '#243a40');
    drawPixelRect(context, coachX - 12, 570, 24, 1, club.shade);
    drawPixelRect(context, drummerX - 11, 570, 23, 26, '#243a40');
    drawPixelRect(context, drummerX - 10, 571, 21, 1, club.shade);
    drawPixelRect(context, dugoutX, 569, 96, 26, INK);
    drawPixelRect(context, dugoutX + 2, 576, 92, 17, '#233943');
    drawPixelRect(context, dugoutX + 2, 569, 92, 2, club.light);
    drawPixelRect(context, dugoutX + 1, 571, 94, 4, club.shade);
    drawPixelRect(context, dugoutX + 12, 572, 72, 1, club.kit);
    for (const seatX of [20, 40, 60, 80]) {
      drawPixelRect(context, dugoutX + seatX - 6, 582, 12, 9, '#405663');
      drawPixelRect(context, dugoutX + seatX - 6, 590, 12, 2, club.shade);
    }
    for (const pennantX of [dugoutX + 3, dugoutX + 85]) {
      drawPixelRect(context, pennantX, 575, 8, 10, club.shade);
      drawPixelRect(context, pennantX + 2, 585, 4, 2, club.shade);
      drawClubMark(context, pennantX, 577, team);
    }
    drawPixelRect(context, dugoutX, 593, 96, 2, '#6c9291');
    drawPixelRect(context, dugoutX + 1, 576, 1, 17, '#6c9291');
    drawPixelRect(context, dugoutX + 94, 576, 1, 17, '#6c9291');
  }
}

function drawCoach(
  context: CanvasRenderingContext2D,
  x: number,
  team: Team,
  mood: Mood,
  tick: number,
  reducedMotion: boolean,
): void {
  const club = CLUB[team];
  const rect = (dx: number, dy: number, w: number, h: number, color: string) =>
    drawPixelRect(context, x + dx, FOOT_Y + dy, w, h, color);
  const rhythm = reducedMotion ? 0 : Math.sin(tick / (0.2 * TICK_RATE) + (team === 'cyan' ? 2 : 0));
  const blink = !reducedMotion && (tick + (team === 'cyan' ? 93 : 0)) % (4.3 * TICK_RATE) < 5;
  const glance = reducedMotion ? 0 : Math.round(Math.sin(tick / (2.5 * TICK_RATE)));
  const headY = mood === 'disbelief' ? -19 : -20;

  rect(-8, 1, 16, 2, '#17292d');
  rect(-4, -4, 3, 5, INK);
  rect(2, -4, 3, 5, INK);
  rect(-5, 0, 5, 2, BOOTS);
  rect(2, 0, 5, 2, BOOTS);
  rect(-5, -12, 11, team === 'cyan' ? 10 : 9, INK);
  rect(-4, -11, 9, team === 'cyan' ? 8 : 7, team === 'cyan' ? club.shade : club.kit);
  rect(-3, -10, 1, 6, club.light);
  rect(2, -10, 2, 2, club.light);
  rect(-6, headY, 13, 9, INK);
  rect(-5, headY + 1, 11, 7, club.shell);
  rect(-4, headY + 3, 9, 3, '#294957');
  rect(-3 + glance, headY + 3, 2, blink ? 1 : 2, club.light);
  rect(2 + glance, headY + 3, 2, blink ? 1 : 2, club.light);
  rect(-1, headY + 7, 3, 1, mood === 'cheer' ? INK : '#78948e');
  if (team === 'coral') {
    rect(-6, -21, 13, 2, club.shade);
    rect(-7, -19, 7, 1, club.kit);
  } else {
    rect(-7, headY + 2, 2, 6, club.shade);
    rect(6, headY + 2, 2, 6, club.shade);
    rect(5, headY + 7, 3, 1, INK);
    rect(4, -22, 1, 2, club.light);
  }

  if (mood === 'cheer') {
    const raised = rhythm > 0 ? 1 : 0;
    for (const side of [-1, 1]) {
      rect(side < 0 ? -9 : 7, -17 - raised, 3, 8, club.kit);
      rect(side < 0 ? -10 : 7, -20 - raised, 4, 4, club.shell);
    }
  } else if (mood === 'disbelief') {
    rect(-9, -15, 3, 7, club.kit);
    rect(7, -15, 3, 7, club.kit);
    rect(-8, -18, 4, 4, club.shell);
    rect(5, -18, 4, 4, club.shell);
  } else if (mood === 'tense') {
    rect(-7, -10, 3, 5, club.kit);
    rect(5, -10, 3, 5, club.kit);
    rect(-5, -6, 11, 2, club.kit);
    rect(-2, -6, 3, 2, club.shell);
  } else if (mood === 'urge' || mood === 'acknowledge' || mood === 'relief') {
    const lift = mood === 'urge' ? (rhythm > 0 ? 3 : 0) : mood === 'acknowledge' ? 4 : 0;
    rect(-8, -12 - lift, 3, 6 + lift, club.kit);
    rect(-9, -14 - lift, 4, 3, club.shell);
    rect(5, -10, 3, 5, club.kit);
    rect(mood === 'relief' ? 1 : 5, -7, 4, 3, club.shell);
  } else {
    rect(-7, -10, 3, 5, club.kit);
    rect(5, -10, 3, 6, club.kit);
    rect(5, -5, 3, 2, club.shell);
    // A plain clipboard for Coral, folded hands for Cyan: no tactical diagram.
    rect(-8, -7, team === 'coral' ? 5 : 4, 5, team === 'coral' ? '#bca780' : club.shell);
    if (team === 'coral') rect(-7, -6, 3, 1, '#e0cea6');
  }
}

function drawBenchCrew(
  context: CanvasRenderingContext2D,
  x: number,
  team: Team,
  mood: Mood,
  tick: number,
  reducedMotion: boolean,
): void {
  const club = CLUB[team];
  for (let seat = 0; seat < 4; seat++) {
    const center = x + 20 + seat * 20;
    const rect = (dx: number, dy: number, w: number, h: number, color: string) =>
      drawPixelRect(context, center + dx, FOOT_Y + dy, w, h, color);
    const beat = !reducedMotion && Math.sin(tick / (0.26 * TICK_RATE) + seat * 1.7) > 0;
    const raised = mood === 'cheer' || (mood === 'relief' && seat % 2 === 0);
    const bob = raised && beat ? -1 : 0;
    rect(-5, 0, 4, 1, BOOTS);
    rect(2, 0, 4, 1, BOOTS);
    rect(-4, -9 + bob, 9, 8, INK);
    rect(-3, -8 + bob, 7, 5, seat === 3 ? club.shade : club.kit);
    rect(-5, -15 + bob, 11, 7, INK);
    rect(-4, -14 + bob, 9, 5, club.shell);
    rect(-3, -12 + bob, 7, 2, '#294957');
    rect(-2, -12 + bob, 1, 1, club.light);
    rect(2, -12 + bob, 1, 1, club.light);
    if (seat === 3) rect(-4, -14 + bob, 9, 1, club.kit);
    if (raised) {
      rect(-7, -11, 2, 5, club.kit);
      rect(6, -11, 2, 5, club.kit);
      rect(-8, -14 + bob, 3, 3, club.shell);
      rect(6, -14 + bob, 3, 3, club.shell);
    } else if (mood === 'disbelief') {
      rect(-6, -10, 3, 5, club.kit);
      rect(-5, -12, 4, 3, club.shell);
      rect(5, -8, 2, 4, club.kit);
    } else {
      const wave = (mood === 'urge' || mood === 'acknowledge') && beat;
      rect(-6, wave ? -10 : -7, 3, 4, club.kit);
      rect(-6, wave ? -12 : -5, 3, 2, club.shell);
      rect(5, -7, 2, 3, club.kit);
      if (seat === 2) {
        rect(5, -6, 3, 5, '#7298a1');
        rect(6, -7, 1, 1, club.light);
      }
    }
  }
}

function drawDrummer(
  context: CanvasRenderingContext2D,
  x: number,
  team: Team,
  mood: Mood,
  frame: Frame,
  reducedMotion: boolean,
): void {
  const club = CLUB[team];
  const rect = (dx: number, dy: number, w: number, h: number, color: string) =>
    drawPixelRect(context, x + dx, FOOT_Y + dy, w, h, color);
  const playing =
    !reducedMotion && frame.phase.type === 'open_play' && mood !== 'disbelief' && mood !== 'tense';
  // Decorative gestures use recording time; the audio mix no longer includes percussion.
  const beat = playing && Math.sin((frame.tick * Math.PI * 2) / DRUM_TWO_BEAT_TICKS) > 0;
  rect(-8, 1, 16, 2, '#17292d');
  rect(-5, -2, 4, 4, BOOTS);
  rect(2, -2, 4, 4, BOOTS);
  rect(-4, -12, 9, 9, club.kit);
  rect(-5, -18, 11, 8, INK);
  rect(-4, -17, 9, 6, club.shell);
  rect(-3, -15, 7, 2, '#294957');
  rect(-2, -15, 1, 1, club.light);
  rect(2, -15, 1, 1, club.light);
  rect(-5, -19, 11, 2, club.shade);
  rect(-6, -9, 13, 10, INK);
  rect(-5, -8, 11, 8, club.shade);
  rect(-5, -8, 11, 2, '#dfc9a6');
  rect(-4, -6, 2, 5, club.kit);
  rect(3, -6, 2, 5, club.kit);
  rect(-5, -1, 11, 1, club.light);
  const leftLift = mood === 'cheer' ? 4 : beat ? 3 : 0;
  const rightLift = mood === 'cheer' ? 4 : playing && !beat ? 3 : 0;
  rect(-8, -9 - leftLift, 3, 3, club.shell);
  rect(7, -9 - rightLift, 3, 3, club.shell);
  rect(-7, -11 - leftLift, 1, 4, '#debf8b');
  rect(7, -11 - rightLift, 1, 4, '#debf8b');
}

/** Watch time moves decorative limbs; recorded state alone determines their reaction. */
export function drawSidelines(
  context: CanvasRenderingContext2D,
  frame: Frame,
  atmosphere: MatchAtmosphere,
  animationTick: number,
  reducedMotion: boolean,
): void {
  for (const { team, dugoutX, coachX, drummerX } of SIDELINES) {
    const mood = sidelineMood(team, frame, atmosphere, reducedMotion);
    drawCoach(context, coachX, team, mood, animationTick, reducedMotion);
    drawBenchCrew(context, dugoutX, team, mood, animationTick, reducedMotion);
    drawDrummer(context, drummerX, team, mood, frame, reducedMotion);
  }
}
