import { emitEvent } from './events.ts';
import { clamp, distanceBetween, unitVector } from './math.ts';
import { BALL_CONTROL, FIELD, MATCH_TIMING, MOVEMENT, RESTART_RULES } from './rules.ts';
import { attackDirection, opponent, resetFormation } from './state.ts';
import type { MatchState, Player, Restart, RestartType, Team, Vec2 } from './types.ts';

export function clearOrders(state: MatchState): void {
  for (const player of state.players) {
    player.active = null;
    player.velocity = { x: 0, y: 0 };
  }
}

export function finishMatch(
  state: MatchState,
  reason: 'completed' | 'abandoned',
  detail?: string,
): void {
  clearOrders(state);
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.phase = { type: 'full_time', sinceTick: state.tick, reason };
  emitEvent(
    state,
    reason === 'completed' ? 'full_time' : 'abandoned',
    null,
    detail ??
      (reason === 'completed' ? 'Two halves completed' : 'Restart delivery deadline expired'),
  );
}

export function awardRestart(
  state: MatchState,
  type: RestartType,
  team: Team,
  position: Vec2,
): void {
  clearOrders(state);
  if (type === 'kickoff') resetFormation(state);
  const eligible = state.players.filter((player) => player.team === team && !player.dismissed);
  const defaultTaker =
    type === 'goal_kick'
      ? (eligible.find((player) => player.role === 'keeper') ?? eligible[0]!)
      : [...eligible].sort(
          (first, second) =>
            distanceBetween(first.position, position) -
              distanceBetween(second.position, position) || (first.id < second.id ? -1 : 1),
        )[0]!;
  state.ball.position = { ...position, z: BALL_CONTROL.radius };
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.owner = null;
  state.ball.restartTouch = null;
  state.offside = null;
  state.phase = {
    type: 'restart_setup',
    sinceTick: state.tick,
    readyTick: state.tick + MATCH_TIMING.restartSetupTicks,
    restart: { type, team, position: { ...position }, takerId: defaultTaker.id },
  };
  emitEvent(state, 'restart_awarded', defaultTaker.id, type.replaceAll('_', ' '), team);
}

function constrainToField(position: Vec2): Vec2 {
  return {
    x: clamp(position.x, MOVEMENT.boundaryInset, FIELD.length - MOVEMENT.boundaryInset),
    y: clamp(position.y, MOVEMENT.boundaryInset, FIELD.width - MOVEMENT.boundaryInset),
  };
}

function keepDistance(player: Player, spot: Vec2, minimumDistance: number): void {
  if (distanceBetween(player.position, spot) >= minimumDistance) return;
  const offset = { x: player.position.x - spot.x, y: player.position.y - spot.y };
  const direction = unitVector(offset);
  const projected = constrainToField({
    x: spot.x + direction.x * minimumDistance,
    y: spot.y + direction.y * minimumDistance,
  });
  if (distanceBetween(projected, spot) >= minimumDistance - 1e-9) {
    player.position = projected;
    return;
  }
  // At a corner or exact overlap, an inward direction keeps the projection legal.
  let inward = unitVector({ x: FIELD.length / 2 - spot.x, y: FIELD.width / 2 - spot.y });
  if (inward.x === 0 && inward.y === 0) inward = { x: player.facing.x >= 0 ? -1 : 1, y: 0 };
  player.position = constrainToField({
    x: spot.x + inward.x * minimumDistance,
    y: spot.y + inward.y * minimumDistance,
  });
}

