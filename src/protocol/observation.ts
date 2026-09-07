import {
  BALL_CONTROL,
  FIELD,
  KEEPER,
  MATCH_TIMING,
  MOVEMENT,
  ORDER_LIFETIME,
  RESTART_RULES,
  TACKLE,
  TICK_RATE,
  ENGINE_VERSION,
  REFEREE,
} from '../sim/rules.ts';
import { attackDirection, cloneOrder, clonePhase } from '../sim/state.ts';
import type { MatchState, Team, Vec2 } from '../sim/types.ts';
import { PROTOCOL_LIMITS } from './schema.ts';

const round = (value: number) => Math.round(value * 100) / 100;
const position = (point: Vec2) => ({ x: round(point.x), y: round(point.y) });

export function observe(
  state: MatchState,
  team: Team,
  memory: string,
  decisionIntervalTicks: number,
) {
  const phaseInstruction =
    state.phase.type === 'restart_ready'
      ? state.phase.restart.team === team
        ? `DELIVERY REQUIRED: issue kick or shoot for ${state.phase.restart.takerId} now. Choose the target, speed and loft. Move cannot restart play; everyone remains stationary until the kick.`
        : `The opponent must deliver this ${state.phase.restart.type}. Set defensive movement and keeper guard orders for when play resumes. You cannot kick or tackle yet.`
      : state.phase.type === 'restart_setup'
        ? 'Setup only: position your team with move or guard. Guard already moves the keeper; do not add a separate move for the same player. The delivery decision follows setup.'
        : 'Open play: choose actions from the current ball ownership and physical reach. Kicks and tackles execute now; move and guard persist.';
  return {
    protocolVersion: 1,
    engine: ENGINE_VERSION,
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
    halfSecondsRemaining: (MATCH_TIMING.halfPlayingTicks - state.halfPlayingTicks) / TICK_RATE,
    secondsUntilNextScheduledDecision: decisionIntervalTicks / TICK_RATE,
    attackDirection: attackDirection(state, team),
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
          }
        : {}),
    })),
    recentEvents: state.events.slice(-PROTOCOL_LIMITS.recentEvents).map((event) => ({ ...event })),
    privateMemory: memory,
  };
}

