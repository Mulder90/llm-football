import { emitEvent } from './events.ts';
import { contactTime, nextRandom, unitVector, vectorLength } from './math.ts';
import { BALL_CONTROL, NUMERIC_TOLERANCE, SECONDS_PER_TICK } from './rules.ts';
import type { Ball, MatchState, Player, Vec2 } from './types.ts';

type BallContact = { player: Player; timeFraction: number };

function footPosition(player: Player) {
  return {
    x: player.position.x + player.facing.x * BALL_CONTROL.carryingOffset,
    y: player.position.y + player.facing.y * BALL_CONTROL.carryingOffset,
    z: BALL_CONTROL.radius,
  };
}

export function executeKick(state: MatchState, player: Player): void {
  const activeOrder = player.active;
  if (activeOrder?.order.type !== 'kick') return;
  const order = activeOrder.order;
  player.active = null; // Every attempt is consumed, even if its precondition fails.

  if (activeOrder.expires <= state.tick) return;
  if (state.ball.owner !== player.id) {
    emitEvent(state, 'order_failed', player.id, 'Kick requires possession');
    return;
  }

  const direction = unitVector({
    x: order.target.x - state.ball.position.x,
    y: order.target.y - state.ball.position.y,
  });
  if (vectorLength(direction) === 0) {
    emitEvent(state, 'order_failed', player.id, 'Kick target coincides with ball');
    return;
  }

  player.facing = direction;
  player.lastKick = state.tick;
  state.ball.owner = null;
  state.ball.lastTouch = player.id;
  state.ball.kickedAt = state.tick;
  state.ball.position = {
    x: player.position.x + direction.x * BALL_CONTROL.kickReleaseOffset,
    y: player.position.y + direction.y * BALL_CONTROL.kickReleaseOffset,
    z: BALL_CONTROL.radius,
  };
  state.ball.velocity = { x: direction.x * order.speed, y: direction.y * order.speed, z: 0 };
  emitEvent(state, 'kick', player.id, `Ground kick at ${order.speed} m/s`);
}

function advanceLooseBall(ball: Ball): void {
  ball.position.x += ball.velocity.x * SECONDS_PER_TICK;
  ball.position.y += ball.velocity.y * SECONDS_PER_TICK;
  const previousSpeed = vectorLength(ball.velocity);
  const nextSpeed = Math.max(0, previousSpeed - BALL_CONTROL.groundDeceleration * SECONDS_PER_TICK);

  if (previousSpeed > 0) {
    ball.velocity.x *= nextSpeed / previousSpeed;
    ball.velocity.y *= nextSpeed / previousSpeed;
  }
}

function findContacts(
  state: MatchState,
  previousBallPosition: Vec2,
  previousPlayerPositions: ReadonlyMap<string, Vec2>,
): BallContact[] {
  const contacts: BallContact[] = [];
  for (const player of state.players) {
    const justKicked =
      player.id === state.ball.lastTouch &&
      state.tick - state.ball.kickedAt < BALL_CONTROL.kickerRecaptureDelayTicks;
    if (justKicked) continue;

    const previousPlayerPosition = previousPlayerPositions.get(player.id)!;
    // Subtract player motion so the sweep is relative to a stationary receiver.
    const relativeStart = {
      x: previousBallPosition.x - previousPlayerPosition.x,
      y: previousBallPosition.y - previousPlayerPosition.y,
    };
    const relativeEnd = {
      x: state.ball.position.x - player.position.x,
      y: state.ball.position.y - player.position.y,
    };
    const timeFraction = contactTime(
      relativeStart,
      relativeEnd,
      { x: 0, y: 0 },
      BALL_CONTROL.receivingRadius,
    );
    if (timeFraction !== null) contacts.push({ player, timeFraction });
  }
  return contacts;
}

function firstReceiver(state: MatchState, contacts: BallContact[]): Player | null {
  contacts.sort((first, second) => {
    const timeDifference = first.timeFraction - second.timeFraction;
    if (timeDifference !== 0) return timeDifference;
    return first.player.id < second.player.id ? -1 : first.player.id > second.player.id ? 1 : 0;
  });
  const earliest = contacts[0];
  if (!earliest) return null;

  const tiedContacts = contacts.filter(
    (contact) =>
      Math.abs(contact.timeFraction - earliest.timeFraction) <
      NUMERIC_TOLERANCE.contactTimeFraction,
  );
  if (tiedContacts.length === 1) return earliest.player;

  const randomResult = nextRandom(state.seed);
  state.seed = randomResult.seed;
  const selectedIndex = Math.floor(randomResult.value * tiedContacts.length);
  return tiedContacts[selectedIndex]!.player;
}

export function advanceBall(
  state: MatchState,
  previousPlayerPositions: ReadonlyMap<string, Vec2>,
): void {
  const ball = state.ball;
  if (ball.owner) {
    const carrier = state.players.find((player) => player.id === ball.owner)!;
    ball.position = footPosition(carrier);
    ball.velocity = { x: carrier.velocity.x, y: carrier.velocity.y, z: 0 };
    return;
  }

  const previousBallPosition = { ...ball.position };
  advanceLooseBall(ball);
  const receiver = firstReceiver(
    state,
    findContacts(state, previousBallPosition, previousPlayerPositions),
  );
  if (!receiver) return;

  const lastPlayer = state.players.find((player) => player.id === ball.lastTouch);
  const isInterception = lastPlayer && lastPlayer.team !== receiver.team;
  ball.owner = receiver.id;
  ball.lastTouch = receiver.id;
  ball.velocity = { x: 0, y: 0, z: 0 };
  ball.position = footPosition(receiver);
  emitEvent(
    state,
    isInterception ? 'interception' : 'receive',
    receiver.id,
    'Ball entered first-touch radius',
  );
}
