import {
  drawKeeperHands,
  keeperBallFrame,
  keeperReleasePose,
  type KeeperReleasePose,
} from './keeper.ts';
import { drawRobotHelmetShell, drawRobotAntenna, TEAM_KITS, type KitPalette } from './robot-art.ts';
import { MOVEMENT, TICK_RATE } from '../sim/rules.ts';
import { clamp, unitVector } from '../sim/math.ts';
import type { Player, Team } from '../sim/types.ts';
import type { Frame, PlayerFrame, Recording } from '../recording/record.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';
import { celebrationFrame, celebrationGesture } from './celebration.ts';
import type { CelebrationFrame, CelebrationGesture } from './celebration.ts';
import { idleRobotPose, robotExpression, robotReactions, robotStyle } from './robot-character.ts';
import type { RobotReaction } from './robot-character.ts';
import { drawBall, drawBallTrail } from './ball.ts';
import type { FootballMoment } from './match-atmosphere.ts';
import { kickoffFrame } from './kickoff.ts';

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
  hands: boolean,
  release: KeeperReleasePose | null,
): void {
  const ground = worldToScreen(frame.position);
  const celebrating = celebration !== null;
  const style = robotStyle(player);
  const jump = reducedMotion ? 0 : Math.round(celebration?.jump ?? 0);
  const preparing = reaction?.gesture === 'prepare-kick' && !celebrating;
  const receiving = reaction?.gesture === 'receive' && !celebrating;
  const shrugging = reaction?.gesture === 'shrug' && !celebrating;
  const pumping = reaction?.gesture === 'save-pump' && !celebrating;
  const frustrated = reaction?.gesture === 'frustrated' && !celebrating;
  const acknowledging = reaction?.gesture === 'acknowledge' && !celebrating;
  const conceded = reaction?.gesture === 'conceded';
  const handsOnHead = conceded && player.number % 3 !== 2;
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
  const isSaving =
    hands && ticksSinceSave >= 0 && ticksSinceSave < ANIMATION.saveDurationTicks && !pumping;
  const focused = hasBall || isKicking || isTackling || isSaving || preparing || receiving;
  const expression = robotExpression(reaction, celebrating, focused);
  const idle = !isMoving && !focused && !celebrating && !reaction && !frame.guarding;
  const idlePose = idle
    ? idleRobotPose(player, animationTick, reducedMotion)
    : { headTilt: 0, headBob: 0, antennaLean: 0 };
  const facingSide = celebrating
    ? 0
    : Math.abs(facing.x) > ANIMATION.horizontalFacingThreshold
      ? Math.sign(facing.x)
      : 0;
  const facingAway = celebrating ? celebration.facingAway : facing.y < -0.65;
  const movingSide = speed > 0 ? frame.velocity.x / speed : 0;
  const movingDepth = speed > 0 ? frame.velocity.y / speed : 0;
  const lean = reducedMotion
    ? 0
    : Math.round(clamp(frame.velocity.x / MOVEMENT.maximumSpeed, -1, 1) * 2);
  const tackleCrouch = isTackling ? (ticksSinceTackle < ANIMATION.tackleReachTicks ? 3 : 1) : 0;
  const headBob = isMoving && !reducedMotion && runFrame % 2 === 1 ? -style.runBob : 0;
  const bodyY =
    headBob +
    tackleCrouch +
    Math.round(celebration?.crouch ?? 0) +
    (conceded || frustrated ? 2 : preparing ? 1 : 0);
  const headSpring =
    isMoving && !reducedMotion
      ? Math.round(Math.sin(frame.distanceTravelled * Math.PI * 1.2) * style.headBounce)
      : 0;
  const headX = lean + facingSide + idlePose.headTilt;
  const helmetY = bodyY + headSpring + idlePose.headBob;
  const torsoSquash =
    !reducedMotion &&
    (celebration?.phase === 'windup' ||
      celebration?.phase === 'landing' ||
      (isMoving && runFrame % 2 === 1))
      ? 1
      : 0;
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
    if (hands && !(pumping && side === 1)) continue;
    if (release && release.delivery !== 'punt') {
      const fraction = reducedMotion ? 1 : Math.min(1, release.ageTicks / 18);
      const overhead = release.delivery === 'throw';
      const handX = lean + side * (7 + Math.round(fraction * 3));
      const handY = overhead ? -20 + Math.round(fraction * 8) : -3 - Math.round(fraction * 3);
      const top = Math.min(-10, handY);
      pixel(handX - 1, top, 3, Math.abs(handY + 10) + 3, OUTLINE);
      pixel(handX, top + 1, 2, Math.abs(handY + 10) + 1, kit.shade);
      pixel(handX - 1, handY, 4, 3, '#f5efd2');
      continue;
    }
    const favouredSide = side === (player.number % 2 === 0 ? -1 : 1);
    const raised =
      celebration?.armPose === 'raised' ||
      ((celebration?.armPose === 'pump' || pumping) && favouredSide);
    const wide = celebration?.armPose === 'wide' || shrugging;
    const asking = receiving && favouredSide;
    const waving = acknowledging && favouredSide;
    const handMotion =
      !reducedMotion && reaction && (waving || (pumping && raised))
        ? Math.round(Math.sin(reaction.ageTicks / 5) * 2)
        : 0;
    const armLift = raised
      ? 17
      : isSaving || frustrated || handsOnHead
        ? 11
        : asking
          ? 12
          : waving
            ? 9
            : frame.guarding
              ? 2
              : 0;
    const spread = wide
      ? 5
      : raised || isSaving || frame.guarding || asking || frustrated || handsOnHead || waving
        ? 2
        : isKicking || preparing
          ? 1
          : 0;
    const handX = lean + side * (7 + spread);
    const handY = wide
      ? -4 + bodyY - (shrugging ? 5 : 0)
      : -6 + bodyY - Math.round(side * stride * style.armSwing) - armLift + handMotion;
    if (wide) {
      for (let segment = 0; segment < 3; segment++) {
        const armX = lean + side * (6 + segment * 2);
        const armY = -10 + bodyY + segment * (shrugging ? 0 : 2);
        pixel(armX - 1, armY, 4, 4, OUTLINE);
        pixel(armX, armY + 1, 2, 2, side < 0 ? kit.shade : kit.shirt);
      }
    } else {
      const lifted = raised || isSaving || asking || frustrated || handsOnHead || waving;
      const armTop = lifted ? handY : handY - 4;
      const armHeight = lifted ? -8 + bodyY - handY : 6;
      pixel(handX - 1, armTop, 3, armHeight, OUTLINE);
      pixel(handX, armTop + 1, 2, armHeight - 2, side < 0 ? kit.shade : kit.shirt);
      if (lifted) pixel(lean + (side < 0 ? -8 : 6), -11 + bodyY, 3, 3, kit.shirt);
    }
    pixel(
      handX - 1,
      handY,
      player.role === 'keeper' ? 4 : 3,
      3,
      player.role === 'keeper' ? '#f5efd2' : kit.highlight,
    );
  }
  // The little neck joint stretches with the head; the boots stay at their existing anchors.
  if (helmetY < bodyY) {
    pixel(headX - 1, -11 + helmetY, 3, bodyY - helmetY + 2, OUTLINE);
    pixel(headX, -10 + helmetY, 1, bodyY - helmetY, kit.shade);
  }
  pixel(-5 + lean - torsoSquash, -11 + bodyY, 11 + torsoSquash * 2, 9, OUTLINE);
  pixel(-4 + lean - torsoSquash, -10 + bodyY, 9 + torsoSquash * 2, 6, kit.shirt);
  pixel(-3 + lean - torsoSquash, -10 + bodyY, 7 + torsoSquash * 2, 2, kit.highlight);
  pixel(-4 + lean - torsoSquash, -5 + bodyY, 9 + torsoSquash * 2, 2, kit.shade);
  if (facingAway) pixel(-2 + lean, -7 + bodyY, 5, 2, kit.shade);
  else {
    pixel(-2 + lean, -7 + bodyY, 2, 2, '#e7efd1');
    pixel(2 + lean, -7 + bodyY, 2, 3, kit.shade);
  }

  // The visor turns within the helmet; an away-facing runner shows its rear panel.
  const headPixel = (x: number, y: number, width: number, height: number, color: string) =>
    pixel(x + headX, y + helmetY, width, height, color);
  drawRobotHelmetShell(headPixel, style.helmet, kit);
  if (facingAway) {
    headPixel(-4, -21, 9, 7, kit.shade);
    headPixel(-3, -20, 7, 2, OUTLINE);
    headPixel(-2, -16, 5, 1, kit.highlight);
  } else {
    headPixel(-5 + facingSide, -22, 11, 10, VISOR);
    const blinking =
      !reducedMotion &&
      expression === 'neutral' &&
      (Math.floor(animationTick) + player.number * 19 + (player.team === 'cyan' ? 71 : 0)) %
        ANIMATION.blinkPeriodTicks <
        ANIMATION.blinkDurationTicks;
    for (const eyeX of [-4, 2]) {
      const x = eyeX + facingSide;
      if (blinking) headPixel(x, -18, 3, 1, EYES);
      else if (expression === 'joy') {
        headPixel(x + 1, -20, 1, 1, EYES);
        headPixel(x, -19, 3, 1, EYES);
        headPixel(x, -18, 1, 1, EYES);
        headPixel(x + 2, -18, 1, 1, EYES);
      } else if (expression === 'frustrated') {
        const outer = eyeX < 0 ? x : x + 2;
        headPixel(outer, -20, 1, 1, EYES);
        headPixel(x + 1, -19, 1, 1, EYES);
        headPixel(outer, -18, 1, 1, EYES);
      } else {
        headPixel(x, -20, 3, expression === 'surprised' ? 4 : 3, EYES);
        if (expression === 'determined') headPixel(eyeX < 0 ? x + 2 : x, -20, 1, 1, VISOR);
        else if (expression === 'neutral') headPixel(x + 1 + facingSide, -18, 1, 1, VISOR);
      }
    }
    if (expression === 'joy') {
      headPixel(-2 + facingSide, -15, 1, 1, EYES);
      headPixel(2 + facingSide, -15, 1, 1, EYES);
      headPixel(-1 + facingSide, -14, 3, 1, EYES);
    } else if (expression === 'frustrated') {
      headPixel(-1 + facingSide, -15, 3, 1, EYES);
      headPixel(-2 + facingSide, -14, 1, 1, EYES);
      headPixel(2 + facingSide, -14, 1, 1, EYES);
    } else
      headPixel(
        facingSide,
        -14,
        expression === 'surprised' ? 2 : 1,
        expression === 'surprised' ? 2 : 1,
        EYES,
      );
  }
  const antennaSway = (!reducedMotion && isMoving ? Math.sign(stride) : 0) + idlePose.antennaLean;
  drawRobotAntenna(headPixel, style.helmet, celebrating ? EYES : kit.highlight, antennaSway);

  if (handsOnHead) {
    for (const side of player.number % 3 === 0 ? [-1, 1] : [1]) {
      headPixel(side * 8 - 1, -25, 4, 4, OUTLINE);
      headPixel(side * 8, -25, 3, 3, player.role === 'keeper' ? '#f5efd2' : kit.highlight);
    }
  }

  if (player.role === 'keeper') pixel(-5 + lean, -5 + bodyY, 2, 2, TEAM_KITS[player.team].shirt);
  if (frame.yellowCards > 0) pixel(17, -23, 3, 5, '#ffe493');
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
  moments: readonly FootballMoment[] = [],
  celebration: CelebrationFrame = celebrationFrame(
    record,
    kickoffFrame(record, frame, reducedMotion),
    reducedMotion,
  ),
): Frame {
  const reactions = robotReactions(record, frame, moments);
  if (celebration.goal) {
    for (const player of record.initial.players)
      if (player.team !== celebration.goal.team)
        reactions.set(player.id, {
          gesture: 'conceded',
          target: null,
          ageTicks: celebration.ageTicks,
        });
  }
  frame = keeperBallFrame(celebration.frame, reducedMotion);
  const ballMoving = drawBallTrail(context, frame, record, reducedMotion);
  const drawingOrder = record.initial.players
    .map((player, index) => {
      const gesture = celebration.playerIds.has(player.id)
        ? celebrationGesture(
            celebration.gestureAges.get(player.id) ?? celebration.ageTicks,
            celebration.scorerId === player.id,
            player.number,
            player.team,
          )
        : null;
      const layer =
        gesture && player.id === celebration.scorerId ? 2 : gesture && gesture.jump > 0 ? 1 : 0;
      return { player, frame: frame.players[index]!, gesture, layer };
    })
    .filter((entry) => !entry.frame.dismissed)
    .sort(
      (first, second) =>
        first.layer - second.layer || first.frame.position.y - second.frame.position.y,
    );

  for (const entry of drawingOrder) {
    drawRobot(
      context,
      entry.player,
      entry.frame,
      frame.tick,
      frame.owner === entry.player.id,
      showNumbers,
      reducedMotion,
      entry.gesture,
      reactions.get(entry.player.id),
      animationTick,
      frame.owner === entry.player.id && Boolean(frame.handControl),
      entry.player.role === 'keeper' ? keeperReleasePose(record, frame, entry.player.id) : null,
    );
    if (frame.handControl && frame.owner === entry.player.id)
      drawKeeperHands(
        context,
        frame,
        record.initial.players.findIndex((player) => player.id === entry.player.id),
        reactions.get(entry.player.id)?.gesture === 'save-pump',
      );
  }
  const carrierIndex = record.initial.players.findIndex((player) => player.id === frame.owner);
  const carrier = frame.players[carrierIndex];
  const carrying =
    carrier && Math.hypot(carrier.velocity.x, carrier.velocity.y) > ANIMATION.movementThreshold;
  if (!frame.handControl)
    drawBall(context, frame, !reducedMotion && (ballMoving || Boolean(carrying)));
  return frame;
}
