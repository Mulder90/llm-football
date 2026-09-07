import { BALL_CONTROL } from '../sim/rules.ts';
import type { Player, Team } from '../sim/types.ts';
import type { Frame, PlayerFrame, Recording } from '../recording/record.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';
import { celebrationFrame } from './celebration.ts';

type KitPalette = { highlight: string; shirt: string; shade: string; boots: string };
const TEAM_KITS: Record<Team, KitPalette> = {
  coral: { highlight: '#ff9780', shirt: '#ec6e60', shade: '#943f46', boots: '#ffbc9b' },
  cyan: { highlight: '#99e2d8', shirt: '#54bbc6', shade: '#2a7189', boots: '#b9f1e3' },
};
const KEEPER_KITS: Record<Team, KitPalette> = {
  coral: { highlight: '#ffe493', shirt: '#edbd58', shade: '#527752', boots: '#e5e4ae' },
  cyan: { highlight: '#c4f29e', shirt: '#91c678', shade: '#527752', boots: '#e5e4ae' },
};
const ANIMATION = {
  movementThreshold: 0.15,
  framesPerMetre: 2.4,
  runFrameCount: 4,
  kickDurationTicks: 18,
  tackleDurationTicks: 24,
  saveDurationTicks: 36,
  horizontalFacingThreshold: 0.3,
  ballHeightPixelsPerMetre: 5,
} as const;
const OUTLINE = '#122b35';

function drawRobot(
  context: CanvasRenderingContext2D,
  player: Player,
  frame: PlayerFrame,
  tick: number,
  hasBall: boolean,
  showNumbers: boolean,
  reducedMotion: boolean,
  celebrating: boolean,
): void {
  const anchor = worldToScreen(frame.position);
  if (celebrating && !reducedMotion)
    anchor.y -= Math.round(Math.abs(Math.sin(tick / 7 + player.number)) * 4);
  const speed = Math.sqrt(frame.velocity.x ** 2 + frame.velocity.y ** 2);
  const isMoving = speed > ANIMATION.movementThreshold;
  const runFrame =
    isMoving && !reducedMotion
      ? Math.floor(frame.distanceTravelled * ANIMATION.framesPerMetre) % ANIMATION.runFrameCount
      : 0;
  const stride = isMoving ? (runFrame === 0 ? 2 : runFrame === 2 ? -2 : 0) : 0;
  const ticksSinceKick = tick - frame.lastKickTick;
  const isKicking = ticksSinceKick >= 0 && ticksSinceKick < ANIMATION.kickDurationTicks;
  const isTackling = tick - frame.lastTackleTick < ANIMATION.tackleDurationTicks;
  const isSaving = tick - frame.lastSaveTick < ANIMATION.saveDurationTicks;
  const armLift = isSaving || celebrating ? 5 : frame.guarding ? 2 : 0;
  const headBob = isMoving && !reducedMotion && runFrame % 2 === 1 ? -1 : 0;
  const kit = player.role === 'keeper' ? KEEPER_KITS[player.team] : TEAM_KITS[player.team];

  // Each rectangle is original pixel-art data relative to the player's foot anchor.
  // Pixel offsets describe the sprite, not physics or an implicit collision box.
  const pixel = (x: number, y: number, width: number, height: number, color: string) =>
    drawPixelRect(context, anchor.x + x, anchor.y + y, width, height, color);

  pixel(-6, -1, 14, 4, '#245b42');
  pixel(-4, 0, 10, 4, '#2b6344');
  if (hasBall) {
    context.strokeStyle = '#d3e8a8';
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(anchor.x, anchor.y + 1, 9, 4, 0, 0, Math.PI * 2);
    context.stroke();
  }

  // Legs and feet alternate around a stable ground anchor.
  pixel(-4, -3 + stride, 3, 4, OUTLINE);
  pixel(2, -3 - stride, isTackling ? 7 : 3, isKicking ? 6 : 4, OUTLINE);
  pixel(-5, stride, 4, 2, kit.boots);
  pixel(2, -stride + (isKicking ? 2 : 0), 4, 2, kit.boots);

  // Shirt and opposing arm swing.
  pixel(-5, -11 + headBob, 11, 9, OUTLINE);
  pixel(-4, -10 + headBob, 9, 6, kit.shirt);
  pixel(-3, -10 + headBob, 7, 2, kit.highlight);
  pixel(-8, -10 - stride + headBob - armLift, 3, 5, kit.shade);
  pixel(6, -10 + stride + headBob - armLift, 3, 5, kit.shirt);
  pixel(-7, -7 - stride + headBob - armLift, 2, 2, kit.highlight);
  pixel(7, -7 + stride + headBob - armLift, 2, 2, kit.highlight);

  // Helmet, screen, direction-sensitive eyes and antenna.
  pixel(-7, -22 + headBob, 15, 12, OUTLINE);
  pixel(-6, -21 + headBob, 13, 10, kit.shirt);
  pixel(-5, -20 + headBob, 11, 2, kit.highlight);
  pixel(-4, -17 + headBob, 9, 5, '#183342');
  const eyeOffset =
    Math.abs(frame.facing.x) > ANIMATION.horizontalFacingThreshold
      ? frame.facing.x > 0
        ? 1
        : -1
      : 0;
  pixel(-2 + eyeOffset, -16 + headBob, 2, 2, '#d5f8dc');
  pixel(2 + eyeOffset, -16 + headBob, 2, 2, '#d5f8dc');
  pixel(0, -25 + headBob, 1, 3, '#15313b');
  pixel(-1, -26 + headBob, 3, 2, kit.highlight);
  pixel(-1, -8 + headBob, 3, 2, kit.highlight);

  if (player.role === 'keeper') pixel(-5, -5 + headBob, 2, 2, TEAM_KITS[player.team].shirt);
  if (showNumbers) {
    context.font = '8px monospace';
    context.textAlign = 'center';
    context.fillStyle = '#0d2526';
    context.fillText(String(player.number), anchor.x + 1, anchor.y + 15);
    context.fillStyle = '#e3e8c8';
    context.fillText(String(player.number), anchor.x, anchor.y + 14);
  }
}

