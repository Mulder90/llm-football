import { MOVEMENT, TICK_RATE } from '../sim/rules.ts';
import { unitVector } from '../sim/math.ts';
import type { Player, Team } from '../sim/types.ts';
import type { Frame, PlayerFrame, Recording } from '../recording/record.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';
import { celebrationFrame, celebrationGesture } from './celebration.ts';
import type { CelebrationGesture } from './celebration.ts';
import { robotReactions, robotStyle } from './robot-character.ts';
import type { RobotReaction } from './robot-character.ts';
import { drawBall, drawBallTrail } from './ball.ts';

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
  horizontalFacingThreshold: 0.3,
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
  celebration: CelebrationGesture | null,
  reaction: RobotReaction | undefined,
  animationTick: number,
): void {
  const ground = worldToScreen(frame.position);
  const celebrating = celebration !== null;
  const style = robotStyle(player);
  const jump = reducedMotion ? 0 : Math.round(celebration?.jump ?? 0);
  const preparing = reaction?.gesture === 'prepare-kick' && !celebrating;
  const receiving = reaction?.gesture === 'receive' && !celebrating;
  const shrugging = reaction?.gesture === 'shrug' && !celebrating;
  const conceded = reaction?.gesture === 'conceded';
  const facing =
    preparing && reaction.target
      ? unitVector({
          x: reaction.target.x - frame.position.x,
          y: reaction.target.y - frame.position.y,
        })
      : frame.facing;
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
  const facingSide = celebrating
    ? 0
    : Math.abs(facing.x) > ANIMATION.horizontalFacingThreshold
      ? Math.sign(facing.x)
      : 0;
  const facingAway = celebrating ? celebration.facingAway : facing.y < -0.65;
  const movingSide = speed > 0 ? frame.velocity.x / speed : 0;
  const movingDepth = speed > 0 ? frame.velocity.y / speed : 0;
  const lean = reducedMotion ? 0 : Math.round((frame.velocity.x / MOVEMENT.maximumSpeed) * 2);
  const tackleCrouch = isTackling ? (ticksSinceTackle < ANIMATION.tackleReachTicks ? 3 : 1) : 0;
  const headBob = isMoving && !reducedMotion && runFrame % 2 === 1 ? -style.runBob : 0;
  const bodyY =
    headBob +
    tackleCrouch +
    Math.round(celebration?.crouch ?? 0) +
    (conceded ? 2 : preparing ? 1 : 0);
  const headX = lean + facingSide;
  const kit = player.role === 'keeper' ? KEEPER_KITS[player.team] : TEAM_KITS[player.team];

  // Ground markings never hop with the sprite. Foot position remains the spatial anchor.
  context.save();
  context.globalAlpha = 0.3;
  drawPixelRect(context, ground.x - 6, ground.y, 13, 3, '#103d32');
  drawPixelRect(context, ground.x - 4, ground.y - 1, 9, 5, '#103d32');
  context.restore();
  if (reaction?.gesture === 'control' && !celebrating) {
    drawPixelRect(context, ground.x - 10, ground.y - 5, 2, 2, EYES);
    drawPixelRect(context, ground.x + 9, ground.y - 3, 2, 2, EYES);
  }
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
  const reach = preparing ? -3 : Math.max(kickReach, tackleReach);
  const extendedSide = facingSide < 0 ? -1 : 1;
  for (const side of [-1, 1]) {
    const isExtended = side === extendedSide;
    const footX =
      side * (3 + (celebration?.footSpread ?? 0)) +
      side * strideX +
      (isExtended ? Math.round(facing.x * reach) : 0);
    const footY = side * strideY + (isExtended ? Math.round(facing.y * reach) : 0);
    pixel(footX - 1, footY - 4, 3, 5, OUTLINE);
    pixel(footX - 1, footY - 3, 2, 2, kit.shade);
    pixel(footX - 2, footY, 4, 2, OUTLINE);
    pixel(footX - 2, footY, 3, 1, kit.boots);
  }

  // Individual arm swings, receiver signals and scorer salutes share the same small sprite.
  for (const side of [-1, 1]) {
    const raised =
      celebration?.armPose === 'raised' ||
      (celebration?.armPose === 'pump' && side === (player.number % 2 === 0 ? -1 : 1));
    const wide = celebration?.armPose === 'wide' || shrugging;
    const asking = receiving && side === (player.number % 2 === 0 ? -1 : 1);
    const armLift = raised ? 17 : isSaving ? 11 : asking ? 12 : frame.guarding ? 2 : 0;
    const spread = wide
      ? 5
      : raised || isSaving || frame.guarding || asking
        ? 2
        : isKicking || preparing
          ? 1
          : 0;
    const handX = lean + side * (7 + spread);
    const handY = wide
      ? -4 + bodyY - (shrugging ? 5 : 0)
      : -6 + bodyY - Math.round(side * stride * style.armSwing) - armLift;
    if (wide) {
      for (let segment = 0; segment < 3; segment++) {
        const armX = lean + side * (6 + segment * 2);
        const armY = -10 + bodyY + segment * (shrugging ? 0 : 2);
        pixel(armX - 1, armY, 4, 4, OUTLINE);
        pixel(armX, armY + 1, 2, 2, side < 0 ? kit.shade : kit.shirt);
      }
    } else {
      const armTop = raised || isSaving || asking ? handY : handY - 4;
      const armHeight = raised || isSaving || asking ? -8 + bodyY - handY : 6;
      pixel(handX - 1, armTop, 3, armHeight, OUTLINE);
      pixel(handX, armTop + 1, 2, armHeight - 2, side < 0 ? kit.shade : kit.shirt);
      if (raised || isSaving || asking)
        pixel(lean + (side < 0 ? -8 : 6), -11 + bodyY, 3, 3, kit.shirt);
    }
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
  if (facingAway) pixel(-2 + lean, -7 + bodyY, 5, 2, kit.shade);
  else {
    pixel(-2 + lean, -7 + bodyY, 2, 2, '#e7efd1');
    pixel(2 + lean, -7 + bodyY, 2, 3, kit.shade);
  }

  // The visor turns within the helmet; an away-facing runner shows its rear panel.
  const headPixel = (x: number, y: number, width: number, height: number, color: string) =>
    pixel(x + headX, y + bodyY, width, height, color);
  headPixel(-7, -22, 15, 12, OUTLINE);
  headPixel(-6, -21, 13, 10, kit.shirt);
  headPixel(-5, -20, 11, 2, kit.highlight);
  headPixel(5, -18, 2, 7, kit.shade);
  headPixel(-8, -17, 2, 4, kit.shade);
  headPixel(7, -17, 2, 4, kit.shade);
  if (style.variant === 1) headPixel(-1, -21, 2, 3, kit.shade);
  else if (style.variant === 2) headPixel(-5, -20, 3, 3, '#eff0cb');
  if (facingAway) {
    headPixel(-3, -17, 7, 4, kit.shade);
    headPixel(-2, -16, 5, 1, OUTLINE);
    headPixel(-2, -14, 3, 1, kit.highlight);
  } else {
    headPixel(-4 + facingSide, -18, 9, 6, VISOR);
    const blinking =
      !reducedMotion &&
      !celebrating &&
      !isSaving &&
      (Math.floor(animationTick) + player.number * 19 + (player.team === 'cyan' ? 71 : 0)) %
        ANIMATION.blinkPeriodTicks <
        ANIMATION.blinkDurationTicks;
    for (const eyeX of [-2, 2]) {
      const eyeHeight = blinking || conceded ? 1 : reaction?.gesture === 'control' ? 3 : 2;
      headPixel(eyeX + facingSide, -16 + (shrugging && eyeX < 0 ? -1 : 0), 2, eyeHeight, EYES);
      if (celebrating) headPixel(eyeX + facingSide - 1, -15, 1, 1, EYES);
    }
    if (celebrating) headPixel(-1 + facingSide, -13, 3, 1, kit.highlight);
    else if (isKicking || isTackling || preparing) headPixel(-2 + facingSide, -18, 6, 1, kit.shade);
    else if (conceded) headPixel(-1 + facingSide, -13, 3, 1, kit.shade);
  }
  const antennaSway = !reducedMotion && isMoving ? Math.sign(stride) : 0;
  const antenna = antennaSway + style.antennaOffset;
  headPixel(antenna, -25, 1, 3, OUTLINE);
  headPixel(-1 + antenna, -26, 3, 2, celebrating ? EYES : kit.highlight);
  if (style.variant === 2) {
    headPixel(4 - antennaSway, -24, 1, 2, OUTLINE);
    headPixel(3 - antennaSway, -25, 3, 1, kit.highlight);
  }

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

export function drawPlayers(
  context: CanvasRenderingContext2D,
  frame: Frame,
  record: Recording,
  showNumbers: boolean,
  reducedMotion: boolean,
  animationTick = frame.tick,
): Frame {
  const celebration = celebrationFrame(record, frame, reducedMotion);
  const reactions = robotReactions(record, frame);
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
      celebration.playerIds.has(entry.player.id)
        ? celebrationGesture(
            celebration.ageTicks,
            celebration.scorerId === entry.player.id,
            entry.player.number,
          )
        : null,
      reactions.get(entry.player.id),
      animationTick,
    );
  }
  const carrierIndex = record.initial.players.findIndex((player) => player.id === frame.owner);
  const carrier = frame.players[carrierIndex];
  const carrying =
    carrier && Math.hypot(carrier.velocity.x, carrier.velocity.y) > ANIMATION.movementThreshold;
  drawBall(context, frame, !reducedMotion && (ballMoving || Boolean(carrying)));
  return frame;
}
