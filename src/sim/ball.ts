import {
  footPosition,
  handlingRestriction,
  noteHandlingTouch,
  noteDeliberateKick,
} from './ball-control.ts';
export { footPosition } from './ball-control.ts';
import { collectInHands, updateHeldBall } from './keeper.ts';
import { firstBoundaryCrossing, pointOnSegment, resolveBoundary } from './boundaries.ts';
import { emitEvent } from './events.ts';
import { goalFrameContacts } from './goal-frame.ts';
import { notePlayerTouch, penalizeOffsideInvolvement, snapshotOffside } from './offside.ts';
import { contactTime, nextRandom, unitVector, vectorLength } from './math.ts';
import { awardRestart, releaseRestart } from './restarts.ts';
import {
  BALL_CONTROL,
  KEEPER,
  MOVEMENT,
  NUMERIC_TOLERANCE,
  RESTART_RULES,
  SECONDS_PER_TICK,
} from './rules.ts';
import { attackDirection, opponent } from './state.ts';
import type { Ball, MatchState, Player, Vec2, Vec3 } from './types.ts';

type PlayerContact = {
  type: 'player';
  player: Player;
  timeFraction: number;
  canControl: boolean;
  isSave: boolean;
};

export function executeKick(state: MatchState, player: Player): void {
  if (player.dismissed) return;
  const activeOrder = player.active;
  if (activeOrder?.order.type !== 'kick' && activeOrder?.order.type !== 'shoot') return;
  const order = activeOrder.order;
  player.active = null;
  if (activeOrder.expires <= state.tick) return;
  if (state.ball.owner !== player.id || state.ball.handControl) {
    emitEvent(
      state,
      'order_failed',
      player.id,
      'Kick requires foot possession; use distribute or put_down from hands',
    );
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

  if (
    state.phase.type === 'restart_ready' &&
    state.phase.restart.type === 'penalty' &&
    direction.x * attackDirection(state, player.team) <= 0
  ) {
    emitEvent(state, 'restart_violation', player.id, 'Penalty must travel forward', player.team);
    awardRestart(state, 'indirect_free_kick', opponent(player.team), state.phase.restart.position);
    return;
  }
  const restart = releaseRestart(state);
  snapshotOffside(state, player, restart?.type);
  const isThrow = restart?.type === 'throw_in';
  noteDeliberateKick(state, player, isThrow);
  const speed = isThrow ? Math.min(order.speed, RESTART_RULES.maximumThrowSpeed) : order.speed;
  player.facing = direction;
  player.lastKick = state.tick;
  state.ball.owner = null;
  state.ball.lastTouch = player.id;
  state.ball.kickedAt = state.tick;
  state.ball.position = restart
    ? { ...restart.position, z: isThrow ? RESTART_RULES.throwReleaseHeight : BALL_CONTROL.radius }
    : {
        x: player.position.x + direction.x * BALL_CONTROL.kickReleaseOffset,
        y: player.position.y + direction.y * BALL_CONTROL.kickReleaseOffset,
        z: BALL_CONTROL.radius,
      };
  state.ball.velocity = { x: direction.x * speed, y: direction.y * speed, z: order.loft ?? 0 };
  emitEvent(
    state,
    order.type === 'shoot' ? 'shot' : 'kick',
    player.id,
    `${isThrow ? 'Throw' : order.type === 'shoot' ? 'Shot' : 'Kick'} at ${speed} m/s`,
    player.team,
  );
}

function advanceLooseBall(ball: Ball): void {
  ball.position.x += ball.velocity.x * SECONDS_PER_TICK;
  ball.position.y += ball.velocity.y * SECONDS_PER_TICK;
  if (ball.position.z > BALL_CONTROL.radius || ball.velocity.z > 0) {
    ball.position.z += ball.velocity.z * SECONDS_PER_TICK;
    ball.velocity.z -= BALL_CONTROL.gravity * SECONDS_PER_TICK;
    if (ball.position.z <= BALL_CONTROL.radius) {
      ball.position.z = BALL_CONTROL.radius;
      const reboundSpeed = -ball.velocity.z * BALL_CONTROL.bounceRestitution;
      ball.velocity.z = reboundSpeed >= BALL_CONTROL.minimumBounceSpeed ? reboundSpeed : 0;
    }
  }
  if (ball.position.z === BALL_CONTROL.radius) {
    const previousSpeed = vectorLength(ball.velocity);
    const nextSpeed = Math.max(
      0,
      previousSpeed - BALL_CONTROL.groundDeceleration * SECONDS_PER_TICK,
    );
    if (previousSpeed > 0) {
      ball.velocity.x *= nextSpeed / previousSpeed;
      ball.velocity.y *= nextSpeed / previousSpeed;
    }
  }
}

function findPlayerContacts(
  state: MatchState,
  from: Vec3,
  previousPositions: ReadonlyMap<string, Vec2>,
): PlayerContact[] {
  const contacts: PlayerContact[] = [];
  for (const player of state.players) {
    if (player.dismissed) continue;
    const justKicked =
      player.id === state.ball.lastTouch &&
      state.tick - state.ball.kickedAt < BALL_CONTROL.kickerRecaptureDelayTicks;
    if (justKicked) continue;
    const guarding = player.role === 'keeper' && player.active?.order.type === 'guard';
    // Evaluate catching at its swept ball contact. If illegal, retain the ordinary
    // foot/body candidate rather than granting hand reach or inventing a foul.
    for (const catching of guarding ? [true, false] : [false]) {
      const controlHeight = catching
        ? KEEPER.guardingHeight
        : BALL_CONTROL.maximumFootControlHeight;
      const slowEnough =
        catching || vectorLength(state.ball.velocity) <= BALL_CONTROL.maximumFootControlSpeed;
      const canControl = slowEnough && Math.max(from.z, state.ball.position.z) <= controlHeight;
      if (catching && !canControl) continue;
      const reach = canControl
        ? catching
          ? KEEPER.guardingReach
          : BALL_CONTROL.receivingRadius
        : MOVEMENT.playerRadius + BALL_CONTROL.radius;
      const previousPlayer = previousPositions.get(player.id)!;
      const timeFraction = contactTime(
        { x: from.x - previousPlayer.x, y: from.y - previousPlayer.y },
        {
          x: state.ball.position.x - player.position.x,
          y: state.ball.position.y - player.position.y,
        },
        { x: 0, y: 0 },
        reach,
      );
      if (timeFraction === null) continue;
      const contactPosition = pointOnSegment(from, state.ball.position, timeFraction);
      if (contactPosition.z > (canControl ? controlHeight : BALL_CONTROL.bodyHeight)) continue;
      if (catching && handlingRestriction(state, player, contactPosition)) continue;
      contacts.push({ type: 'player', player, timeFraction, canControl, isSave: catching });
      // A legal catch has greater reach and owns this player's earliest contact.
      break;
    }
  }
  return contacts;
}

function reflectVelocity(ball: Ball, normal: Vec3, restitution: number): void {
  const dot = ball.velocity.x * normal.x + ball.velocity.y * normal.y + ball.velocity.z * normal.z;
  ball.velocity = {
    x: (ball.velocity.x - 2 * dot * normal.x) * restitution,
    y: (ball.velocity.y - 2 * dot * normal.y) * restitution,
    z: (ball.velocity.z - 2 * dot * normal.z) * restitution,
  };
}

function resolvePlayerContact(state: MatchState, contact: PlayerContact, position: Vec3): void {
  const receiver = contact.player;
  if (penalizeOffsideInvolvement(state, receiver)) return;
  if (state.ball.restartTouch?.takerId === receiver.id) {
    emitEvent(state, 'restart_violation', receiver.id, 'Restart taker touched the ball twice');
    awardRestart(state, 'indirect_free_kick', opponent(receiver.team), receiver.position);
    return;
  }
  state.ball.restartTouch = null;
  notePlayerTouch(state, receiver, contact.canControl, contact.isSave);
  noteHandlingTouch(state, receiver, contact.canControl);
  const previousPlayer = state.players.find((player) => player.id === state.ball.lastTouch);
  state.ball.lastTouch = receiver.id;
  if (contact.isSave) {
    collectInHands(state, receiver, 'catch', position.z);
    updateHeldBall(state, receiver);
    return;
  }
  if (contact.canControl) {
    state.ball.handControl = null;
    state.ball.owner = receiver.id;
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.ball.position = footPosition(receiver);
    emitEvent(
      state,
      previousPlayer && previousPlayer.team !== receiver.team ? 'interception' : 'receive',
      receiver.id,
      'Ball entered first-touch radius',
      receiver.team,
    );
  } else {
    let direction = unitVector({
      x: position.x - receiver.position.x,
      y: position.y - receiver.position.y,
    });
    if (vectorLength(direction) === 0)
      direction = unitVector({ x: -state.ball.velocity.x, y: -state.ball.velocity.y });
    const separation =
      MOVEMENT.playerRadius + BALL_CONTROL.radius + BALL_CONTROL.collisionSeparation;
    state.ball.position = {
      x: receiver.position.x + direction.x * separation,
      y: receiver.position.y + direction.y * separation,
      z: position.z,
    };
    reflectVelocity(state.ball, { ...direction, z: 0 }, BALL_CONTROL.bodyDeflectionRestitution);
    emitEvent(state, 'block', receiver.id, 'Ball deflected off the player', receiver.team);
  }
}

export function advanceBall(state: MatchState, previousPositions: ReadonlyMap<string, Vec2>): void {
  const ball = state.ball;
  const from = { ...ball.position };
  if (ball.owner) {
    const carrier = state.players.find((player) => player.id === ball.owner)!;
    if (ball.handControl) {
      updateHeldBall(state, carrier);
      return;
    }
    ball.position = footPosition(carrier);
    ball.velocity = { x: carrier.velocity.x, y: carrier.velocity.y, z: 0 };
    const crossing = firstBoundaryCrossing(from, ball.position);
    if (crossing) resolveBoundary(state, crossing);
    return;
  }

  advanceLooseBall(ball);
  const to = { ...ball.position };
  const crossing = firstBoundaryCrossing(from, to);
  const incidents = [
    ...goalFrameContacts(from, to),
    ...findPlayerContacts(state, from, previousPositions),
    ...(crossing ? [crossing] : []),
  ];
  // Equal-time precedence is frame, player, boundary. Exact player ties use seeded choice.
  incidents.sort((first, second) => first.timeFraction - second.timeFraction);
  let first = incidents[0];
  if (!first) return;
  if (first.type === 'player') {
    const earliestTime = first.timeFraction;
    const tied = incidents
      .filter(
        (incident): incident is PlayerContact =>
          incident.type === 'player' &&
          Math.abs(incident.timeFraction - earliestTime) < NUMERIC_TOLERANCE.contactTimeFraction,
      )
      .sort((first, second) => (first.player.id < second.player.id ? -1 : 1));
    if (tied.length > 1) {
      const random = nextRandom(state.seed);
      state.seed = random.seed;
      first = tied[Math.floor(random.value * tied.length)]!;
    }
  }
  switch (first.type) {
    case 'boundary':
      resolveBoundary(state, first);
      break;
    case 'frame':
      ball.position = first.position;
      reflectVelocity(ball, first.normal, BALL_CONTROL.frameRestitution);
      emitEvent(state, 'post', null, 'Ball rebounds from the goal frame');
      break;
    case 'player':
      resolvePlayerContact(state, first, pointOnSegment(from, to, first.timeFraction));
      break;
  }
  // The remaining sub-tick time is discarded after contact; the next fixed tick resumes motion.
}
