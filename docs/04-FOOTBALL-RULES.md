# Football mechanics and referee

The current ruleset is `football-0.8`. It fixes keeper catch placement and preserves the actual kick launch point while retaining hand possession, handling laws and two 30-second development halves. It provides recognisable football with explicit simplifications, not complete compliance with the official Laws. [Decision 002](decisions/002-MATCH-RULES.md) records the physical/restart foundation; [decision 004](decisions/004-CONTACT-REFEREE.md) records contact officiating, offside and primary rule references; [decision 006](decisions/006-TACTICAL-MEMORY.md) records the current duration and tactical-memory change.

## Match and phases

Eleven stable players per team, including one keeper. One model chooses each team's orders. Development matches have two halves of 30 playing seconds; draws stand. Both teams switch ends at halftime. Simulation ticks include a two-second restart setup, up to six seconds for delivery, and a three-second halftime interval. These periods pause the playing clock.

Phases are explicit variants: `open_play`, `restart_setup`, `restart_ready`, `halftime` and `full_time`. The engine owns transitions. Referee position, cards, whistles and goal effects only display recorded state/events. The fixed half clock ends after the final tick's incidents; it does not extend for an awarded or in-flight penalty.

## Actions and assistance

- `move`: accelerate and brake toward one chosen point at the chosen pace. No automatic pursuit, marking or supporting runs.
- `hold`: decelerate to rest.
- `kick` / `shoot`: one immediate attempt from foot possession, using the chosen direction, speed and loft. Neither guarantees a pass or goal, and neither waits for future possession.
- `guard`: keeper-only movement toward a chosen point, with legal automatic catch reach of 1.6 m up to 2.4 m high. Handling eligibility is checked at the swept ball-contact point. Ineligible catches retain ordinary foot/body contacts. No automatic shot prediction or position selection.
- `pickup`: one keeper-only open-play attempt to lift an already owned foot ball.
- `distribute`: immediate hand release using the chosen `delivery`, target, speed and loft. `put_down` instead retains foot ownership for a later kick or move.
- `tackle`: one immediate attempt at the named opposing carrier; no approach movement is added.
- `restart_taker`: select an eligible taker during the awarded team's setup opportunity.

Movement/guarding lasts up to three seconds unless replaced or cleared. Omitted orders continue until expiry. Ground first-touch control and symmetric body separation are mechanical assistance shared by both sides. Faster/higher ball contacts can rebound. Kicks commit before tackles; the earliest swept frame/player/boundary incident owns a ball-contact tick. Exact ties have declared priorities and explicit seeded selection.

Structured tactical memory changes what a controller carries between decisions, not these action semantics. A remembered marking job, pass or spacing preference has no physical effect until the model issues the corresponding current orders. There is no automatic spreading of crowded teammates.

## Ball and scoring

Open-play kicks and shots launch from the actual ball XY. Choosing a new direction changes velocity/facing without rotating the ball around the player. This avoids parallel shifts of the intended path, especially near goal. Restart delivery still starts from its explicit restart point.

The ball has three-dimensional position/velocity, radius, owner, optional hand control, separate handling histories, last touch, recapture cooldown and restart-touch marker. A whole-ball crossing between the posts and beneath the crossbar scores, followed by a kickoff for the conceding team. The goal frame can rebound a shot. The engine does not continue a pending shot after full time.

A touchline crossing awards a throw to the opponent of the last toucher. A goal-line miss after a defender touch awards a corner; after an attacker touch, a goal kick. Direct throw-in/indirect-kick goals are disallowed, as are direct own goals from a restart. A taker's second touch before another player yields an indirect free kick.

## Keeper handling

Hand possession persists through move/hold/guard changes, omitted orders and order expiry. Ordinary kick/shoot fails from hands. Pickup already in hands fails without resetting the timer. Legal hand possession ends only through explicit release, restart or a half/match ending. Keepers do not automatically find an outlet.

| Delivery | Horizontal speed | Upward speed (`loft`) | Release               |
| -------- | ---------------- | --------------------- | --------------------- |
| Roll     | 2–12 m/s         | 0                     | Ground                |
| Throw    | 2–18 m/s         | 0–6 m/s               | 1.2 m high            |
| Punt     | 2–30 m/s         | 0–8 m/s               | 1.2 m high            |
| Put down | No parameters    | No parameters         | Retain foot ownership |

A target determines direction; the engine does not choose a recipient or ensure reception. Releases start at the actual held-ball x/y, preventing an aiming turn from teleporting the ball over a line. Roll/throw directly into the opposing goal awards a goal kick; direct own goals stand. Punts use normal kick scoring rules. Another player contact or subsequent foot play ends the direct-throw marker. The normal 18-tick recapture delay also applies to distributions.

Handling uses the **ball centre**, including the penalty-area line, rather than the keeper's centre. This is a deliberate point approximation: ball-radius overlap and hand/body geometry do not decide the handling line. Catch/pickup preserves the legal contact x/y and raises the ball to 1.2 m. A held ball then translates by the keeper's actual per-tick displacement, including body separation; changing facing cannot reposition it. Catching discards the remaining sub-tick time, as other contacts do. Each later held movement checks the resulting ball centre. A stationary exact-line catch remains exact because its displacement is zero. Put-down returns to the existing facing-based foot anchor; the model must leave room for the 0.65 m dribbling offset. Carrying outside immediately awards a direct free kick at the bounded incident position, with possible fixed-tick overshoot; no movement clamp chooses to stop the keeper. Illegal pickup inside awards an indirect free kick. An attempt without ownership fails rather than causing an imaginary touch.

