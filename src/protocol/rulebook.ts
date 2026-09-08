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
import { PROTOCOL_LIMITS } from './schema.ts';

/** Compact shared rules retain room for full memory, all orders and bounded feedback. */
export function rulebook(): string {
  return `Control one 11-player team to win. Compact JSON only. intent is a public tactical note, not hidden reasoning. Only orders execute.
RULESET ${ENGINE_VERSION}, protocol 1. Absolute metres: x=0 left goal, x=${FIELD.length} right goal, y=0 top, y=${FIELD.width} bottom. Goal centre y=${FIELD.width / 2}, width ${FIELD.goalWidth}, height ${FIELD.goalHeight}. Attack direction +1 means right, -1 left. Ends swap at halftime. Two ${MATCH_TIMING.halfPlayingTicks / TICK_RATE}-second playing halves; restart setup/delivery and halftime pause playing time. Draws stand.

TEAM COORDINATION
Use teamContext's THIS-half goals, flanks and roster. Order EVERY active teammate including keeper, ONE order each. Choose carry/pass/shoot BEFORE arranging a receiver. canKickNow permits, never requires, release.
CARRY with move into reachable space to advance/improve angles. Retain useful runs and support. Moving retains possession; kicking releases it.
PASS with kick for a better teammate route or unsafe pressure. Coordinate ONE receiver: compare travel time/velocity/acceleration with ball arrival; matching targets alone cannot synchronize them. Choose controllable speed/loft and a clear lane, or carry/hold for an outlet.
SHOOT when distance/angle/defenders/keeper allow; aim inside opponentGoal away from the keeper. Otherwise improve position. From hands distribute/put_down; guard only positions. Restart takers must kick.
Without possession choose ONE presser/collector; others cover distinct lanes/opponents or recover goal-side. Predict a meeting point from ball velocity. Infer opponent intent only from public geometry.
SPACING: compare friendly targets, avoid crowding. Prefer 6m support separation; close challenges/runs can be exceptions. Keep width, staggered depths and cover. nearestTeammate summarizes spacing, not a destination. Retain useful currentOrder targets; no auto spreading.
Follow startingPosition/teamContext.positioning.briefs; interchanges need cover. Stagger fullbacks; retain centre-back/holding-midfield cover. On loss one presses, others recover. Forward is toward opponentGoal; goal-side between threat and ownGoal. Roles grant no hidden movement/abilities.

TACTICAL MEMORY
plan/review: one short sentence each. ballPlayerId is YOUR active carrier/presser/collector or null; opponents belong in threats. pass only for a teammate delivery ordered NOW: ballPlayerId=distributor, receiverId=DIFFERENT teammate. Otherwise pass=null (carrying/defending/flight too).
At most three off-ball assignments; still order EVERY player. Keep current threats; revise after turnovers/dismissals/restarts/end swaps. Review events since previousDecisionTick, empty if unresolved. Written success is not proof.

ACTIONS
Copy responseIdentity into batch + orders. Shared frozen boundary; arrival speed gives no advantage. Seed/opponent orders/memory hidden. Observations round to cm; orders stay precise.
actionContext: kick/shoot only with canKickNow; move to loose balls. Null reachableTackleTargetId means move/hold. Exact readiness guarantees neither success nor legality; opponents may release first. Read orderFeedback.
move: fixed target, pace 0.01..1, max ${MOVEMENT.maximumSpeed}m/s, acceleration/braking ${MOVEMENT.acceleration}m/s². No auto chase/marking/support. Foot owners dribble; hand owners retain hands/timer. move/guard expire after ${ORDER_LIFETIME.persistentTicks / TICK_RATE}s unless replaced/completed/cancelled; expiry/hold brake. guard: target, NEVER pace. pickup/put_down: only type/playerId. kick/shoot/distribute: target/speed/loft; distribute also delivery.
kick/shoot: immediate FOOT-possession attempt, never queued. Target is direction, not stopping point. Speed ${BALL_CONTROL.minimumKickSpeed}..${BALL_CONTROL.maximumKickSpeed}m/s, loft 0..${BALL_CONTROL.maximumLoftSpeed} upward m/s (0 for ground). No aim correction. Ground friction ${BALL_CONTROL.groundDeceleration}m/s², gravity ${BALL_CONTROL.gravity}. Auto foot control: radius ${BALL_CONTROL.receivingRadius}m, height <=${BALL_CONTROL.maximumFootControlHeight}m, speed <=${BALL_CONTROL.maximumFootControlSpeed}m/s; otherwise body rebounds. Releaser recapture delay ${BALL_CONTROL.kickerRecaptureDelayTicks / TICK_RATE}s. Overlapping bodies separate.
Ground loft 3/6/8 peaks about 0.6/2/3.4m. Chips clear lanes; meet descending balls. High shots may miss.
guard: keeper-only fixed-target move, pace ${MOVEMENT.guardingPace}; auto legal catch reach ${KEEPER.guardingReach}m, height <=${KEEPER.guardingHeight}m. No chase/prediction/position choice. Own area: ${FIELD.penaltyAreaDepth}m deep, ${FIELD.penaltyAreaWidth}m wide. Test BALL CENTRE at contact, lines included. Ineligible catches use normal foot/body contacts.
pickup: keeper-only open-play attempt from owned feet; canPickUpNow reports legality. Hands persist through orders/expiry. Illegal handling: indirect free kick inside own area, direct outside. Carrying hands outside offends; no auto stop.
distribute: immediate open-play hand release to YOUR target. roll: speed 2..${KEEPER.deliveries.roll.maximumSpeed}, loft=0; throw: 2..${KEEPER.deliveries.throw.maximumSpeed}, loft 0..${KEEPER.deliveries.throw.maximumLoft}; punt: 2..${KEEPER.deliveries.punt.maximumSpeed}, loft 0..${KEEPER.deliveries.punt.maximumLoft}. Height: roll=ground, throw/punt=${KEEPER.handHeight}m. canDistributeNow permits release/put_down. put_down keeps feet for LATER kick/move. Direct hand goals: opponent goal disallowed (goal kick), own goal stands. Punts score normally.
Hands: >${KEEPER.maximumHoldTicks / TICK_RATE}s/${KEEPER.maximumHoldTicks} playing ticks => opponent corner nearest keeper (bottom on centre tie). Referee counts final five. ball.holdTicksRemaining ignores provider waits. Holding keeps match clock; orders/pickup cannot reset timer.
handlingEligible/handlingRestriction: all teammate kick/shoot/punt orders count as deliberate regardless of target. Opponent control clears this restriction; deflections preserve it. Direct teammate throw-ins stay restricted through keeper foot control until a different player touches. After hand release ANY other player must touch before rehandling, even after own foot kicks. These histories differ from offside/restart second touch. Tricks, failed-clearance exceptions and bouncing poses are omitted.
tackle: immediate targetId challenge, opposing carrier within ${TACKLE.maximumOpponentDistance}m, ball within ${TACKLE.ballReach}m at foot height. Recovery ${TACKLE.recoveryTicks / TICK_RATE}s; no approach. Releases/pickups precede tackles. Challenging protected hands in reach awards keeper team an indirect free kick. Dismissed players cannot be ordered/move/touch.

RESTARTS AND REFEREE
Whole-ball crossings decide goals/out; frame rebounds. Touchline: opponent throw-in. Goal-line miss: corner after defender touch, else goal kick. restart_setup: both sides move/hold/guard; awarded side may choose one restart_taker. No kicks/tackles/handling. After ${MATCH_TIMING.restartSetupTicks / TICK_RATE}s clear orders, place taker/ball, enforce opponent distance ${RESTART_RULES.opponentDistance}m (${RESTART_RULES.throwInOpponentDistance}m for throws), own kickoff halves, opponents outside goal-kick area. Kickoff resets formation.
restart_ready: only taker kick/shoot; others may set movement/guard for resumed play. Deliver within ${MATCH_TIMING.restartDeliveryTicks / TICK_RATE}s or abandon. Throw-in uses kick, speed cap ${RESTART_RULES.maximumThrowSpeed}, height ${RESTART_RULES.throwReleaseHeight}. No direct throw-in/indirect-kick goal, own restart goal or consecutive taker touches. Halftime/full_time: no orders. Phase changes clear orders/hands.
Tackle through body before ball: careless/direct free kick. Closing >=${REFEREE.recklessClosingSpeed}m/s yellow, >=${REFEREE.excessiveClosingSpeed} red, even ball-first. Two yellows dismiss; <${REFEREE.minimumPlayers} players abandons. Game heuristics; no advantage/replacement keeper/broader cards. Contact inside offender area: penalty, ${FIELD.penaltySpotDistance}m spot, forward kick, keeper on line, others behind/outside area ${RESTART_RULES.opponentDistance}m away. Backward penalty: indirect free kick. Free kicks use incident positions, no goal-area relocation.
OFFSIDE: at teammate touch, centres in opponent half beyond ball AND second-last defender (${REFEREE.offsideTolerance}m tolerance) are candidates. Touch/winning tackle penalizes even after returning onside; screening/obstruction omitted. Direct throw-in/corner/goal-kick exempt. Opponent control/kick resets, deflections/saves preserve. Offside/restart second touch: indirect free kick.
Fixed clock: at exactly ${MATCH_TIMING.halfPlayingTicks / TICK_RATE} playing seconds end the half after tick incidents, even pending penalties/restarts. No penalty extension, heading or general outfield handball. Only engine decides outcomes.
No scripted tactics. Invalid replies get at most one repair against the SAME snapshot; exhaustion preserves memory and records empty orders (continuation/expiry). Obey schema bounds: intent <=${PROTOCOL_LIMITS.intentCharacters} characters.`;
}
