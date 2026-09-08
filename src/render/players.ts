import { BALL_CONTROL, MOVEMENT, TICK_RATE } from '../sim/rules.ts';
import type { Player, Team } from '../sim/types.ts';
import type { Frame, PlayerFrame, Recording } from '../recording/record.ts';
import { sample } from '../recording/record.ts';
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
  kickFollowThroughTicks: 6,
  kickDurationTicks: 18,
  tackleReachTicks: 10,
  tackleDurationTicks: 24,
  saveDurationTicks: 36,
  blinkPeriodTicks: 4 * TICK_RATE,
  blinkDurationTicks: 5,
  trailSampleTicks: 3,
  horizontalFacingThreshold: 0.3,
  ballHeightPixelsPerMetre: 5,
} as const;
const OUTLINE = '#122b35';
const VISOR = '#183342';
const EYES = '#e4ffe8';

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
  const ground = worldToScreen(frame.position);
  const jump =
    celebrating && !reducedMotion
      ? Math.round(Math.abs(Math.sin(tick / 7 + player.number)) * 4)
      : 0;
  const speed = Math.hypot(frame.velocity.x, frame.velocity.y);
  const isMoving = speed > ANIMATION.movementThreshold;
  const runFrame =
    isMoving && !reducedMotion
      ? Math.floor(frame.distanceTravelled * ANIMATION.framesPerMetre) % ANIMATION.runFrameCount
      : 0;
  const stride = isMoving && !reducedMotion ? [2, 0, -2, 0][runFrame]! : 0;
  const ticksSinceKick = tick - frame.lastKickTick;
  const isKicking = ticksSinceKick >= 0 && ticksSinceKick < ANIMATION.kickDurationTicks;
  const ticksSinceTackle = tick - frame.lastTackleTick;
  const isTackling = ticksSinceTackle >= 0 && ticksSinceTackle < ANIMATION.tackleDurationTicks;
  const ticksSinceSave = tick - frame.lastSaveTick;
  const isSaving = ticksSinceSave >= 0 && ticksSinceSave < ANIMATION.saveDurationTicks;
  const facingSide =
    Math.abs(frame.facing.x) > ANIMATION.horizontalFacingThreshold ? Math.sign(frame.facing.x) : 0;
  const facingAway = frame.facing.y < -0.65;
  const movingSide = speed > 0 ? frame.velocity.x / speed : 0;
  const movingDepth = speed > 0 ? frame.velocity.y / speed : 0;
  const lean = reducedMotion ? 0 : Math.round((frame.velocity.x / MOVEMENT.maximumSpeed) * 2);
  const tackleCrouch = isTackling ? (ticksSinceTackle < ANIMATION.tackleReachTicks ? 3 : 1) : 0;
  const headBob = isMoving && !reducedMotion && runFrame % 2 === 1 ? -1 : 0;
  const bodyY = headBob + tackleCrouch;
  const headX = lean + facingSide;
  const kit = player.role === 'keeper' ? KEEPER_KITS[player.team] : TEAM_KITS[player.team];

  // Ground markings never hop with the sprite. Foot position remains the spatial anchor.
  context.save();
  context.globalAlpha = 0.3;
  drawPixelRect(context, ground.x - 6, ground.y, 13, 3, '#103d32');
  drawPixelRect(context, ground.x - 4, ground.y - 1, 9, 5, '#103d32');
  context.restore();
  if (hasBall) {
    const ring = (x: number, y: number, width: number, height: number) =>
      drawPixelRect(context, ground.x + x, ground.y + y, width, height, '#d7e9a8');
    ring(-7, -2, 4, 1);
    ring(4, -2, 4, 1);
    ring(-9, 0, 1, 3);
    ring(9, 0, 1, 3);
    ring(-6, 5, 4, 1);
    ring(3, 5, 4, 1);
  }

  // Each rectangle is original pixel-art data relative to the player's foot anchor.
  // Pixel offsets describe the sprite, not physics or an implicit collision box.
  const pixel = (x: number, y: number, width: number, height: number, color: string) =>
    drawPixelRect(context, ground.x + x, ground.y - jump + y, width, height, color);

  // Travel distance drives the walk cycle; side-on runs extend along their direction of travel.
  const strideX = Math.round(stride * movingSide);
  const strideY = Math.round(stride * (0.6 + Math.abs(movingDepth) * 0.4));
  const kickReach = isKicking ? (ticksSinceKick < ANIMATION.kickFollowThroughTicks ? 4 : 2) : 0;
  const tackleReach = isTackling && ticksSinceTackle < ANIMATION.tackleReachTicks ? 5 : 0;
  const reach = Math.max(kickReach, tackleReach);
  const extendedSide = facingSide < 0 ? -1 : 1;
  for (const side of [-1, 1]) {
    const isExtended = side === extendedSide;
    const footX = side * 3 + side * strideX + (isExtended ? Math.round(frame.facing.x * reach) : 0);
    const footY = side * strideY + (isExtended ? Math.round(frame.facing.y * reach) : 0);
    pixel(footX - 1, footY - 4, 3, 5, OUTLINE);
    pixel(footX - 1, footY - 3, 2, 2, kit.shade);
    pixel(footX - 2, footY, 4, 2, OUTLINE);
    pixel(footX - 2, footY, 3, 1, kit.boots);
  }

  // Arms counter the feet. Keepers spread actual gloves; celebrations have raised elbows.
  for (const side of [-1, 1]) {
    const armLift = celebrating ? 17 : isSaving ? 11 : frame.guarding ? 2 : 0;
    const spread = celebrating || isSaving || frame.guarding ? 2 : isKicking ? 1 : 0;
    const handX = lean + side * (7 + spread);
    const handY = -6 + bodyY - side * stride - armLift;
    const armTop = celebrating || isSaving ? handY : handY - 4;
    const armHeight = celebrating || isSaving ? -8 + bodyY - handY : 6;
    pixel(handX - 1, armTop, 3, armHeight, OUTLINE);
    pixel(handX, armTop + 1, 2, armHeight - 2, side < 0 ? kit.shade : kit.shirt);
    if (celebrating || isSaving) pixel(lean + (side < 0 ? -8 : 6), -11 + bodyY, 3, 3, kit.shirt);
    pixel(
      handX - 1,
      handY,
      player.role === 'keeper' ? 4 : 3,
      3,
      player.role === 'keeper' ? '#f5efd2' : kit.highlight,
    );
  }
  pixel(-5 + lean, -11 + bodyY, 11, 9, OUTLINE);
  pixel(-4 + lean, -10 + bodyY, 9, 6, kit.shirt);
  pixel(-3 + lean, -10 + bodyY, 7, 2, kit.highlight);
  pixel(-4 + lean, -5 + bodyY, 9, 2, kit.shade);
  pixel(-2 + lean, -7 + bodyY, 2, 2, '#e7efd1');
  pixel(2 + lean, -7 + bodyY, 2, 3, kit.shade);

  // The visor turns within the helmet; an away-facing runner shows its rear panel.
  const headPixel = (x: number, y: number, width: number, height: number, color: string) =>
    pixel(x + headX, y + bodyY, width, height, color);
  headPixel(-7, -22, 15, 12, OUTLINE);
  headPixel(-6, -21, 13, 10, kit.shirt);
  headPixel(-5, -20, 11, 2, kit.highlight);
  headPixel(5, -18, 2, 7, kit.shade);
  headPixel(-8, -17, 2, 4, kit.shade);
  headPixel(7, -17, 2, 4, kit.shade);
  if (facingAway && !celebrating) {
    headPixel(-3, -17, 7, 4, kit.shade);
    headPixel(-2, -16, 5, 1, OUTLINE);
    headPixel(-2, -14, 3, 1, kit.highlight);
  } else {
    headPixel(-4 + facingSide, -18, 9, 6, VISOR);
    const blinking =
      !reducedMotion &&
      !celebrating &&
      !isSaving &&
      (Math.floor(tick) + player.number * 19 + (player.team === 'cyan' ? 71 : 0)) %
        ANIMATION.blinkPeriodTicks <
        ANIMATION.blinkDurationTicks;
    for (const eyeX of [-2, 2]) {
      headPixel(eyeX + facingSide, -16, 2, blinking ? 1 : 2, EYES);
      if (celebrating) headPixel(eyeX + facingSide - 1, -15, 1, 1, EYES);
    }
    if (celebrating) headPixel(-1 + facingSide, -13, 3, 1, kit.highlight);
    else if (isKicking || isTackling) headPixel(-2 + facingSide, -18, 6, 1, kit.shade);
  }
  const antennaSway = !reducedMotion && isMoving ? Math.sign(stride) : 0;
  headPixel(antennaSway, -25, 1, 3, OUTLINE);
  headPixel(-1 + antennaSway, -26, 3, 2, celebrating ? EYES : kit.highlight);

  if (player.role === 'keeper') pixel(-5 + lean, -5 + bodyY, 2, 2, TEAM_KITS[player.team].shirt);
  if (frame.yellowCards > 0) pixel(9, -23, 3, 5, '#ffe493');
  if (showNumbers) {
    context.font = '8px monospace';
    context.textAlign = 'center';
    context.fillStyle = '#0d2526';
    context.fillText(String(player.number), ground.x + 1, ground.y + 15);
    context.fillStyle = '#e3e8c8';
    context.fillText(String(player.number), ground.x, ground.y + 14);
  }
}