Restrictions have separate reset rules:

- Every executed teammate kick/shoot/punt counts as a deliberate teammate kick, regardless of target or model prose. Opponent controlled play clears it; deflections preserve it. A keeper can control such a ball with feet, then kick it normally.
- A direct teammate throw-in stays restricted through the keeper's own foot control; a different player touching ends this restriction.
- After hand release, the same keeper cannot handle again until **any other player** touches, even after the keeper's own foot kick. An opponent deflection clears rehandling but does not clear a teammate-kick restriction.
- Existing restart second-touch and offside rules remain separate. Guarding saves preserve an opponent's offside snapshot.

A reachable tackle of hand possession awards the keeper's team an indirect free kick at the keeper position and never steals the held ball. This protection covers explicit tackle attempts; ordinary body separation still applies and no new body-contact foul model is added.

Control starts at the collection tick's playing-time boundary. Each 60 Hz playing interval counts once, including the collection interval. At 480 elapsed ticks the keeper may still release; without release the next interval exceeds eight seconds and awards opponents the nearest corner on the defended end. Exact centre ties use the bottom touchline. The referee displays the final-five countdown from recorded playing ticks. Movement/guard expiry and provider latency cannot reset or advance it. Holding never stops the playing clock. Release attempts precede tackles/movement/timer checks; incidents precede half endings, so a last-tick sanction may be recorded before the half ends without delivering that restart.

These rules follow the relevant [IFAB Law 12](https://theifab.com/laws/latest/fouls-and-misconduct/), [Law 17](https://www.theifab.com/laws/latest/the-corner-kick/) and [Law 10](https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/) with explicit simplifications. Deliberate tricks, failed-clearance exceptions, bouncing-in-hand poses, general outfield handball and broader handball cards are omitted. [Decision 011](decisions/011-GOALKEEPER-HAND-POSSESSION.md) records the accepted contract.

## Restart procedure

1. Store the incident, stop open play, clear old orders and award the restart.
2. Both teams choose setup positions; the awarded team may choose a taker.
3. At ready, project players to legal positions, put the ball at the taker's foot and clear setup orders.
4. Both teams lock their delivery/defensive responses against the same observation. Only the selected taker can deliver.
5. A physically valid kick resumes play. A missing delivery at the deadline abandons the game, preserving its incomplete status.

Opponents remain 9.15 m away, or 2 m at a throw. Kickoffs use the initial formation and enforce own halves. Goal-kick opponents start outside the penalty area. Throws have an elevated release and speed cap. Penalties use the 11 m spot; the keeper starts between the posts on the goal line, and everyone else is behind/outside the area and 9.15 m away. A backward penalty yields an indirect free kick. Placements are projections during stopped play, not hidden tactics.

## Fouls and cards

A straight tackle reach through the carrier before the ball is careless. Closing speed of at least 5 m/s is reckless and cautioned; at least 10 m/s is excessive and dismissed. These are declared game heuristics, not thresholds in the official Laws. A foul awards a direct free kick at the victim's position, or a penalty when that point is inside/on the offender's own penalty-area boundary. No advantage is played.

For reachable opposing foot carriers, observations expose `tackleFoul` from this same exact calculation. Closing speed is the relative velocity projected along tackler-to-carrier, not either player's speed alone. A head-on 6.3 + 6.3 m/s challenge is excessive even if ball-first; equal velocities are not closing. The models may brake or contain, but the engine does not change an order to avoid a card. [Decision 013](decisions/013-CATCH-PLACEMENT-AND-GOAL-AWARENESS.md) records the review.

A second caution dismisses. Dismissed players keep their IDs but cannot be ordered or interact with play. Fewer than seven active players abandons the match without a fabricated forfeit score. A dismissed keeper is not automatically replaced.

## Offside

At a teammate touch, store players in the opponent half whose centres are beyond both the ball and second-last active defender, with a 1 cm tolerance. Being in this position alone is not an offence. A stored candidate is penalized on touching the ball or completing a tackle, even after returning onside.

Direct throws, corners and goal kicks are exempt. An opponent's controlled reception or deliberate kick replaces the snapshot; a body deflection or guarding save preserves it. Offside awards an indirect free kick at involvement. The stored IDs and touch tick are part of deterministic state, not a renderer flag.

## Current omissions

No advantage, substitutions, general outfield handball, heading, penalty extension or encroachment retakes. Keeper handling includes only the cases above. Offside screening/obstruction without a touch or completed tackle is omitted. Free kicks use incident positions without special goal-area relocation. Cards only judge the specified tackle contact model; they do not cover denial of scoring opportunities, dissent or repeated ordinary offences. Automatic contacts use fixed-tick geometry without a separate sub-tick reconstruction of all player bodies.

Focused tests cover physical boundaries, delivery restrictions, stale orders, half endings, severity thresholds, dismissal, minimum team size and offside incident sequences. Scripted fixtures are explicitly labelled and never substituted for model decisions.
