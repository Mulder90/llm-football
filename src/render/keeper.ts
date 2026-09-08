import type { Frame, Recording } from '../recording/record.ts';
import { clamp } from '../sim/math.ts';
import { KEEPER, TICK_RATE } from '../sim/rules.ts';
import type { MatchEvent } from '../sim/types.ts';
import { ballScreenPosition, drawBall } from './ball.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

const COLLECTION_TICKS = 18;
const RELEASE_TICKS = 24;
export type KeeperReleasePose = { delivery: NonNullable<MatchEvent['delivery']>; ageTicks: number };

/** A successful recorded collection permits the scoop/settle; no pose can invent a catch. */
export function keeperBallFrame(frame: Frame, reducedMotion: boolean): Frame {
  const held = frame.handControl;
  if (!held || !frame.owner || reducedMotion) return frame;
  const fraction = clamp((frame.tick - held.sinceTick - 1) / COLLECTION_TICKS, 0, 1);
  return {
    ...frame,
    ball: { ...frame.ball, z: held.height + (frame.ball.z - held.height) * fraction },
  };
}

export function keeperReleasePose(
  recording: Recording,
  frame: Frame,
  playerId: string,
): KeeperReleasePose | null {
  const release = recording.events.findLast(
    (event) =>
      event.playerId === playerId &&
      event.type === 'keeper_release' &&
      event.tick + 1 <= frame.tick,
  );
  if (!release?.delivery || release.tick < frame.phase.sinceTick) return null;
  const ageTicks = frame.tick - release.tick - 1;
  return ageTicks < RELEASE_TICKS ? { delivery: release.delivery, ageTicks } : null;
}

/** The signal follows playing ticks, independent of seek order and playback speed. */
export function keeperCountdown(frame: Frame): number | null {
  if (!frame.handControl || !frame.owner || frame.phase.type !== 'open_play') return null;
  const remaining =
    KEEPER.maximumHoldTicks - (frame.playingTicks - frame.handControl.sincePlayingTick);
  return remaining <= KEEPER.countdownTicks ? Math.max(0, Math.ceil(remaining / TICK_RATE)) : null;
}

/** Draw once with the carrier's body layer; the held ball stays between actual gloved hands. */
export function drawKeeperHands(
  context: CanvasRenderingContext2D,
  frame: Frame,
  ownerIndex: number,
  pumping: boolean,
): void {
  const anchor = worldToScreen(frame.players[ownerIndex]!.position);
  const ball = ballScreenPosition(frame);
  for (const side of [-1, 1]) {
    if (pumping && side === 1) continue; // The other glove retains the ball during the save salute.
    const shoulder = { x: anchor.x + side * 5, y: anchor.y - 9 };
    const hand = { x: ball.x + side * 5, y: ball.y };
    const segments = Math.max(
      1,
      Math.ceil(Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y) / 2),
    );
    for (let index = 0; index <= segments; index++) {
      const fraction = index / segments;
      const x = shoulder.x + (hand.x - shoulder.x) * fraction;
      const y = shoulder.y + (hand.y - shoulder.y) * fraction;
      drawPixelRect(context, x - 1, y - 1, 3, 3, '#122b35');
      drawPixelRect(context, x, y, 1, 1, '#d0c477');
    }
  }
  drawBall(context, frame, false);
  for (const side of [-1, 1]) {
    if (pumping && side === 1) continue;
    drawPixelRect(context, ball.x + side * 5 - 2, ball.y - 3, 4, 6, '#122b35');
    drawPixelRect(context, ball.x + side * 5 - 1, ball.y - 2, 3, 4, '#f5efd2');
  }
}
