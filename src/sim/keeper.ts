import {
  footPosition,
  handlingRestriction,
  noteDeliberateKick,
  noteHandlingTouch,
} from './ball-control.ts';
import { emitEvent } from './events.ts';
import { clamp, unitVector, vectorLength } from './math.ts';
import { snapshotOffside } from './offside.ts';
import { awardRestart } from './restarts.ts';
import { BALL_CONTROL, FIELD, KEEPER } from './rules.ts';
import { attackDirection, inPenaltyArea, opponent } from './state.ts';
import type { MatchState, Player, Vec2, Vec3 } from './types.ts';

export function collectInHands(
  state: MatchState,
  keeper: Player,
  kind: 'catch' | 'pickup',
  contact: Vec3,
): void {
  state.ball.owner = keeper.id;
  state.ball.handControl = {
    sinceTick: state.tick,
    sincePlayingTick: state.playingTicks,
    kind,
    height: contact.z,
  };
  // Keep the legal contact's XY. Facing is not permission to relocate a catch.
  state.ball.position = { ...contact, z: KEEPER.handHeight };
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.lastTouch = keeper.id;
  if (kind === 'catch') keeper.lastSaveTick = state.tick;
  emitEvent(
    state,
    kind === 'catch' ? 'save' : 'keeper_pickup',
    keeper.id,
    kind === 'catch'
      ? 'Keeper catches and controls the ball in hands'
      : 'Keeper lifts the ball into hands',
    keeper.team,
  );
}

export function penalizeHandling(
  state: MatchState,
  keeper: Player,
  reason: string,
  position = state.ball.position,
): void {
  const inside = inPenaltyArea(state, keeper.team, position);
  emitEvent(state, 'keeper_violation', keeper.id, reason, keeper.team);
  awardRestart(state, inside ? 'indirect_free_kick' : 'free_kick', opponent(keeper.team), {
    x: clamp(position.x, 0, FIELD.length),
    y: clamp(position.y, 0, FIELD.width),
  });
}

/** Instant attempts; pickup/release never choose a run or queue for later possession. */
export function executeKeeperOrder(state: MatchState, keeper: Player): void {
  if (keeper.dismissed) return;
  const active = keeper.active;
  const order = active?.order;
  if (!active || !order || !['pickup', 'put_down', 'distribute'].includes(order.type)) return;
  keeper.active = null;
  if (active.expires <= state.tick) return;
  if (state.phase.type !== 'open_play' || state.ball.owner !== keeper.id) {
    emitEvent(
      state,
      'order_failed',
      keeper.id,
      'Keeper action requires own possession in open play',
    );
    return;
  }
  if (order.type === 'pickup') {
    if (state.ball.handControl) {
      emitEvent(
        state,
        'order_failed',
        keeper.id,
        'Ball is already in hands; pickup cannot reset the timer',
      );
      return;
    }
    const restriction = handlingRestriction(state, keeper);
    if (restriction) {
      penalizeHandling(state, keeper, restriction);
      return;
    }
    noteHandlingTouch(state, keeper, true);
    collectInHands(state, keeper, 'pickup', state.ball.position);
    return;
  }
  if (!state.ball.handControl) {
    emitEvent(
      state,
      'order_failed',
      keeper.id,
      'Distribution or put-down requires hand possession',
    );
    return;
  }
  if (order.type !== 'distribute' && order.type !== 'put_down') return;
  let direction = keeper.facing;
  if (order.type === 'distribute') {
    direction = unitVector({
      x: order.target.x - state.ball.position.x,
      y: order.target.y - state.ball.position.y,
    });
    if (vectorLength(direction) === 0) {
      emitEvent(state, 'order_failed', keeper.id, 'Distribution target coincides with ball');
      return;
    }
  }
  snapshotOffside(state, keeper);
  if (order.type === 'distribute' && order.delivery === 'punt') noteDeliberateKick(state, keeper);
  else noteHandlingTouch(state, keeper, true);
  state.ball.handControl = null;
  state.ball.handling.releasedBy = keeper.id;
  state.ball.lastTouch = keeper.id;
  const delivery = order.type === 'put_down' ? 'put_down' : order.delivery;
  if (order.type === 'put_down') {
    state.ball.position = footPosition(keeper);
    state.ball.velocity = { x: 0, y: 0, z: 0 };
  } else {
    // Release from the actual ball location; aiming cannot teleport a held ball over an area line.
    keeper.facing = direction;
    state.ball.owner = null;
    state.ball.kickedAt = state.tick;
    state.ball.position.z = delivery === 'roll' ? BALL_CONTROL.radius : KEEPER.handHeight;
    state.ball.velocity = {
      x: direction.x * order.speed,
      y: direction.y * order.speed,
      z: order.loft,
    };
    if (delivery === 'punt') keeper.lastKick = state.tick;
    else state.ball.handling.directThrowBy = keeper.id;
  }
  emitEvent(
    state,
    'keeper_release',
    keeper.id,
    `Keeper ${delivery.replace('_', ' ')}`,
    keeper.team,
  );
  state.events.at(-1)!.delivery = delivery;
}

/** Called before clock advancement: the current playing interval is included exactly once. */
export function checkKeeperHoldLimit(state: MatchState): void {
  const control = state.ball.handControl;
  if (state.phase.type !== 'open_play' || !control) return;
  if (state.playingTicks + 1 - control.sincePlayingTick <= KEEPER.maximumHoldTicks) return;
  const keeper = state.players.find((player) => player.id === state.ball.owner)!;
  const goalX = attackDirection(state, keeper.team) === 1 ? 0 : FIELD.length;
  emitEvent(
    state,
    'keeper_violation',
    keeper.id,
    'Hand control exceeded eight playing seconds',
    keeper.team,
  );
  awardRestart(state, 'corner', opponent(keeper.team), {
    x: goalX,
    y: keeper.position.y < FIELD.width / 2 ? 0 : FIELD.width,
  });
}

export function updateHeldBall(state: MatchState, keeper: Player, previousPosition: Vec2): void {
  // Translate by actual movement (including body separation), not facing or velocity.
  // Adding a zero delta preserves an exact area-line catch without round-off drift.
  const next = state.ball.position;
  next.x += keeper.position.x - previousPosition.x;
  next.y += keeper.position.y - previousPosition.y;
  state.ball.velocity = { ...keeper.velocity, z: 0 };
  if (!inPenaltyArea(state, keeper.team, next))
    penalizeHandling(state, keeper, 'Keeper carried the ball outside the own penalty area', next);
}
