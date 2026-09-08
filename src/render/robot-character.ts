import type { Frame, Recording } from '../recording/record.ts';
import { distanceBetween } from '../sim/math.ts';
import { ORDER_LIFETIME, TICK_RATE } from '../sim/rules.ts';
import type { Player, Vec2 } from '../sim/types.ts';
import type { FootballMoment } from './match-atmosphere.ts';

export type RobotReaction = {
  gesture:
    | 'prepare-kick'
    | 'receive'
    | 'control'
    | 'shrug'
    | 'conceded'
    | 'save-pump'
    | 'frustrated'
    | 'acknowledge';
  target: Vec2 | null;
  ageTicks: number;
};
export type RobotExpression = 'neutral' | 'joy' | 'determined' | 'frustrated' | 'surprised';

const RECEIVER_TARGET_MATCH_METRES = 3;
const REACTION_TIMING = {
  durationTicks: 0.6 * TICK_RATE,
  saveSettleTicks: 0.15 * TICK_RATE,
  acknowledgeTicks: 0.4 * TICK_RATE,
} as const;

/** Decorative roster identity: these differences are not player abilities or model traits. */
export function robotStyle(player: Player) {
  const variant = (player.number + (player.team === 'cyan' ? 1 : 0)) % 3;
  return {
    variant,
    helmet: variant === 0 ? 'round' : variant === 1 ? 'square' : 'twin',
    runBob: variant === 0 ? 2 : variant === 1 ? 0 : 1,
    armSwing: variant === 2 ? 1.4 : 1,
    headBounce: variant === 0 ? 2 : variant === 1 ? 1 : 3,
  };
}

/** Visor expressions are readable illustrations of the same recorded actions as the body. */
export function robotExpression(
  reaction: RobotReaction | undefined,
  celebrating: boolean,
  focused: boolean,
): RobotExpression {
  if (celebrating || reaction?.gesture === 'save-pump' || reaction?.gesture === 'acknowledge')
    return 'joy';
  if (
    reaction?.gesture === 'frustrated' ||
    reaction?.gesture === 'conceded' ||
    reaction?.gesture === 'shrug'
  )
    return 'frustrated';
  if (reaction?.gesture === 'control') return 'surprised';
  return focused ? 'determined' : 'neutral';
}

/** A brief, staggered head tilt. It has no bearing on attention, tactics or player ability. */
export function idleRobotPose(player: Player, animationTick: number, reducedMotion: boolean) {
  const still = { headTilt: 0, headBob: 0, antennaLean: 0 };
  if (reducedMotion) return still;
  const periodTicks = 8 * TICK_RATE;
  const gestureTicks = 0.9 * TICK_RATE;
  const phase =
    (animationTick + player.number * 41 + (player.team === 'cyan' ? 97 : 0)) % periodTicks;
  if (phase >= gestureTicks) return still;
  const arc = Math.sin((phase / gestureTicks) * Math.PI);
  const side = player.number % 2 === 0 ? -1 : 1;
  return {
    headTilt: Math.round(arc * 2) * side,
    headBob: -Math.round(arc),
    antennaLean: Math.round(arc) * side,
  };
}

/** Only past accepted commands and completed incidents can supply an expressive gesture. */
export function robotReactions(
  record: Recording,
  frame: Frame,
  moments: readonly FootballMoment[] = [],
): Map<string, RobotReaction> {
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
          reactions.set(order.playerId, {
            gesture: 'prepare-kick',
            target: order.target,
            ageTicks: age,
          });
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
          reactions.set(order.playerId, { gesture: 'receive', target: frame.ball, ageTicks: age });
      }
    }
  }

  // Moments are already classified from physical outcomes; poses never predict a result.
  if (frame.phase.type !== 'full_time' && frame.phase.type !== 'halftime') {
    for (let index = moments.length - 1; index >= 0; index--) {
      const moment = moments[index]!;
      const ageTicks = frame.tick - moment.tick;
      if (ageTicks < 0) continue;
      if (ageTicks >= REACTION_TIMING.durationTicks) break;
      if (!moment.playerId || moment.tick < frame.phase.sinceTick || reactions.has(moment.playerId))
        continue;
      const playerIndex = record.initial.players.findIndex(
        (player) => player.id === moment.playerId,
      );
      const player = record.initial.players[playerIndex];
      const pose = frame.players[playerIndex];
      if (!player || !pose || pose.dismissed || pose.lastKickTick >= moment.tick) continue;
      if (
        moment.type === 'save' &&
        player.role === 'keeper' &&
        frame.owner === player.id &&
        ageTicks >= REACTION_TIMING.saveSettleTicks
      ) {
        reactions.set(player.id, { gesture: 'save-pump', target: null, ageTicks });
      } else if (moment.type === 'near-miss' && frame.owner !== player.id) {
        reactions.set(player.id, { gesture: 'frustrated', target: null, ageTicks });
      } else if (
        moment.type === 'good-pass' &&
        moment.otherPlayerId &&
        frame.owner === player.id &&
        ageTicks < REACTION_TIMING.acknowledgeTicks
      ) {
        reactions.set(player.id, { gesture: 'acknowledge', target: null, ageTicks });
        const giverIndex = record.initial.players.findIndex(
          (candidate) => candidate.id === moment.otherPlayerId,
        );
        const giver = frame.players[giverIndex];
        if (
          giver &&
          !giver.dismissed &&
          giver.lastKickTick < moment.tick &&
          !reactions.has(moment.otherPlayerId)
        )
          reactions.set(moment.otherPlayerId, {
            gesture: 'acknowledge',
            target: pose.position,
            ageTicks,
          });
      }
    }
  }

  for (let index = record.events.length - 1; index >= 0; index--) {
    const event = record.events[index]!;
    if (event.tick + 1 > frame.tick) continue;
    const ageTicks = frame.tick - event.tick - 1;
    if (ageTicks >= REACTION_TIMING.durationTicks) break;
    if (event.type === 'goal' && event.team) {
      for (const player of record.initial.players)
        if (player.team !== event.team && !reactions.has(player.id))
          reactions.set(player.id, { gesture: 'conceded', target: null, ageTicks });
    }
    if (!event.playerId || reactions.has(event.playerId)) continue;
    if (
      (event.type === 'receive' || event.type === 'interception') &&
      frame.owner === event.playerId
    )
      reactions.set(event.playerId, { gesture: 'control', target: frame.ball, ageTicks });
    else if (event.type === 'order_failed')
      reactions.set(event.playerId, { gesture: 'shrug', target: null, ageTicks });
  }
  return reactions;
}
