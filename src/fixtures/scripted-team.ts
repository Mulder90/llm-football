import { clamp, distanceBetween, unitVector } from '../sim/math.ts';
import { tackleFoul } from '../sim/fouls.ts';
import { BALL_CONTROL, FIELD, MOVEMENT, TACKLE } from '../sim/rules.ts';
import { attackDirection } from '../sim/state.ts';
import type { KickOrder, MatchState, Order, Player, Team, Vec2 } from '../sim/types.ts';

// Development baseline only. All tactical assistance here produces the same public orders
// available to an LLM; none of these target-selection rules are imported by the engine.
const SUPPORT_POSITIONS: readonly Vec2[] = [
  { x: 3, y: 34 },
  { x: 22, y: 10 },
  { x: 20, y: 26 },
  { x: 20, y: 42 },
  { x: 22, y: 58 },
  { x: 37, y: 15 },
  { x: 35, y: 34 },
  { x: 37, y: 53 },
  { x: 51, y: 12 },
  { x: 53, y: 34 },
  { x: 51, y: 56 },
];
const BASELINE = {
  shootingDistance: 27,
  passDistance: 27,
  receivingSpeed: 6,
  pressingPlayers: 2,
  ballPredictionSeconds: 0.45,
  keeperRestingDepth: 2,
  keeperMaximumDepth: 10,
} as const;

function keeperTarget(state: MatchState, team: Team): Vec2 {
  const direction = attackDirection(state, team);
  const goalX = direction === 1 ? 0 : FIELD.length;
  const ballDistance = Math.abs(state.ball.position.x - goalX);
  const owner = state.players.find((player) => player.id === state.ball.owner);
  const facingShot = owner && owner.team !== team && ballDistance < BASELINE.shootingDistance;
  const depth = facingShot
    ? Math.min(BASELINE.keeperMaximumDepth, ballDistance / 2)
    : BASELINE.keeperRestingDepth;
  const targetX = goalX + direction * depth;
  // This baseline explicitly asks its keeper to narrow the angle or meet an incoming shot.
  // The engine's guard order only moves to this point; it never selects a target itself.
  let targetY =
    FIELD.width / 2 +
    ((state.ball.position.y - FIELD.width / 2) * depth) / Math.max(depth, ballDistance);
  if (!owner && state.ball.velocity.x * direction < 0) {
    const arrivalSeconds = (targetX - state.ball.position.x) / state.ball.velocity.x;
    if (arrivalSeconds > 0)
      targetY = state.ball.position.y + state.ball.velocity.y * arrivalSeconds;
  }
  return {
    x: targetX,
    y: clamp(targetY, FIELD.width / 2 - FIELD.goalWidth / 2, FIELD.width / 2 + FIELD.goalWidth / 2),
  };
}

function onPitch(position: Vec2): Vec2 {
  return { x: clamp(position.x, 1, FIELD.length - 1), y: clamp(position.y, 1, FIELD.width - 1) };
}

function clearPass(state: MatchState, from: Vec2, to: Vec2, team: Team): boolean {
  const segment = { x: to.x - from.x, y: to.y - from.y };
  const lengthSquared = segment.x ** 2 + segment.y ** 2;
  return state.players
    .filter((player) => player.team !== team && !player.dismissed)
    .every((player) => {
      const fraction = clamp(
        ((player.position.x - from.x) * segment.x + (player.position.y - from.y) * segment.y) /
          Math.max(lengthSquared, 1),
        0,
        1,
      );
      const closest = { x: from.x + fraction * segment.x, y: from.y + fraction * segment.y };
      return (
        distanceBetween(closest, player.position) >
        BALL_CONTROL.receivingRadius + MOVEMENT.playerRadius
      );
    });
}

