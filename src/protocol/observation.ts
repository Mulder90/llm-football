import { BALL_CONTROL, FIELD, KEEPER, TACKLE, TICK_RATE, MATCH_TIMING } from '../sim/rules.ts';
import { handlingRestriction, possessionMode } from '../sim/ball-control.ts';
import { distanceBetween } from '../sim/math.ts';
import { attackDirection, cloneOrder, clonePhase } from '../sim/state.ts';
import type { MatchState, Order, Player, Team, Vec2 } from '../sim/types.ts';
import { PROTOCOL_LIMITS } from './schema.ts';
import type { TacticalMemory } from './schema.ts';
import { POSITION_BRIEFS, startingPosition } from './positions.ts';

const round = (value: number) => Math.round(value * 100) / 100;
const position = (point: Vec2) => ({ x: round(point.x), y: round(point.y) });

function observedOrder(order: Order): Order {
  const copy = cloneOrder(order);
  // Accepted orders stay exact; their copied targets follow observation geometry precision.
  if ('target' in copy) copy.target = position(copy.target);
  return copy;
}

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
  const teammates = state.players.filter(
    (other) => other.team === player.team && other.id !== player.id && !other.dismissed,
  );
  const nearestTeammate = teammates.reduce<Player | undefined>(
    (closest, other) =>
      !closest ||
      distanceBetween(player.position, other.position) <
        distanceBetween(player.position, closest.position)
        ? other
        : closest,
    undefined,
  );
  const distanceToBall = distanceBetween(player.position, state.ball.position);
  const tackleCooldownTicks = Math.max(
    0,
    player.lastTackleTick + TACKLE.recoveryTicks - state.tick,
  );
  const canReachCarrier =
    !player.dismissed &&
    state.phase.type === 'open_play' &&
    carrier &&
    !state.ball.handControl &&
    tackleCooldownTicks === 0 &&
    distanceBetween(player.position, carrier.position) <= TACKLE.maximumOpponentDistance &&
    distanceToBall <= TACKLE.ballReach &&
    state.ball.position.z <= BALL_CONTROL.maximumFootControlHeight;
  const kickingPhase =
    state.phase.type === 'open_play' ||
    (state.phase.type === 'restart_ready' && state.phase.restart.takerId === player.id);
  return {
    canKickNow:
      !player.dismissed &&
      kickingPhase &&
      state.ball.owner === player.id &&
      !state.ball.handControl,
    ...(player.role === 'keeper'
      ? {
          handlingEligible: handlingRestriction(state, player) === null,
          handlingRestriction: handlingRestriction(state, player),
          canPickUpNow:
            !player.dismissed &&
            state.phase.type === 'open_play' &&
            state.ball.owner === player.id &&
            !state.ball.handControl &&
            handlingRestriction(state, player) === null,
          canDistributeNow:
            !player.dismissed &&
            state.phase.type === 'open_play' &&
            state.ball.owner === player.id &&
            Boolean(state.ball.handControl),
        }
      : {}),
    reachableTackleTargetId: canReachCarrier ? carrier.id : null,
    tackleCooldownTicks,
    distanceToBall: round(distanceToBall),
    nearestTeammate: nearestTeammate
      ? {
          playerId: nearestTeammate.id,
          distance: round(distanceBetween(player.position, nearestTeammate.position)),
        }
      : null,
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
  memory: TacticalMemory | null,
  decisionIntervalTicks: number,
  previousDecisionTick = 0,
  evaluationPlayingTicks?: number,
) {
  const direction = attackDirection(state, team);
  const carrier = state.players.find((player) => player.id === state.ball.owner);
  const phaseInstruction =
    state.phase.type === 'restart_ready'
      ? state.phase.restart.team === team
        ? `DELIVERY REQUIRED: issue kick or shoot for ${state.phase.restart.takerId} now. Choose the target, speed and loft. Move cannot restart play; everyone remains stationary until the kick.`
        : `The opponent must deliver this ${state.phase.restart.type}. Set defensive movement and keeper guard orders for when play resumes. You cannot kick or tackle yet.`
      : state.phase.type === 'restart_setup'
        ? 'Setup only: outfield players use move/hold; only your keeper may guard. Guard already moves the keeper; one order per player. The delivery decision follows setup.'
        : state.phase.type === 'open_play'
          ? 'Choose carry, pass or shoot from space, pressure and goal position; move retains foot or hand possession; from hands choose distribute or put_down before kicking. Coordinate support and cover, and a receiver only when passing. Read actionContext. Movement persists; kicks/tackles execute now.'
          : 'The clock is stopped for the interval or full time. No orders are accepted.';
  return {
    protocolVersion: 1,
    engine: state.version,
    ...(evaluationPlayingTicks !== undefined && {
      evaluation: {
        plannedPlayingTicks: evaluationPlayingTicks,
        remainingPlayingTicks: Math.max(0, evaluationPlayingTicks - state.playingTicks),
      },
    }),
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
    matchSecondsRemaining: (2 * MATCH_TIMING.halfPlayingTicks - state.playingTicks) / TICK_RATE,
    previousDecisionTick: Math.max(0, previousDecisionTick),
    secondsUntilNextScheduledDecision: decisionIntervalTicks / TICK_RATE,
    attackDirection: direction,
    teamContext: {
      team,
      keeperId:
        state.players.find(
          (player) => player.team === team && player.role === 'keeper' && !player.dismissed,
        )?.id ?? null,
      ownGoal: { x: direction === 1 ? 0 : FIELD.length, y: FIELD.width / 2 },
      opponentGoal: { x: direction === 1 ? FIELD.length : 0, y: FIELD.width / 2 },
      positioning: {
        startingShape: '4-3-3',
        leftTouchlineY: direction === 1 ? 0 : FIELD.width,
        rightTouchlineY: direction === 1 ? FIELD.width : 0,
        briefs: { ...POSITION_BRIEFS },
      },
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
      possessionMode: possessionMode(state.ball),
      holdTicksRemaining: state.ball.handControl
        ? Math.max(
            0,
            KEEPER.maximumHoldTicks -
              (state.playingTicks - state.ball.handControl.sincePlayingTick),
          )
        : null,
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
            startingPosition: startingPosition(player.number),
            currentOrder: player.active
              ? {
                  order: observedOrder(player.active.order),
                  remainingTicks: Math.max(0, player.active.expires - state.tick),
                }
              : null,
            actionContext: actionContext(state, player),
          }
        : {}),
    })),
    // Repeated deflections can otherwise bury the pass, reception or turnover needed to review a plan.
    recentEvents: state.events
      .filter((event) => event.type !== 'block')
      .slice(-PROTOCOL_LIMITS.recentEvents)
      .map((event) => ({ ...event })),
    orderFeedback: state.events
      .filter(
        (event) =>
          event.tick >= previousDecisionTick &&
          event.playerId?.startsWith(`${team}-`) &&
          (event.type === 'order_failed' ||
            event.type === 'restart_violation' ||
            event.type === 'keeper_violation'),
      )
      .slice(-PROTOCOL_LIMITS.recentEvents)
      .map((event) => ({ ...event })),
    privateMemory: memory ? structuredClone(memory) : null,
  };
}

export type Observation = ReturnType<typeof observe>;
