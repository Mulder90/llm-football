import { sample } from '../recording/record.ts';
import type { Frame, Recording } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { Team, Vec2 } from '../sim/types.ts';
import { PITCH_LAYOUT, worldToScreen } from './layout.ts';
import type { FootballMoment } from './match-atmosphere.ts';
import { drawPixelRect } from './pixels.ts';

const ACCENT = {
  durationTicks: 0.65 * TICK_RATE,
  arrivalTicks: 0.1 * TICK_RATE,
  minimumCarrySpeed: 4.5,
  trailSampleTicks: 5,
  headClearance: 46,
  neighbourClearance: 23,
} as const;

export type ActionAccent = {
  type: 'save' | 'near-miss' | 'good-pass';
  team: Team;
  position: Vec2;
  ageTicks: number;
};

/** A single comic punctuation mark, with actual outcomes and empty space deciding eligibility. */
export function actionAccentAt(
  record: Recording,
  frame: Frame,
  moments: readonly FootballMoment[],
): ActionAccent | null {
  if (frame.phase.type === 'full_time' || frame.phase.type === 'halftime') return null;
  for (let index = moments.length - 1; index >= 0; index--) {
    const moment = moments[index]!;
    const ageTicks = frame.tick - moment.tick;
    if (ageTicks < 0) continue;
    if (ageTicks >= ACCENT.durationTicks) break;
    if (moment.type === 'goal') return null;
    if (!moment.playerId || moment.tick < frame.phase.sinceTick) continue;
    const playerIndex = record.initial.players.findIndex((player) => player.id === moment.playerId);
    const pose = frame.players[playerIndex]!;
    if (pose.dismissed || pose.lastKickTick >= moment.tick) continue;
    if (moment.type !== 'near-miss' && frame.owner !== moment.playerId) continue;
    if (moment.type === 'near-miss' && frame.owner === moment.playerId) continue;
    const ground = worldToScreen(pose.position);
    const candidates = [
      { x: ground.x, y: ground.y - ACCENT.headClearance },
      { x: ground.x + 29, y: ground.y - 22 },
      { x: ground.x - 29, y: ground.y - 22 },
    ];
    const position = candidates.find((candidate) => {
      // Keep marks on the grass, clear of club banners and other robots' faces.
      if (
        candidate.x < PITCH_LAYOUT.left + 10 ||
        candidate.x > PITCH_LAYOUT.left + PITCH_LAYOUT.width - 10 ||
        candidate.y < PITCH_LAYOUT.top + 10 ||
        candidate.y > PITCH_LAYOUT.top + PITCH_LAYOUT.height - 10
      )
        return false;
      return frame.players.every((other, otherIndex) => {
        if (otherIndex === playerIndex || other.dismissed) return true;
        const otherGround = worldToScreen(other.position);
        return (
          Math.hypot(candidate.x - otherGround.x, candidate.y - (otherGround.y - 16)) >
          ACCENT.neighbourClearance
        );
      });
    });
    if (position) return { type: moment.type, team: moment.team, position, ageTicks };
  }
  return null;
}

/** Grass puffs follow previous carrier foot positions, never an invented movement path. */
export function drawCarryAccents(
  context: CanvasRenderingContext2D,
  record: Recording,
  frame: Frame,
  reducedMotion: boolean,
): void {
  if (reducedMotion || !frame.owner || frame.phase.type !== 'open_play') return;
  const playerIndex = record.initial.players.findIndex((player) => player.id === frame.owner);
  const carrier = frame.players[playerIndex]!;
  if (Math.hypot(carrier.velocity.x, carrier.velocity.y) < ACCENT.minimumCarrySpeed) return;
  context.save();
  context.beginPath();
  context.rect(PITCH_LAYOUT.left, PITCH_LAYOUT.top, PITCH_LAYOUT.width, PITCH_LAYOUT.height);
  context.clip();
  for (const step of [3, 2, 1]) {
    const previous = sample(record, (frame.tick - step * ACCENT.trailSampleTicks) / TICK_RATE);
    if (previous.owner !== frame.owner || previous.phase.sinceTick !== frame.phase.sinceTick) break;
    const foot = worldToScreen(previous.players[playerIndex]!.position);
    const side = Math.floor(carrier.distanceTravelled * 2) % 2 === 0 ? 1 : -1;
    context.globalAlpha = 0.5 - step * 0.1;
    drawPixelRect(context, foot.x + side * 5, foot.y + 2, 4 - step, 2, '#c5d88a');
    drawPixelRect(context, foot.x - side * 4, foot.y + 4, 2, 1, '#e0df9e');
  }
  context.restore();
}

export function drawActionAccent(
  context: CanvasRenderingContext2D,
  accent: ActionAccent | null,
  reducedMotion: boolean,
): void {
  if (!accent) return;
  const { type, position, ageTicks, team } = accent;
  const arrival = Math.min(1, ageTicks / ACCENT.arrivalTicks);
  const rise = reducedMotion ? 0 : Math.round((1 - arrival) * 3);
  const { x } = position;
  const y = position.y + rise;
  const color = team === 'coral' ? '#ffb097' : '#abf5e5';
  context.save();
  context.globalAlpha = reducedMotion
    ? 1
    : Math.min(arrival, (ACCENT.durationTicks - ageTicks) / 10);
  if (type === 'save') {
    // A comic exclamation, outside the keeper's silhouette and well clear of the ball.
    drawPixelRect(context, x - 3, y - 9, 6, 11, '#173340');
    drawPixelRect(context, x - 2, y - 8, 4, 8, '#fff0a7');
    drawPixelRect(context, x - 2, y + 3, 5, 5, '#173340');
    drawPixelRect(context, x - 1, y + 4, 3, 3, '#fff0a7');
    drawPixelRect(context, x - 8, y - 5, 2, 4, color);
    drawPixelRect(context, x + 6, y - 7, 2, 4, color);
  } else if (type === 'good-pass') {
    for (const [offset, height] of [
      [-4, 5],
      [5, 3],
    ] as const) {
      drawPixelRect(context, x + offset, y - height, 1, height * 2 + 1, '#fff2b7');
      drawPixelRect(context, x + offset - 2, y - 1, 5, 3, color);
      drawPixelRect(context, x + offset, y, 1, 1, '#ffffff');
    }
  } else {
    // One untidy scribble for the miss, not a speech bubble or a claim about model thoughts.
    const wobble = reducedMotion ? 0 : Math.round(Math.sin(ageTicks / 7));
    for (const [dx, dy, width, height] of [
      [-6, -3, 10, 2],
      [2, -1, 4, 2],
      [-4, 1, 9, 2],
      [-6, 3, 3, 2],
      [-3, 4, 8, 2],
    ] as const)
      drawPixelRect(context, x + dx + wobble, y + dy, width, height, '#e8dbb9');
  }
  context.restore();
}
