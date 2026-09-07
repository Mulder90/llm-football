import type { Frame, Recording } from '../recording/record.ts';
import { clamp } from '../sim/math.ts';
import { FIELD, TICK_RATE } from '../sim/rules.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

/** A broadcast sprite following the recorded ball. Its position has no rule authority. */
export function drawReferee(context: CanvasRenderingContext2D, frame: Frame, recording: Recording) {
  const anchor = worldToScreen({
    x: clamp(frame.ball.x - 8, 8, FIELD.length - 8),
    y: clamp(frame.ball.y + 9, 8, FIELD.width - 8),
  });
  const card = recording.events.findLast(
    (event) =>
      (event.type === 'yellow_card' || event.type === 'red_card') && event.tick <= frame.tick,
  );
  const showingCard = card && frame.tick - card.tick < 2 * TICK_RATE;
  const pixel = (x: number, y: number, width: number, height: number, color: string) =>
    drawPixelRect(context, anchor.x + x, anchor.y + y, width, height, color);
  pixel(-5, 0, 12, 3, '#245b42');
  pixel(-3, -4, 3, 6, '#132a31');
  pixel(2, -4, 3, 6, '#132a31');
  pixel(-5, -13, 11, 10, '#162e32');
  pixel(-4, -12, 9, 7, '#e9d77b');
  pixel(-7, -11, 3, 7, '#cfb762');
  pixel(6, showingCard ? -22 : -11, 3, showingCard ? 13 : 7, '#cfb762');
  pixel(-5, -22, 11, 9, '#162e32');
  pixel(-4, -21, 9, 7, '#d6dccc');
  pixel(-3, -18, 7, 3, '#203b43');
  pixel(-1, -17, 2, 1, '#f0f5d7');
  if (showingCard) pixel(5, -29, 5, 8, card.type === 'red_card' ? '#ef685b' : '#ffdd64');
}
