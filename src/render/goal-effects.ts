import type { Frame, Recording } from '../recording/record.ts';
import { FIELD, TICK_RATE } from '../sim/rules.ts';
import {
  activeGoal,
  celebrationFrame,
  celebrationGesture,
  GOAL_PRESENTATION,
} from './celebration.ts';
import { PITCH_LAYOUT, worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

const GOAL_EFFECTS = {
  netDepthPixels: 18,
  netGridPixels: 5,
  rippleDurationTicks: 0.85 * TICK_RATE,
  confettiPieces: 18,
  confettiReachPixels: 40,
} as const;

/** Local net/stand reaction sampled from the goal's age, with no mutable particle state. */
export function drawGoalEffects(
  context: CanvasRenderingContext2D,
  frame: Frame,
  record: Recording,
  reducedMotion: boolean,
): void {
  const moment = activeGoal(record, frame);
  if (!moment || reducedMotion) return;
  const { event: goal, ageTicks } = moment;
  const firstHalfDirection = goal.team === 'coral' ? 1 : -1;
  const direction = frame.half === 1 ? firstHalfDirection : -firstHalfDirection;
  const goalCenter = worldToScreen({ x: direction === 1 ? FIELD.length : 0, y: FIELD.width / 2 });
  const halfGoalPixels = (FIELD.goalWidth * PITCH_LAYOUT.pixelsPerMetre) / 2;
  const teamColor = goal.team === 'coral' ? '#ff917f' : '#91ebe3';
  const progress = ageTicks / GOAL_PRESENTATION.durationTicks;
  const fade = Math.max(0, 1 - progress);

  context.save();
  if (ageTicks < GOAL_EFFECTS.rippleDurationTicks) {
    const ripple = ageTicks / GOAL_EFFECTS.rippleDurationTicks;
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

  context.globalAlpha = fade * 0.85;
  for (let piece = 0; piece < GOAL_EFFECTS.confettiPieces; piece++) {
    const side = piece % 2 === 0 ? -1 : 1;
    const spread = piece / GOAL_EFFECTS.confettiPieces;
    const travel = GOAL_EFFECTS.confettiReachPixels * (0.4 + spread) * progress;
    const arc = Math.sin(progress * Math.PI) * (12 + (piece % 5) * 3);
    const x = goalCenter.x + direction * (8 + travel);
    const y = goalCenter.y + side * (halfGoalPixels + 7 + travel * 0.5) - arc;
    const color = piece % 3 === 0 ? '#fff0bd' : teamColor;
    drawPixelRect(context, x, y, piece % 2 === 0 ? 3 : 2, piece % 3 === 0 ? 2 : 4, color);
  }
  const celebration = celebrationFrame(record, frame, false);
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
      }
    }
  }
  context.restore();
}
