import type { Frame, Recording } from '../recording/record.ts';
import type { MatchEvent, Team, Vec2 } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

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
const REACTION_TICKS = { goal: 3 * TICK_RATE, save: 1.4 * TICK_RATE, shot: 0.9 * TICK_RATE };

// Coordinate-only decoration: this never consumes the match's seeded randomness.
export function decorationNoise(x: number, y: number, seed = 0): number {
  let hash = Math.imul(x + seed, 374761393) + Math.imul(y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

type Spectator = { x: number; y: number; team: Team; shirt: string; skin: string; variety: number };
const spectators: Spectator[] = STANDS.flatMap((stand) => {
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
// A minority of supporters animate; the rest stay in the cached stadium painting.
const animatedSpectators = spectators.filter(
  (spectator) => decorationNoise(spectator.x, spectator.y, 19) > 0.78,
);

function drawSpectator(
  context: CanvasRenderingContext2D,
  spectator: Spectator,
  raisedArms = false,
  bob = 0,
  scarf = false,
): void {
  const { x, y, shirt, skin, team } = spectator;
  const headY = y - 7 - bob;
  drawPixelRect(context, x, y - 4 - bob, 5, 4 + bob, shirt);
  drawPixelRect(context, x + 1, headY, 3, 3, skin);
  drawPixelRect(context, x + 1, headY, 3, 1, '#353843');
  drawPixelRect(context, x, y, 2, 1, '#081823');
  drawPixelRect(context, x + 3, y, 2, 1, '#081823');
  if (raisedArms) {
    drawPixelRect(context, x - 1, y - 6, 1, 4, shirt);
    drawPixelRect(context, x + 5, y - 6, 1, 4, shirt);
    drawPixelRect(context, x - 1, y - 7, 1, 2, skin);
    drawPixelRect(context, x + 5, y - 7, 1, 2, skin);
  }
  if (scarf) {
    drawPixelRect(context, x - 1, y - 8, 7, 2, SUPPORTERS[team].bright);
    drawPixelRect(context, x + 1, y - 8, 1, 2, '#f1e5c9');
    drawPixelRect(context, x + 4, y - 8, 1, 2, '#f1e5c9');
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

function drawFlags(
  context: CanvasRenderingContext2D,
  tick: number,
  celebratingTeam: Team | null,
): void {
  for (const flag of FLAGS) {
    const colors = SUPPORTERS[flag.team];
    const energy = celebratingTeam === flag.team ? 1 : 0;
    const phase = tick / (16 - energy * 5) + decorationNoise(flag.x, flag.y) * Math.PI * 2;
    drawPixelRect(context, flag.x, flag.y - 24, 1, 25, '#8a9d98');
    for (let strip = 0; strip < 7; strip++) {
      const ripple = Math.round((Math.sin(phase - strip * 0.6) * strip) / 4);
      const x = flag.x + flag.direction * (1 + strip * 2) - (flag.direction < 0 ? 1 : 0);
      const y = flag.y - 24 + ripple;
      drawPixelRect(context, x, y, 2, 9, strip % 3 === 0 ? colors.bright : colors.shirt);
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

type CrowdReaction = {
  type: keyof typeof REACTION_TICKS;
  team: Team;
  ageTicks: number;
  position: Vec2;
};

function recentReaction(frame: Frame, recording: Recording): CrowdReaction | null {
  let chosen: MatchEvent | undefined;
  let strongest = 0;
  for (let index = recording.events.length - 1; index >= 0; index--) {
    const event = recording.events[index]!;
    if (event.tick >= frame.tick) continue;
    const ageTicks = frame.tick - event.tick;
    if (ageTicks > REACTION_TICKS.goal) break;
    if (event.type !== 'goal' && event.type !== 'save' && event.type !== 'shot') continue;
    const strength =
      (event.type === 'goal' ? 3 : event.type === 'save' ? 2 : 1) *
      Math.max(0, 1 - ageTicks / REACTION_TICKS[event.type]);
    if (event.team && strength > strongest) {
      chosen = event;
      strongest = strength;
    }
  }
  if (!chosen?.team) return null;
  const eventFrame = recording.frames.findLast((candidate) => candidate.tick <= chosen.tick)!;
  const playerIndex = recording.initial.players.findIndex(
    (player) => player.id === chosen.playerId,
  );
  return {
    type: chosen.type as CrowdReaction['type'],
    team: chosen.team,
    ageTicks: frame.tick - chosen.tick,
    position: worldToScreen(eventFrame.players[playerIndex]?.position ?? eventFrame.ball),
  };
}

export function drawCrowd(
  context: CanvasRenderingContext2D,
  frame: Frame,
  recording: Recording,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    drawFlags(context, 0, null);
    return;
  }
  const reaction = recentReaction(frame, recording);
  for (const spectator of animatedSpectators) {
    const rhythm = Math.floor(frame.tick / (12 + spectator.variety * 18) + spectator.x) % 12;
    const delay = Math.floor(decorationNoise(spectator.y, spectator.x) * 18);
    const nearby = !reaction
      ? 0
      : Math.max(
          0.2,
          1 -
            Math.hypot(spectator.x - reaction.position.x, spectator.y - reaction.position.y) / 700,
        );
    const reacting =
      reaction?.team === spectator.team &&
      reaction.ageTicks > delay &&
      reaction.ageTicks < REACTION_TICKS[reaction.type] - delay &&
      (reaction.type === 'goal' || decorationNoise(spectator.x, spectator.y, 5) < nearby * 0.8);
    const raisedArms = reacting || rhythm < 2;
    const bob = raisedArms && Math.floor(frame.tick / 9 + spectator.y) % 3 === 0 ? 1 : 0;
    // Restore only this seat's cached footprint before drawing a different pose.
    drawPixelRect(context, spectator.x - 1, spectator.y - 8, 8, 9, STAND_COLOR);
    drawPixelRect(context, spectator.x - 1, spectator.y, 8, 1, '#294252');
    drawSpectator(context, spectator, raisedArms, bob, raisedArms && spectator.variety > 0.88);
  }
  // The flags' cloth is drawn over the same static poles. Ambient wind follows replay time.
  drawFlags(context, frame.tick, reaction?.type === 'goal' ? reaction.team : null);
}
