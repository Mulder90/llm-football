import { sample } from '../recording/record.ts';
import type { Frame, Recording } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { distanceBetween } from '../sim/math.ts';

const CELEBRATION = {
  durationTicks: 1.8 * TICK_RATE,
  gatheringTicks: 1.2 * TICK_RATE,
  teammates: 5,
  huddleRadius: 1.8,
} as const;

/** A stopped-clock presentation vignette. Never written back into the match record. */
export function celebrationFrame(
  record: Recording,
  frame: Frame,
  reducedMotion: boolean,
): { frame: Frame; playerIds: Set<string> } {
  const goal = record.events.findLast((event) => event.type === 'goal' && event.tick < frame.tick);
  const playerIds = new Set<string>();
  if (
    !goal ||
    !goal.team ||
    frame.phase.type !== 'restart_setup' ||
    frame.tick - goal.tick >= CELEBRATION.durationTicks
  )
    return { frame, playerIds };
  const beforeGoal = sample(record, Math.max(0, goal.tick - 1) / TICK_RATE);
  const scorerIndex = record.initial.players.findIndex((player) => player.id === goal.playerId);
  const scorerPosition = beforeGoal.players[scorerIndex]?.position ?? beforeGoal.ball;
  const teammates = record.initial.players
    .map((player, index) => ({ player, index, pose: beforeGoal.players[index]! }))
    .filter(
      ({ player, pose }) =>
        player.team === goal.team && player.role !== 'keeper' && !pose.dismissed,
    )
    .sort(
      (first, second) =>
        distanceBetween(first.pose.position, scorerPosition) -
        distanceBetween(second.pose.position, scorerPosition),
    )
    .slice(0, CELEBRATION.teammates);
  const ageTicks = frame.tick - goal.tick;
  const progress = reducedMotion ? 0 : Math.min(1, ageTicks / CELEBRATION.gatheringTicks);
  const players = beforeGoal.players.map((pose) => ({ ...pose, velocity: { x: 0, y: 0 } }));
  teammates.forEach(({ player, index, pose }, huddleIndex) => {
    playerIds.add(player.id);
    const angle = (huddleIndex * Math.PI * 2) / teammates.length;
    const target = {
      x: scorerPosition.x + Math.cos(angle) * CELEBRATION.huddleRadius,
      y: scorerPosition.y + Math.sin(angle) * CELEBRATION.huddleRadius,
    };
    players[index] = {
      ...pose,
      position: {
        x: pose.position.x + (target.x - pose.position.x) * progress,
        y: pose.position.y + (target.y - pose.position.y) * progress,
      },
      velocity: { x: 0, y: 0 },
    };
  });
  return { frame: { ...frame, players, ball: beforeGoal.ball, owner: null }, playerIds };
}