function applyPlacementRestrictions(state: MatchState, restart: Restart): void {
  const defendingDistance =
    restart.type === 'throw_in'
      ? RESTART_RULES.throwInOpponentDistance
      : RESTART_RULES.opponentDistance;
  for (const player of state.players) {
    if (player.dismissed) continue;
    if (player.id === restart.takerId) continue;
    if (restart.type === 'penalty') {
      const direction = attackDirection(state, restart.team);
      const goalX = direction === 1 ? FIELD.length : 0;
      if (player.team !== restart.team && player.role === 'keeper') {
        player.position = {
          x: goalX,
          y: clamp(
            player.position.y,
            (FIELD.width - FIELD.goalWidth) / 2 + MOVEMENT.playerRadius,
            (FIELD.width + FIELD.goalWidth) / 2 - MOVEMENT.playerRadius,
          ),
        };
      } else {
        keepDistance(player, restart.position, RESTART_RULES.opponentDistance);
        const areaEdge = goalX - direction * (FIELD.penaltyAreaDepth + MOVEMENT.playerRadius);
        player.position.x =
          direction === 1
            ? Math.min(player.position.x, areaEdge)
            : Math.max(player.position.x, areaEdge);
      }
      continue;
    }
    if (restart.type === 'kickoff') {
      const direction = attackDirection(state, player.team);
      player.position.x =
        direction === 1
          ? Math.min(player.position.x, FIELD.length / 2 - MOVEMENT.playerRadius)
          : Math.max(player.position.x, FIELD.length / 2 + MOVEMENT.playerRadius);
    }
    if (restart.type === 'goal_kick' && player.team !== restart.team) {
      const goalX = attackDirection(state, restart.team) === 1 ? 0 : FIELD.length;
      const inPenaltyWidth =
        Math.abs(player.position.y - FIELD.width / 2) < FIELD.penaltyAreaWidth / 2;
      if (
        inPenaltyWidth &&
        Math.abs(player.position.x - goalX) < FIELD.penaltyAreaDepth + MOVEMENT.playerRadius
      ) {
        player.position.x =
          goalX +
          attackDirection(state, restart.team) * (FIELD.penaltyAreaDepth + MOVEMENT.playerRadius);
      }
    }
    keepDistance(
      player,
      restart.position,
      player.team === restart.team ? RESTART_RULES.teammateDistance : defendingDistance,
    );
  }
  const taker = state.players.find((player) => player.id === restart.takerId)!;
  const direction = attackDirection(state, restart.team);
  taker.position = constrainToField({
    x: restart.position.x - direction * BALL_CONTROL.carryingOffset,
    y: restart.position.y,
  });
  taker.facing = { x: direction, y: 0 };
}

export function prepareRestartDelivery(state: MatchState): void {
  if (state.phase.type !== 'restart_setup') return;
  const restart = state.phase.restart;
  applyPlacementRestrictions(state, restart);
  clearOrders(state); // Old setup movement cannot leak into the delivery decision.
  state.ball.position = { ...restart.position, z: BALL_CONTROL.radius };
  state.ball.owner = restart.takerId;
  state.phase = {
    type: 'restart_ready',
    sinceTick: state.tick,
    deadlineTick: state.tick + MATCH_TIMING.restartDeliveryTicks,
    restart,
  };
  emitEvent(
    state,
    'restart_ready',
    restart.takerId,
    restart.type.replaceAll('_', ' '),
    restart.team,
  );
}

/** Called only after the chosen taker's delivery has passed its physical preconditions. */
export function releaseRestart(state: MatchState): Restart | null {
  if (state.phase.type !== 'restart_ready') return null;
  const restart = state.phase.restart;
  state.ball.restartTouch = { type: restart.type, team: restart.team, takerId: restart.takerId };
  state.phase = { type: 'open_play', sinceTick: state.tick };
  emitEvent(
    state,
    'restart_taken',
    restart.takerId,
    restart.type.replaceAll('_', ' '),
    restart.team,
  );
  return restart;
}

export function advanceMatchClock(state: MatchState, wasPlaying: boolean): void {
  state.tick++;
  if (wasPlaying) {
    state.playingTicks++;
    state.halfPlayingTicks++;
    if (state.phase.type === 'full_time') return;
    if (state.halfPlayingTicks >= MATCH_TIMING.halfPlayingTicks) {
      if (state.half === 2) finishMatch(state, 'completed');
      else {
        clearOrders(state);
        state.ball.velocity = { x: 0, y: 0, z: 0 };
        state.phase = {
          type: 'halftime',
          sinceTick: state.tick,
          endsAtTick: state.tick + MATCH_TIMING.halftimeTicks,
        };
        emitEvent(state, 'halftime', null, 'First half completed');
      }
      return;
    }
  }
  switch (state.phase.type) {
    case 'restart_setup':
      if (state.tick >= state.phase.readyTick) prepareRestartDelivery(state);
      break;
    case 'restart_ready':
      if (state.tick >= state.phase.deadlineTick) finishMatch(state, 'abandoned');
      break;
    case 'halftime':
      if (state.tick >= state.phase.endsAtTick) {
        state.half = 2;
        state.halfPlayingTicks = 0;
        awardRestart(state, 'kickoff', opponent(state.firstKickoffTeam), {
          x: FIELD.length / 2,
          y: FIELD.width / 2,
        });
      }
      break;
  }
}
