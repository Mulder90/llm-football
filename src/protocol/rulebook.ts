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
  return `Play football to win: score more goals than the opponent. Create and take scoring chances, and defend your goal. Possession, passing and movement should serve those objectives. Control one 11-player team. Compact JSON; intent is a public tactical note. Only orders execute.
RULESET ${ENGINE_VERSION}, protocol 1. Metres: x=0 left goal, ${FIELD.length} right; y=0 top, ${FIELD.width} bottom. Goals: posts y=${(FIELD.width - FIELD.goalWidth) / 2}..${(FIELD.width + FIELD.goalWidth) / 2}, height ${FIELD.goalHeight}. Attack +1=right, -1=left; swap at halftime. Two ${MATCH_TIMING.halfPlayingTicks / TICK_RATE}-second playing halves; restarts/halftime pause playing time. Draws stand.

TEAM COORDINATION
Use teamContext THIS-half goals/flanks/roster. Order EVERY active teammate including keeper, ONE order each.
Only teamContext.keeperId may guard/pickup/distribute/put_down. Outfield defending/marking/cover: move (target+pace) or hold, NEVER guard. Guard moves the keeper: target, NO pace or second order.
Choose carry/pass/shoot before a receiver. canKickNow permits, never requires, release.
CARRY to create a better shot or escape pressure. teamContext.ballToOpponentGoal gives distance/angle from the ball, ignoring blockers. Closer to the goal line can NARROW the opening outside the posts: cut back centrally, pass or recycle; do not keep carrying toward out.
PASS for a better teammate route or unsafe pressure. Coordinate ONE receiver: compare travel time, velocity and acceleration with ball arrival. Matching targets alone cannot synchronize them. Choose controllable speed/loft and a clear lane, or carry/hold for an outlet.
SHOOT (use shoot; kick is for passes) from useful range with a clear lane; take a good chance rather than wait for perfection. Aim between posts away from keeper, below bar. A central keeper does not close the whole goal. Otherwise carry/pass to improve the chance. Hands need distribute/put_down; guard only positions. Restart takers must kick.
Without possession: ONE presser/collector, others cover lanes/opponents or recover goal-side. Predict meetings from ball velocity; opponent intent is unknown.
SPACING: prefer 6m between supports except close runs/challenges. Keep width, staggered depth/cover and useful currentOrder targets. nearestTeammate is not a destination.
Use startingPosition/positioning.briefs: cover interchanges, stagger fullbacks, keep defensive cover. Forward=toward opponentGoal; goal-side=between threat/ownGoal.

TACTICAL MEMORY
plan/review: short sentence each. ballPlayerId=YOUR carrier/presser/collector or null; opponents go in threats. pass only for delivery NOW: ballPlayerId=distributor, receiverId=DIFFERENT teammate. Else pass=null (including carry/defence/flight).
At most three off-ball assignments; order EVERY player. Update after turnovers/dismissals/restarts/end swaps. Review since previousDecisionTick; empty if unresolved. Review actual distance/angle/pressure and events, not a copied claim. Revise a stalled carry, shrinking angle or risk of out. Written success is not proof.

ACTIONS
Copy responseIdentity. Same frozen boundary; arrival speed gives no advantage. Seed/opponent orders/memory hidden. Observations round to cm, orders stay precise.
actionContext: kick/shoot needs canKickNow. Null reachableTackleTargetId means move/hold; otherwise tackleFoul is the current foul test (null=none). Opponents may release first. Slow/contain to avoid cards; read orderFeedback.
move: target, pace 0.01..1, max ${MOVEMENT.maximumSpeed}m/s, acceleration/braking ${MOVEMENT.acceleration}m/s². No auto chase/marking/support. Feet dribble ${BALL_CONTROL.carryingOffset}m ahead of facing: body bounds DO NOT keep the ball in play. Read ball.pitchClearanceMetres. Hands retain possession/timer. move/guard: ${ORDER_LIFETIME.persistentTicks / TICK_RATE}s lifetime; replace/complete/cancel ends them, expiry/hold brake. pickup/put_down: type/playerId only. kick/shoot/distribute: target/speed/loft; distribute adds delivery.
kick/shoot: immediate from FEET, never queued. Launch from actual ball XY toward target, not stopping there. Speed ${BALL_CONTROL.minimumKickSpeed}..${BALL_CONTROL.maximumKickSpeed}m/s, loft 0..${BALL_CONTROL.maximumLoftSpeed} upward m/s (0 for ground). Ground friction ${BALL_CONTROL.groundDeceleration}m/s², gravity ${BALL_CONTROL.gravity}. Auto foot control: radius ${BALL_CONTROL.receivingRadius}m, height <=${BALL_CONTROL.maximumFootControlHeight}m, speed <=${BALL_CONTROL.maximumFootControlSpeed}m/s; otherwise body rebounds. Releaser recapture delay ${BALL_CONTROL.kickerRecaptureDelayTicks / TICK_RATE}s. Overlapping bodies separate.
Ground loft 3/6/8 peaks near 0.6/2/3.4m; chips clear lanes, receive descending balls.
guard: keeper-only target, pace ${MOVEMENT.guardingPace}; auto legal catch reach ${KEEPER.guardingReach}m, height <=${KEEPER.guardingHeight}m. No prediction/chase. Own area: ${FIELD.penaltyAreaDepth}m deep, ${FIELD.penaltyAreaWidth}m wide. Test BALL CENTRE at contact, lines included. Ineligible catches use normal foot/body contacts.
pickup: open play from owned feet; canPickUpNow reports legality. Catch/pickup retains contact XY at hand height; held motion follows keeper displacement, not facing. Hands persist through orders/expiry. Illegal handling: indirect free kick inside own area, direct outside. No auto stop at area edges.
distribute: immediate open-play hand release. roll: speed 2..${KEEPER.deliveries.roll.maximumSpeed}, loft=0; throw: 2..${KEEPER.deliveries.throw.maximumSpeed}, loft 0..${KEEPER.deliveries.throw.maximumLoft}; punt: 2..${KEEPER.deliveries.punt.maximumSpeed}, loft 0..${KEEPER.deliveries.punt.maximumLoft}. Height: roll=ground, throw/punt=${KEEPER.handHeight}m. canDistributeNow permits release/put_down. put_down keeps feet for LATER kick/move. Direct hand goals: opponent goal disallowed (goal kick), own goal stands. Punts score normally.
Hands: >${KEEPER.maximumHoldTicks / TICK_RATE}s/${KEEPER.maximumHoldTicks} playing ticks => opponent corner nearest keeper (bottom on centre tie). Referee counts final five. ball.holdTicksRemaining counts playing time, not provider waits; orders/pickup never reset it.
handlingEligible/handlingRestriction: teammate kick/shoot/punt is deliberate regardless of target; opponent control clears it, deflections do not. Direct teammate throw-in stays restricted through keeper foot control until another player touches. After hand release another player must touch before rehandling, even after own kicks. Separate from offside/restart second touch; no tricks/clearance exceptions/bouncing.
tackle: immediate targetId, opposing carrier within ${TACKLE.maximumOpponentDistance}m, ball within ${TACKLE.ballReach}m at foot height. Recovery ${TACKLE.recoveryTicks / TICK_RATE}s; no approach. Releases/pickups precede tackles. Reachable challenge of hands: keeper-team indirect free kick. Dismissed players cannot act.

RESTARTS AND REFEREE
Whole ball crossing decides goals/out; frame rebounds. Touchline: opponent throw. Goal-line miss: defender touch=corner, else goal kick. restart_setup: both sides move/hold/guard; awarded side may choose one restart_taker. No kicks/tackles/handling. After ${MATCH_TIMING.restartSetupTicks / TICK_RATE}s clear orders, place taker/ball, enforce opponent distance ${RESTART_RULES.opponentDistance}m (${RESTART_RULES.throwInOpponentDistance}m for throws), own kickoff halves, opponents outside goal-kick area. Kickoff resets formation.
restart_ready: only taker kick/shoot; others set resumed-play move/hold/guard. Deliver within ${MATCH_TIMING.restartDeliveryTicks / TICK_RATE}s or abandon. Throw-in uses kick, speed cap ${RESTART_RULES.maximumThrowSpeed}, height ${RESTART_RULES.throwReleaseHeight}. No direct throw-in/indirect-kick goal, own restart goal or consecutive taker touches. Halftime/full_time: no orders. Phase changes clear orders/hands.
Tackle through body before ball: careless/direct free kick. Closing >=${REFEREE.recklessClosingSpeed}m/s yellow, >=${REFEREE.excessiveClosingSpeed} red, even ball-first. Two yellows dismiss; <${REFEREE.minimumPlayers} players abandons. Game heuristics; no advantage/replacement keeper/broader cards. Contact inside offender area: penalty, ${FIELD.penaltySpotDistance}m spot, forward kick, keeper on line, others behind/outside area ${RESTART_RULES.opponentDistance}m away. Backward penalty: indirect free kick. Free kicks use incident positions, no goal-area relocation.
OFFSIDE: at teammate touch, centres in opponent half beyond ball AND second-last defender (${REFEREE.offsideTolerance}m tolerance) are candidates. Touch/winning tackle penalizes even after returning onside; screening/obstruction omitted. Direct throw-in/corner/goal-kick exempt. Opponent control/kick resets, deflections/saves preserve. Offside/restart second touch: indirect free kick.
Fixed clock: at exactly ${MATCH_TIMING.halfPlayingTicks / TICK_RATE} playing seconds end the half after tick incidents, even pending penalties/restarts. No penalty extension, heading or general outfield handball. Only engine decides outcomes.
One repair, SAME snapshot; failure keeps memory and empty orders (continuation/expiry). intent <=${PROTOCOL_LIMITS.intentCharacters} characters.`;
}
