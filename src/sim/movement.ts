import { clamp, distanceBetween, unitVector, vectorLength } from './math.ts';
import { FIELD, MOVEMENT, NUMERIC_TOLERANCE, SECONDS_PER_TICK } from './rules.ts';
import type { MatchState, Player, Vec2 } from './types.ts';

function desiredVelocity(player: Player): Vec2 {
  const order = player.active?.order;
  if (order?.type !== 'move') return { x: 0, y: 0 };

  const toTarget = {
    x: order.target.x - player.position.x,
    y: order.target.y - player.position.y,
  };
  const distanceRemaining = vectorLength(toTarget);
  const direction = unitVector(toTarget);
  const brakingSpeed = Math.sqrt(2 * MOVEMENT.acceleration * distanceRemaining);
  const arrivalSpeed = distanceRemaining / SECONDS_PER_TICK;
  const speed = Math.min(MOVEMENT.maximumSpeed * order.pace, brakingSpeed, arrivalSpeed);

  const hasArrived = distanceRemaining < MOVEMENT.arrivalDistance;
  const hasSlowedDown = vectorLength(player.velocity) < MOVEMENT.arrivalSpeed;
  if (hasArrived && hasSlowedDown) player.active = null;

  return { x: direction.x * speed, y: direction.y * speed };
}

/** Mechanical steering toward an ordered point. Never chooses a tactical target. */
export function movePlayer(state: MatchState, player: Player): void {
  if (player.active && player.active.expires <= state.tick) player.active = null;

  const desired = desiredVelocity(player);
  const velocityChange = {
    x: desired.x - player.velocity.x,
    y: desired.y - player.velocity.y,
  };
  const maximumChange = MOVEMENT.acceleration * SECONDS_PER_TICK;
  const changeMagnitude = Math.max(vectorLength(velocityChange), NUMERIC_TOLERANCE.vectorLength);
  const changeFraction = Math.min(1, maximumChange / changeMagnitude);

  player.velocity.x += velocityChange.x * changeFraction;
  player.velocity.y += velocityChange.y * changeFraction;

  const previousPosition = { ...player.position };
  player.position.x = clamp(
    player.position.x + player.velocity.x * SECONDS_PER_TICK,
    MOVEMENT.boundaryInset,
    FIELD.length - MOVEMENT.boundaryInset,
  );
  player.position.y = clamp(
    player.position.y + player.velocity.y * SECONDS_PER_TICK,
    MOVEMENT.boundaryInset,
    FIELD.width - MOVEMENT.boundaryInset,
  );
  player.distance += distanceBetween(previousPosition, player.position);

  if (vectorLength(player.velocity) > MOVEMENT.facingUpdateSpeed) {
    player.facing = unitVector(player.velocity);
  }
}