function chooseDelivery(state: MatchState, player: Player): KickOrder | null {
  const direction = attackDirection(state, player.team);
  const goalX = direction === 1 ? FIELD.length : 0;
  const distanceToGoal = Math.abs(goalX - player.position.x);
  const opposingKeeper = state.players.find(
    (candidate) => candidate.team !== player.team && candidate.role === 'keeper',
  )!;
  if (distanceToGoal < BASELINE.shootingDistance && state.phase.type !== 'restart_setup') {
    const targetY =
      FIELD.width / 2 +
      (opposingKeeper.position.y >= FIELD.width / 2 ? -1 : 1) * (FIELD.goalWidth / 2 - 1);
    return {
      type: 'shoot',
      playerId: player.id,
      target: { x: goalX, y: targetY },
      speed: 26,
      loft: 1.2,
    };
  }

  const teammates = state.players
    .filter(
      (candidate) =>
        candidate.team === player.team && candidate.id !== player.id && !candidate.dismissed,
    )
    .filter((candidate) => {
      const distance = distanceBetween(candidate.position, player.position);
      return (
        distance >= 4 &&
        distance < BASELINE.passDistance &&
        clearPass(state, player.position, candidate.position, player.team)
      );
    })
    .sort((first, second) => direction * (second.position.x - first.position.x));
  const receiver =
    teammates.find((candidate) => direction * (candidate.position.x - player.position.x) > 3) ??
    (state.phase.type === 'restart_ready' ? teammates[0] : undefined);
  if (!receiver) return null;
  const target = onPitch({
    x: receiver.position.x + receiver.velocity.x * 0.3,
    y: receiver.position.y + receiver.velocity.y * 0.3,
  });
  const passDistance = distanceBetween(player.position, target);
  const speed = Math.sqrt(
    2 * BALL_CONTROL.groundDeceleration * passDistance + BASELINE.receivingSpeed ** 2,
  );
  return {
    type: 'kick',
    playerId: player.id,
    target,
    speed: Math.min(speed, BALL_CONTROL.maximumFootControlSpeed - 0.5),
  };
}

export function scriptedOrders(state: MatchState, team: Team): Order[] {
  if (state.phase.type === 'halftime' || state.phase.type === 'full_time') return [];
  const direction = attackDirection(state, team);
  const ownPlayers = state.players.filter((player) => player.team === team && !player.dismissed);
  const owner = state.players.find((player) => player.id === state.ball.owner);
  const predictedBall = onPitch({
    x: state.ball.position.x + state.ball.velocity.x * BASELINE.ballPredictionSeconds,
    y: state.ball.position.y + state.ball.velocity.y * BASELINE.ballPredictionSeconds,
  });
  const pressing = ownPlayers
    .filter((player) => player.role !== 'keeper')
    .sort(
      (first, second) =>
        distanceBetween(first.position, predictedBall) -
        distanceBetween(second.position, predictedBall),
    )
    .slice(0, BASELINE.pressingPlayers)
    .map((player) => player.id);

  return ownPlayers.map((player): Order => {
    if (state.phase.type === 'restart_ready' && player.id === state.phase.restart.takerId) {
      const delivery = chooseDelivery(state, player);
      if (delivery) return delivery;
      // A declared fixture tactic for a crowded restart: deliver inward, never award success.
      const inward = unitVector({
        x: FIELD.length / 2 - state.ball.position.x,
        y: FIELD.width / 2 - state.ball.position.y,
      });
      return {
        type: 'kick',
        playerId: player.id,
        target: onPitch({
          x: state.ball.position.x + inward.x * 15,
          y: state.ball.position.y + inward.y * 15,
        }),
        speed: 12,
        loft: 2,
      };
    }
    if (state.phase.type === 'open_play' && owner?.id === player.id) {
      return (
        chooseDelivery(state, player) ?? {
          type: 'move',
          playerId: player.id,
          target: onPitch({
            x: player.position.x + direction * 15,
            y: FIELD.width / 2 + (player.position.y - FIELD.width / 2) * 0.6,
          }),
          pace: 0.86,
        }
      );
    }
    if (player.role === 'keeper') {
      return {
        type: 'guard',
        playerId: player.id,
        target: keeperTarget(state, team),
      };
    }
    if (state.phase.type === 'open_play' && owner?.team !== team && pressing.includes(player.id)) {
      if (
        owner &&
        state.tick - player.lastTackleTick >= TACKLE.recoveryTicks &&
        state.ball.position.z <= BALL_CONTROL.maximumFootControlHeight &&
        distanceBetween(player.position, state.ball.position) < TACKLE.ballReach &&
        distanceBetween(player.position, owner.position) < TACKLE.maximumOpponentDistance &&
        // Declared fixture tactic: decline contact that our referee would penalize.
        tackleFoul(state, player, owner) === null
      )
        return { type: 'tackle', playerId: player.id, targetId: owner.id };
      return { type: 'move', playerId: player.id, target: predictedBall, pace: 1 };
    }
    const base = SUPPORT_POSITIONS[player.number - 1]!;
    const attackingBallX =
      direction === 1 ? state.ball.position.x : FIELD.length - state.ball.position.x;
    const push = clamp((attackingBallX - FIELD.length / 2) * 0.65, -15, 33);
    const target = {
      x: base.x + push,
      y: base.y + (state.ball.position.y - FIELD.width / 2) * 0.1,
    };
    return {
      type: 'move',
      playerId: player.id,
      target: onPitch({
        x: direction === 1 ? target.x : FIELD.length - target.x,
        y: direction === 1 ? target.y : FIELD.width - target.y,
      }),
      pace: 0.7,
    };
  });
}
