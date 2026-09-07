import type { Frame, Recording } from '../recording/record.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

/** Inspect an order without influencing movement or ball physics. */
export function drawDecisionFocus(
  context: CanvasRenderingContext2D,
  frame: Frame,
  recording: Recording,
  playerId: string | null,
): void {
  if (!playerId) return;
  const index = recording.initial.players.findIndex((player) => player.id === playerId);
  const player = recording.initial.players[index];
  const pose = frame.players[index];
  if (!player || !pose || pose.dismissed) return;
  const origin = worldToScreen(pose.position);
  const decision = recording.decisions.findLast((entry) => entry.tick <= frame.tick);
  const order = decision?.batches
    .find((batch) => batch.team === player.team)
    ?.orders.find((order) => order.playerId === playerId);
  const target = order && 'target' in order ? worldToScreen(order.target) : null;
  const color = player.team === 'coral' ? '#ffc09e' : '#a4f1e1';
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  if (target) {
    context.globalAlpha = 0.7;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(target.x, target.y);
    context.stroke();
    context.setLineDash([]);
    context.strokeRect(target.x - 4, target.y - 4, 8, 8);
  }
  context.globalAlpha = 1;
  context.beginPath();
  context.ellipse(origin.x, origin.y + 1, 12, 6, 0, 0, Math.PI * 2);
  context.stroke();
  drawPixelRect(context, origin.x - 11, origin.y - 41, 23, 12, '#112b31');
  context.fillStyle = color;
  context.font = '9px monospace';
  context.textAlign = 'center';
  context.fillText(`#${player.number}`, origin.x, origin.y - 32);
  context.restore();
}