export type Observation = ReturnType<typeof observe>;
export function rulebook(): string {
  return `You control one football team of 11 players. Try to win through your own decisions. Return only the requested JSON. Your intent is a brief public tactical note, not hidden reasoning. Your memory is a private notebook returned to you next time. Nothing in either text field executes an action.
RULESET ${ENGINE_VERSION}, protocol 1. Coordinates are absolute metres: x=0 left goal, x=${FIELD.length} right goal; y=0 top touchline, y=${FIELD.width} bottom. Goal centre y=${FIELD.width / 2}, width ${FIELD.goalWidth}, height ${FIELD.goalHeight}. Attack direction +1 means toward x=${FIELD.length}, -1 toward x=0. Ends swap at halftime. Two ${MATCH_TIMING.halfPlayingTicks / TICK_RATE}-second playing halves; setup pauses playing time. Draws stand.
Exact action fields (no extras): hold {type,playerId}; move {type,playerId,target:{x,y},pace}; guard {type,playerId,target:{x,y}}; kick/shoot {type,playerId,target:{x,y},speed,loft}; tackle {type,playerId,targetId}; restart_taker {type,playerId}. Every move needs pace. Every guard needs a target and has NO pace field.
Copy responseIdentity exactly into batch, adding orders. Do not increment decisionId. At most one new order per owned player. Both teams observe this same frozen boundary and commit simultaneously; wall-clock response speed gives no advantage. You see the full public field, your own current orders and your own notebook, never opponent orders/notebook or random state. Coordinates are rounded to centimetres in observations only.
A move targets one fixed point at pace 0.01..1. Maximum speed ${MOVEMENT.maximumSpeed} m/s, acceleration ${MOVEMENT.acceleration} m/s². Automatic braking stops at the point. Movement does NOT chase balls, mark opponents or invent supporting runs. A carrier dribbles mechanically at its foot. Orders last ${ORDER_LIFETIME.persistentTicks / TICK_RATE}s, unless replaced/completed/cancelled; omitted players continue then decelerate to rest. hold brakes immediately.
A kick or shoot executes once NOW and fails if that player does not own the ball; it is never queued for future possession. Target is a direction point, speed ${BALL_CONTROL.minimumKickSpeed}..${BALL_CONTROL.maximumKickSpeed} m/s, loft 0..${BALL_CONTROL.maximumLoftSpeed} upward m/s (always supply loft=0 for ground). No automatic aiming or guaranteed success. Ground friction ${BALL_CONTROL.groundDeceleration} m/s²; gravity ${BALL_CONTROL.gravity}. Ground reception is automatic within ${BALL_CONTROL.receivingRadius}m, below ${BALL_CONTROL.maximumFootControlHeight}m and at speeds <=${BALL_CONTROL.maximumFootControlSpeed}m/s; faster/higher contacts can rebound. The kicker cannot re-capture for ${BALL_CONTROL.kickerRecaptureDelayTicks / TICK_RATE}s. Players separate on body overlap.
Dismissed players cannot receive orders, move or touch the ball. A guard order is ONLY for keeper #1: move to its fixed target at pace ${MOVEMENT.guardingPace}, with automatic catching reach ${KEEPER.guardingReach}m up to ${KEEPER.guardingHeight}m high inside its own penalty area (${FIELD.penaltyAreaDepth}m deep, ${FIELD.penaltyAreaWidth}m wide). Guard does not select a position or chase/predict shots. Keeper must be ordered to distribute after catching.
A tackle attempts to take the ball from targetId NOW: opposing carrier must be within ${TACKLE.maximumOpponentDistance}m and ball within ${TACKLE.ballReach}m. Recovery ${TACKLE.recoveryTicks / TICK_RATE}s. No auto chase. Kicks resolve before tackles at a boundary. Do not tackle a distant player; move into range first.
Whole-ball crossings determine goals/out. Posts/bar rebound. Throw-in to opponent of last touch; goal-line miss is corner after defender touch, otherwise goal kick. In restart_setup, both teams may move/hold/guard; awarded team may choose one restart_taker. No kicks or tackles in setup. After ${MATCH_TIMING.restartSetupTicks / TICK_RATE}s the referee clears setup orders, places taker and ball, and enforces ${RESTART_RULES.opponentDistance}m opponent separation (${RESTART_RULES.throwInOpponentDistance}m at throws), own halves at kickoff, opponents outside goal-kick penalty area. Kickoff resets formation. In restart_ready only the selected taker can kick/shoot; both teams may issue movement/guard for the resumed play. Taker MUST kick within ${MATCH_TIMING.restartDeliveryTicks / TICK_RATE}s or match is abandoned. A throw uses kick, speed capped at ${RESTART_RULES.maximumThrowSpeed}, release height ${RESTART_RULES.throwReleaseHeight}. No direct throw-in goal, direct own-restart goal, or consecutive taker touches. Halftime/full_time accept no actions. Phase changes clear old orders.
REFEREE: A tackle reaching through the carrier's body before the ball is a careless foul. Closing speed >=${REFEREE.recklessClosingSpeed} m/s is reckless (yellow), >=${REFEREE.excessiveClosingSpeed} m/s is excessive (red), even when reaching the ball. Two yellows dismiss; fewer than ${REFEREE.minimumPlayers} active players abandons the match. No advantage, automatic replacement keeper or other card offences. Contact location inside the offender's penalty area awards a penalty; otherwise a direct free kick. Penalty spot is ${FIELD.penaltySpotDistance}m from goal: taker must kick forward, opposing keeper starts on the goal line, others behind and outside the area at least ${RESTART_RULES.opponentDistance}m away. A backward penalty awards an indirect free kick.
OFFSIDE: At each teammate touch, a player centre in the opponent half beyond both the ball and second-last defender (tolerance ${REFEREE.offsideTolerance}m) becomes a candidate. An offence occurs only on touching the ball or winning a tackle, even after returning onside. Mere position, screening and obstructing are not judged. Direct throw-in/corner/goal-kick deliveries are exempt. Opponent controlled reception or deliberate kick resets the snapshot; deflections and guarding saves do not. Offside and a restart taker's second touch award an indirect free kick, which cannot score directly.
Fixed-clock simplification: at exactly 180 playing seconds the half ends after that tick's incidents, including an in-flight penalty or newly awarded restart. No penalty extension. Heading, handball, back-pass and keeper holding limits are not implemented. The engine alone decides success, scores and referee outcomes.
Use all your players intentionally, keep a goalkeeper and defensive cover, and consider travel time. You receive no scripted tactical assistance. Invalid batches get at most one repair against the SAME snapshot; failure uses empty orders (continuation/expiry only). Memory <=${PROTOCOL_LIMITS.memoryCharacters} characters, intent <=${PROTOCOL_LIMITS.intentCharacters}.`;
}