function ballScreenPosition(frame: Frame) {
  const ground = worldToScreen(frame.ball);
  const heightOffset = Math.round(
    (frame.ball.z - BALL_CONTROL.radius) * ANIMATION.ballHeightPixelsPerMetre,
  );
  return { x: ground.x, y: ground.y - heightOffset };
}

/** Two past positions help track a loose ball; never bridge a restart or a change of owner. */
function drawBallTrail(
  context: CanvasRenderingContext2D,
  frame: Frame,
  record: Recording,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion || frame.owner || frame.phase.type !== 'open_play') return false;
  const ball = ballScreenPosition(frame);
  let moving = false;
  context.save();
  for (const age of [2, 1]) {
    const previous = sample(
      record,
      Math.max(0, frame.tick - age * ANIMATION.trailSampleTicks) / TICK_RATE,
    );
    if (
      previous.owner ||
      previous.phase.type !== frame.phase.type ||
      previous.phase.sinceTick !== frame.phase.sinceTick
    )
      continue;
    const point = ballScreenPosition(previous);
    if (Math.hypot(ball.x - point.x, ball.y - point.y) < 4) continue;
    moving = true;
    context.globalAlpha = age === 1 ? 0.32 : 0.15;
    drawPixelRect(context, point.x - 1, point.y - 1, 3, 2, '#fff4d8');
  }
  context.restore();
  return moving;
}

