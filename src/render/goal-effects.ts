import type { Frame, Recording } from '../recording/record.ts';
import { FIELD } from '../sim/rules.ts';
import { celebrationFrame, celebrationGesture, GOAL_PRESENTATION } from './celebration.ts';
import type { CelebrationFrame } from './celebration.ts';
import { PITCH_LAYOUT, worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

const GOAL_EFFECTS = {
  netDepthPixels: 18,
  netGridPixels: 5,
  rippleDurationSeconds: 0.65,
  confettiDurationSeconds: 3.1,
  confettiPieces: 28,
  confettiReachPixels: 48,
} as const;

function drawCelebrationStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  drawPixelRect(context, x - 1, y - 4, 3, 9, color);
  drawPixelRect(context, x - 4, y - 1, 9, 3, color);
  drawPixelRect(context, x - 2, y - 2, 5, 5, color);
  drawPixelRect(context, x, y - 1, 1, 3, '#fff8dd');
}

/** Local net/stand reaction sampled from the goal's age, with no mutable particle state. */
export function drawGoalEffects(
  context: CanvasRenderingContext2D,
  frame: Frame,
  record: Recording,
  reducedMotion: boolean,
  celebration: CelebrationFrame = celebrationFrame(record, frame, reducedMotion),
): void {
  if (!celebration.goal || reducedMotion || celebration.canonical) return;
  const { goal, ageTicks, watchAgeSeconds } = celebration;
  const firstHalfDirection = goal.team === 'coral' ? 1 : -1;
  const direction = frame.half === 1 ? firstHalfDirection : -firstHalfDirection;
  const goalCenter = worldToScreen({ x: direction === 1 ? FIELD.length : 0, y: FIELD.width / 2 });
  const halfGoalPixels = (FIELD.goalWidth * PITCH_LAYOUT.pixelsPerMetre) / 2;
  const teamColor = goal.team === 'coral' ? '#ff917f' : '#91ebe3';
  const confettiAge = watchAgeSeconds - GOAL_PRESENTATION.gatheringEndSeconds;
  const progress = Math.max(0, Math.min(1, confettiAge / GOAL_EFFECTS.confettiDurationSeconds));
  const fade = Math.max(0, 1 - progress);

  context.save();
  if (watchAgeSeconds < GOAL_EFFECTS.rippleDurationSeconds) {
    const ripple = watchAgeSeconds / GOAL_EFFECTS.rippleDurationSeconds;
    context.globalAlpha = (1 - ripple) * 0.7;
    for (let row = -halfGoalPixels + 3; row < halfGoalPixels; row += GOAL_EFFECTS.netGridPixels) {
      const displacement = Math.sin(ripple * Math.PI * 4 + row / 9) * (1 - ripple) * 3;
      const nearX = goalCenter.x + direction * 3;
      const farX = goalCenter.x + direction * (GOAL_EFFECTS.netDepthPixels + displacement);
      drawPixelRect(
        context,
        Math.min(nearX, farX),
        goalCenter.y + row,
        Math.abs(farX - nearX),
        1,
        '#fff4d8',
      );
    }
  }

  const corner = celebration.corner ? worldToScreen(celebration.corner) : goalCenter;
  const verticalDirection = celebration.corner?.y === 0 ? -1 : 1;
  context.globalAlpha = confettiAge >= 0 ? fade * 0.85 : 0;
  for (let piece = 0; piece < GOAL_EFFECTS.confettiPieces; piece++) {
    const side = piece % 2 === 0 ? -1 : 1;
    const spread = piece / GOAL_EFFECTS.confettiPieces;
    const travel = GOAL_EFFECTS.confettiReachPixels * (0.4 + spread) * progress;
    const arc = Math.sin(progress * Math.PI) * (12 + (piece % 5) * 3);
    const x = corner.x + direction * (5 + travel * (side > 0 ? 0.75 : 0.25));
    const y = corner.y + verticalDirection * (5 + travel * 0.45) - arc * 0.2;
    const color = piece % 3 === 0 ? '#fff0bd' : teamColor;
    if (piece % 7 === 0) drawCelebrationStar(context, x, y, color);
    else {
      drawPixelRect(context, x, y, piece % 2 === 0 ? 3 : 2, piece % 3 === 0 ? 2 : 4, color);
      if (piece % 5 === 0) {
        // Short stepped streamers burst into the corner concourse, outside live play.
        drawPixelRect(context, x + direction * 2, y - 3, 2, 4, color);
        drawPixelRect(context, x + direction * 4, y - 5, 2, 3, color);
      }
    }
  }
  if (
    celebration.scorerId &&
    celebration.focus &&
    celebration.playerIds.has(celebration.scorerId)
  ) {
    const gesture = celebrationGesture(ageTicks, true, 0, goal.team!);
    if (gesture.landingPulse > 0) {
      const landing = worldToScreen(celebration.focus);
      const spread = 9 + (1 - gesture.landingPulse) * 11;
      context.globalAlpha = gesture.landingPulse * 0.7;
      for (const side of [-1, 1]) {
        drawPixelRect(context, landing.x + side * spread, landing.y + 2, 3, 1, '#fff0bd');
        drawPixelRect(context, landing.x + side * (spread + 4), landing.y, 2, 2, teamColor);
        drawPixelRect(context, landing.x + side * (spread - 3), landing.y + 5, 2, 1, '#fff0bd');
        if (gesture.landingPulse > 0.25)
          drawCelebrationStar(context, landing.x + side * (spread + 8), landing.y - 3, teamColor);
      }
    }
  }
  context.restore();
}