function drawBall(context: CanvasRenderingContext2D, frame: Frame): void {
  const ground = worldToScreen(frame.ball);
  drawPixelRect(context, ground.x - 3, ground.y + 1, 8, 3, '#28533d');
  const heightOffset = Math.round(
    (frame.ball.z - BALL_CONTROL.radius) * ANIMATION.ballHeightPixelsPerMetre,
  );
  const ballY = ground.y - heightOffset;
  drawPixelRect(context, ground.x - 3, ballY - 4, 7, 8, '#16313c');
  drawPixelRect(context, ground.x - 4, ballY - 2, 9, 5, '#16313c');
  drawPixelRect(context, ground.x - 2, ballY - 3, 5, 7, '#fff4d8');
  drawPixelRect(context, ground.x - 3, ballY - 1, 7, 3, '#fff4d8');
  drawPixelRect(context, ground.x - 1, ballY - 1, 3, 3, '#264252');
  drawPixelRect(context, ground.x + 1, ballY - 3, 2, 1, '#748b7e');
}

export function drawPlayers(
  context: CanvasRenderingContext2D,
  frame: Frame,
  record: Recording,
  showNumbers: boolean,
  reducedMotion: boolean,
): void {
  const celebration = celebrationFrame(record, frame, reducedMotion);
  frame = celebration.frame;
  const drawingOrder = record.initial.players
    .map((player, index) => ({ player, frame: frame.players[index]! }))
    .sort((first, second) => first.frame.position.y - second.frame.position.y);

  for (const entry of drawingOrder) {
    drawRobot(
      context,
      entry.player,
      entry.frame,
      frame.tick,
      frame.owner === entry.player.id,
      showNumbers,
      reducedMotion,
      celebration.playerIds.has(entry.player.id),
    );
  }
  drawBall(context, frame);
}
