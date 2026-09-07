# 004 — A compact deterministic referee

The user's approved complete-match goal includes recognisable football and understandable code. The ruleset is now `football-0.3`. This is a deliberately simplified game, not a claim of complete IFAB compliance.

## Contact and discipline

A tackle remains a single instantaneous attempt at an opposing carrier within 1.8 m, with no approach assistance. A straight reach that passes through the carrier's 0.4 m body radius before reaching the ball is careless. Relative velocity projected toward the carrier determines closing speed: at least 5 m/s is reckless and cautioned, at least 10 m/s is excessive and dismissed, even if the ball is reachable. Otherwise a ball within 1.25 m can be won cleanly. The thresholds are our tuning, not numbers prescribed by the Laws.

Competing attempts use severity first, then distance; exact ties use the explicit seed. Kicks resolve first. A foul stops subsequent movement and ball integration for that tick, clears orders, and awards a direct free kick at the victim's position. The penalty area includes its boundary; an incident inside the offender's own area awards a penalty instead. The incident consumes one playing tick. No advantage is applied.

Two cautions dismiss a player. Dismissed players retain their stable IDs and recording entries, but cannot receive orders, move, collide, touch the ball, take restarts or affect the offside line. Fewer than seven active players abandons the match without inventing a forfeit score. A dismissed keeper is not automatically replaced; remaining players have ordinary foot control, and a goal kick falls back to the first eligible player if no keeper remains.

## Penalties and indirect kicks

The penalty is delivered from 11 m. The defending keeper's chosen lateral position is constrained between the posts on the goal line. Other players are projected behind the penalty-area edge, outside the area and at least 9.15 m from the spot. This stronger placement restriction is simple and symmetric. Delivery must travel forward; backward delivery yields an indirect free kick. Restart setup/deadline mechanics remain unchanged.

Offside and consecutive restart-taker touches now award **indirect** free kicks. A direct goal from an indirect kick yields a goal kick, or a corner if it enters the taker's own goal. Another player's touch removes the direct-goal restriction.

The existing fixed clock remains explicit: each half ends after its 10,800th playing tick's incidents. A new penalty award or an in-flight penalty does not extend the half. This differs from official penalty extension. No encroachment retakes, goalkeeper replacement action, handball, heading, back-pass/holding limits, denial-of-scoring-opportunity cards or accumulated ordinary fouls are implemented. Free kicks use the incident point without special goal-area relocation.

## Offside mechanism

At a teammate touch, express all x coordinates in that team's attack direction. Find the maximum of ball position, second-last active defender and halfway line. Teammates farther forward than this line plus 1 cm become candidates. Player centres stand in for playable body parts. The comparison includes a 1e-9 m numerical allowance so mirrored positions at the tolerance boundary classify alike.

Store candidate IDs and touch tick; do not recompute merely because a candidate runs back onside. Penalize only when a candidate touches the ball or completes a tackle. An opponent's body deflection or guarding save preserves the snapshot. Controlled reception is our explicit approximation of deliberate play and creates a new snapshot for that team. A deliberate kick also replaces it. Direct throw-ins, corners and goal kicks are exempt, and any restart award clears candidates.

This omits screening, obstructing and challenging without a completed tackle. Automatic contacts snapshot the current fixed-tick geometry, without a separate sub-tick body-position reconstruction. The first incident in a tick still owns the result. All state is cloned and recorded; the renderer does not participate in these decisions.

## Presentation and compatibility

A neutral referee sprite follows the recorded ball for readability and raises a card for recorded sanctions. Card/offside/foul/penalty banners and whistles are presentation only. Dismissed players disappear from the pitch; cautioned players carry a small yellow marker.

The early viewer/import contract remains current-engine only. The old 0.2 excerpt is preserved in git history and private generation artifacts; the viewer catalogue moves to a verified 0.3 excerpt. Old records are rejected explicitly, not silently migrated or re-simulated with changed rules.

## Primary rule references

Checked 7 September 2026: [IFAB Law 11](https://www.theifab.com/laws/latest/offside/) for touch-based involvement, deliberate play/save distinctions and restart exemptions; [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/) for careless/reckless/excessive challenges and disciplinary categories; [Law 14](https://www.theifab.com/laws/latest/the-penalty-kick/) for penalty placement and procedure; [2026/27 changes](https://www.theifab.com/law-changes/latest/) for minimum team size. These support the football concepts, not our chosen numeric contact heuristic or declared deviations.