function drawBall(context: CanvasRenderingContext2D, frame: Frame, moving: boolean): void {
  const ground = worldToScreen(frame.ball);
  context.save();
  context.globalAlpha = 0.5;
  drawPixelRect(context, ground.x - 3, ground.y + 1, 8, 3, '#123d31');
  context.restore();
  const ballY = ballScreenPosition(frame).y;
  drawPixelRect(context, ground.x - 3, ballY - 4, 7, 8, '#16313c');
  drawPixelRect(context, ground.x - 4, ballY - 2, 9, 5, '#16313c');
  drawPixelRect(context, ground.x - 2, ballY - 3, 5, 7, '#fff4d8');
  drawPixelRect(context, ground.x - 3, ballY - 1, 7, 3, '#fff4d8');
  const panel = moving
    ? [
        { x: -1, y: -1 },
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: -2, y: 0 },
      ][Math.floor(frame.tick / 4) % 4]!
    : { x: -1, y: -1 };
  drawPixelRect(context, ground.x + panel.x, ballY + panel.y, 3, 2, '#264252');
  drawPixelRect(context, ground.x + 1, ballY - 3, 2, 1, '#748b7e');
  drawPixelRect(context, ground.x - 2, ballY - 3, 2, 1, '#ffffff');
}

export function drawPlayers(
  context: CanvasRenderingContext2D,
  frame: Frame,
  record: Recording,
  showNumbers: boolean,
  reducedMotion: boolean,
): Frame {
  const celebration = celebrationFrame(record, frame, reducedMotion);
  frame = celebration.frame;
  const ballMoving = drawBallTrail(context, frame, record, reducedMotion);
  const drawingOrder = record.initial.players
    .map((player, index) => ({ player, frame: frame.players[index]! }))
    .filter((entry) => !entry.frame.dismissed)
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
  drawBall(context, frame, ballMoving);
  return frame;
}
