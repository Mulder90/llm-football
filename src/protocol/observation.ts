import { BALL_CONTROL, FIELD, TACKLE, TICK_RATE, MATCH_TIMING } from '../sim/rules.ts';
import { distanceBetween } from '../sim/math.ts';
import { attackDirection, cloneOrder, clonePhase } from '../sim/state.ts';
import type { MatchState, Player, Team, Vec2 } from '../sim/types.ts';
import { PROTOCOL_LIMITS } from './schema.ts';

const round = (value: number) => Math.round(value * 100) / 100;
const position = (point: Vec2) => ({ x: round(point.x), y: round(point.y) });

/** Public geometry and mechanical preconditions, never a chosen receiver, marker or run. */
function actionContext(state: MatchState, player: Player) {
  const opponents = state.players.filter((other) => other.team !== player.team && !other.dismissed);
  const nearest = opponents.reduce<Player | undefined>(
    (closest, other) =>
      !closest ||
      distanceBetween(player.position, other.position) <
        distanceBetween(player.position, closest.position)
        ? other
        : closest,
    undefined,
  );
  const carrier = opponents.find((other) => other.id === state.ball.owner);
  const distanceToBall = distanceBetween(player.position, state.ball.position);
  const tackleCooldownTicks = Math.max(
    0,
    player.lastTackleTick + TACKLE.recoveryTicks - state.tick,
  );
  const canReachCarrier =
    !player.dismissed &&
    state.phase.type === 'open_play' &&
    carrier &&
    tackleCooldownTicks === 0 &&
    distanceBetween(player.position, carrier.position) <= TACKLE.maximumOpponentDistance &&
    distanceToBall <= TACKLE.ballReach &&
    state.ball.position.z <= BALL_CONTROL.maximumFootControlHeight;
  const kickingPhase =
    state.phase.type === 'open_play' ||
    (state.phase.type === 'restart_ready' && state.phase.restart.takerId === player.id);
  return {
    canKickNow: !player.dismissed && kickingPhase && state.ball.owner === player.id,
    reachableTackleTargetId: canReachCarrier ? carrier.id : null,
    tackleCooldownTicks,
    distanceToBall: round(distanceToBall),
    nearestOpponent: nearest
      ? {
          playerId: nearest.id,
          distance: round(distanceBetween(player.position, nearest.position)),
        }
      : null,
  };
}

export function observe(
  state: MatchState,
  team: Team,
  memory: string,
  decisionIntervalTicks: number,
  previousDecisionTick = 0,
) {
  const direction = attackDirection(state, team);
  const carrier = state.players.find((player) => player.id === state.ball.owner);
  const phaseInstruction =
    state.phase.type === 'restart_ready'
      ? state.phase.restart.team === team
        ? `DELIVERY REQUIRED: issue kick or shoot for ${state.phase.restart.takerId} now. Choose the target, speed and loft. Move cannot restart play; everyone remains stationary until the kick.`
        : `The opponent must deliver this ${state.phase.restart.type}. Set defensive movement and keeper guard orders for when play resumes. You cannot kick or tackle yet.`
      : state.phase.type === 'restart_setup'
        ? 'Setup only: position your team with move or guard. Guard already moves the keeper; do not add a separate move for the same player. The delivery decision follows setup.'
        : state.phase.type === 'open_play'
          ? "Coordinate the team: carrier action, receiver/support runs, and defensive cover. Read teamContext and each owned player's actionContext. Kicks and tackles execute now; movement persists."
          : 'The clock is stopped for the interval or full time. No orders are accepted.';
  return {
    protocolVersion: 1,
    engine: state.version,
    phaseInstruction,
    responseIdentity: {
      version: 1,
      matchId: state.matchId,
      decisionId: state.decisionId,
      tick: state.tick,
      team,
    },
    phase: clonePhase(state.phase),
    half: state.half,
    playingSeconds: state.playingTicks / TICK_RATE,
    halfDurationSeconds: MATCH_TIMING.halfPlayingTicks / TICK_RATE,
    halfSecondsRemaining: (MATCH_TIMING.halfPlayingTicks - state.halfPlayingTicks) / TICK_RATE,
    secondsUntilNextScheduledDecision: decisionIntervalTicks / TICK_RATE,
    attackDirection: direction,
    teamContext: {
      team,
      ownGoal: { x: direction === 1 ? 0 : FIELD.length, y: FIELD.width / 2 },
      opponentGoal: { x: direction === 1 ? FIELD.length : 0, y: FIELD.width / 2 },
      possession: carrier ? (carrier.team === team ? 'ours' : 'theirs') : 'loose',
      ballCarrierId: carrier?.id ?? null,
      teammateIds: state.players
        .filter((player) => player.team === team && !player.dismissed)
        .map((player) => player.id),
      opponentIds: state.players
        .filter((player) => player.team !== team && !player.dismissed)
        .map((player) => player.id),
    },
    score: { ...state.score },
    offside: state.offside ? { ...state.offside, playerIds: [...state.offside.playerIds] } : null,
    ball: {
      position: { ...position(state.ball.position), z: round(state.ball.position.z) },
      velocity: { ...position(state.ball.velocity), z: round(state.ball.velocity.z) },
      owner: state.ball.owner,
      lastTouch: state.ball.lastTouch,
    },
    players: state.players.map((player) => ({
      id: player.id,
      team: player.team,
      number: player.number,
      role: player.role,
      yellowCards: player.yellowCards,
      dismissed: player.dismissed,
      position: position(player.position),
      velocity: position(player.velocity),
      facing: position(player.facing),
      ...(player.team === team
        ? {
            currentOrder: player.active
              ? {
                  order: cloneOrder(player.active.order),
                  remainingTicks: Math.max(0, player.active.expires - state.tick),
                }
              : null,
            tackleReady: state.tick - player.lastTackleTick >= TACKLE.recoveryTicks,
            actionContext: actionContext(state, player),
          }
        : {}),
    })),
    recentEvents: state.events.slice(-PROTOCOL_LIMITS.recentEvents).map((event) => ({ ...event })),
    orderFeedback: state.events
      .filter(
        (event) =>
          event.tick >= previousDecisionTick &&
          event.playerId?.startsWith(`${team}-`) &&
          (event.type === 'order_failed' || event.type === 'restart_violation'),
      )
      .slice(-PROTOCOL_LIMITS.recentEvents)
      .map((event) => ({ ...event })),
    privateMemory: memory,
  };
}

export type Observation = ReturnType<typeof observe>;
