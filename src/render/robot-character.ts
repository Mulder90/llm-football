import type { Frame, Recording } from '../recording/record.ts';
import { distanceBetween } from '../sim/math.ts';
import { ORDER_LIFETIME, TICK_RATE } from '../sim/rules.ts';
import type { Player, Vec2 } from '../sim/types.ts';

export type RobotReaction = {
  gesture: 'prepare-kick' | 'receive' | 'control' | 'shrug' | 'conceded';
  target: Vec2 | null;
};

const RECEIVER_TARGET_MATCH_METRES = 3;

/** Decorative roster identity: these differences are not player abilities or model traits. */
export function robotStyle(player: Player) {
  const variant = (player.number + (player.team === 'cyan' ? 1 : 0)) % 3;
  return {
    variant,
    runBob: variant === 0 ? 2 : variant === 1 ? 0 : 1,
    armSwing: variant === 2 ? 1.4 : 1,
    antennaOffset: variant === 1 ? -3 : 0,
  };
}

/** Only past accepted commands and completed incidents can supply an expressive gesture. */
export function robotReactions(record: Recording, frame: Frame): Map<string, RobotReaction> {
  const reactions = new Map<string, RobotReaction>();
  const decision = record.decisions.findLast((entry) => entry.tick <= frame.tick);
  const delivering = frame.phase.type === 'open_play' || frame.phase.type === 'restart_ready';
  if (decision && delivering && decision.tick >= frame.phase.sinceTick) {
    for (const batch of decision.batches) {
      const memory = decision.notes?.[batch.team].memory;
      for (const order of batch.orders) {
        const playerIndex = record.initial.players.findIndex(
          (player) => player.id === order.playerId,
        );
        const pose = frame.players[playerIndex];
        if (!pose || pose.dismissed) continue;
        const age = frame.tick - decision.tick;
        if (
          (order.type === 'kick' || order.type === 'shoot') &&
          frame.owner === order.playerId &&
          age < ORDER_LIFETIME.instantaneousTicks &&
          pose.lastKickTick < decision.tick
        ) {
          reactions.set(order.playerId, { gesture: 'prepare-kick', target: order.target });
        }
        if (
          !memory?.pass ||
          memory.pass.receiverId !== order.playerId ||
          frame.owner !== memory.ballPlayerId ||
          age >= ORDER_LIFETIME.persistentTicks
        )
          continue;
        // A written pass plan alone cannot make an uninstructed teammate ask for the ball.
        const destination =
          order.type === 'move' ? order.target : order.type === 'hold' ? pose.position : null;
        if (
          destination &&
          distanceBetween(destination, memory.pass.target) <= RECEIVER_TARGET_MATCH_METRES
        )
          reactions.set(order.playerId, { gesture: 'receive', target: frame.ball });
      }
    }
  }

  const reactionTicks = 0.6 * TICK_RATE;
  for (let index = record.events.length - 1; index >= 0; index--) {
    const event = record.events[index]!;
    if (event.tick + 1 > frame.tick) continue;
    if (frame.tick - event.tick - 1 >= reactionTicks) break;
    if (event.type === 'goal' && event.team) {
      for (const player of record.initial.players)
        if (player.team !== event.team && !reactions.has(player.id))
          reactions.set(player.id, { gesture: 'conceded', target: null });
    }
    if (!event.playerId || reactions.has(event.playerId)) continue;
    if (event.type === 'receive' || event.type === 'interception')
      reactions.set(event.playerId, { gesture: 'control', target: frame.ball });
    else if (event.type === 'order_failed')
      reactions.set(event.playerId, { gesture: 'shrug', target: null });
  }
  return reactions;
}
