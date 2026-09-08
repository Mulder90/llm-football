import { BALL_CONTROL, TICK_RATE } from '../sim/rules.ts';
import { sample } from '../recording/record.ts';
import type { Frame, Recording } from '../recording/record.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

// Height is exaggerated for legibility; its ground shadow always marks the physical x/y.
const BALL_ART = { heightPixelsPerMetre: 12, trailSampleTicks: 3 } as const;

export function ballScreenPosition(frame: Frame) {
  const ground = worldToScreen(frame.ball);
  const heightOffset = Math.round(
    (frame.ball.z - BALL_CONTROL.radius) * BALL_ART.heightPixelsPerMetre,
  );
  return { x: ground.x, y: ground.y - heightOffset };
}

/** Two past positions help track a loose ball; never bridge a restart or a change of owner. */
export function drawBallTrail(
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
      Math.max(0, frame.tick - age * BALL_ART.trailSampleTicks) / TICK_RATE,
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

export function drawBall(context: CanvasRenderingContext2D, frame: Frame, moving: boolean): void {
  const ground = worldToScreen(frame.ball);
  context.save();
  const altitude = Math.max(0, frame.ball.z - BALL_CONTROL.radius);
  const shadowWidth = 8 + Math.min(5, Math.round(altitude * 1.5));
  context.globalAlpha = Math.max(0.22, 0.5 - altitude * 0.06);
  drawPixelRect(
    context,
    ground.x - Math.floor(shadowWidth / 2),
    ground.y + 1,
    shadowWidth,
    3,
    '#123d31',
  );
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
