# Football mechanics and referee

The current ruleset is `football-0.5`. It keeps the existing physics and referee behaviour and changes development matches to 30-second halves. It provides recognisable football with explicit simplifications, not complete compliance with the official Laws. [Decision 002](decisions/002-MATCH-RULES.md) records the physical/restart foundation; [decision 004](decisions/004-CONTACT-REFEREE.md) records contact officiating, offside and primary rule references; [decision 006](decisions/006-TACTICAL-MEMORY.md) records the current duration and tactical-memory change.

## Match and phases

Eleven stable players per team, including one keeper. One model chooses each team's orders. Development matches have two halves of 30 playing seconds; draws stand. Both teams switch ends at halftime. Simulation ticks include a two-second restart setup, up to six seconds for delivery, and a three-second halftime interval. These periods pause the playing clock.

Phases are explicit variants: `open_play`, `restart_setup`, `restart_ready`, `halftime` and `full_time`. The engine owns transitions. Referee position, cards, whistles and goal effects only display recorded state/events. The fixed half clock ends after the final tick's incidents; it does not extend for an awarded or in-flight penalty.

## Actions and assistance

- `move`: accelerate and brake toward one chosen point at the chosen pace. No automatic pursuit, marking or supporting runs.
- `hold`: decelerate to rest.
- `kick` / `shoot`: one immediate attempt from possession, using the chosen direction, speed and loft. Neither guarantees a pass or goal, and neither waits for future possession.
- `guard`: keeper-only movement toward a chosen point, with extended automatic catching reach inside its own penalty area. No automatic shot prediction or position selection.
- `tackle`: one immediate attempt at the named opposing carrier; no approach movement is added.
- `restart_taker`: select an eligible taker during the awarded team's setup opportunity.

Movement/guarding lasts up to three seconds unless replaced or cleared. Omitted orders continue until expiry. Ground first-touch control and symmetric body separation are mechanical assistance shared by both sides. Faster/higher ball contacts can rebound. Kicks commit before tackles; the earliest swept frame/player/boundary incident owns a ball-contact tick. Exact ties have declared priorities and explicit seeded selection.

Structured tactical memory changes what a controller carries between decisions, not these action semantics. A remembered marking job, pass or spacing preference has no physical effect until the model issues the corresponding current orders. There is no automatic spreading of crowded teammates.

## Ball and scoring

The ball has three-dimensional position/velocity, radius, owner, last touch, recapture cooldown and restart-touch marker. A whole-ball crossing between the posts and beneath the crossbar scores, followed by a kickoff for the conceding team. The goal frame can rebound a shot. The engine does not continue a pending shot after full time.

A touchline crossing awards a throw to the opponent of the last toucher. A goal-line miss after a defender touch awards a corner; after an attacker touch, a goal kick. Direct throw-in/indirect-kick goals are disallowed, as are direct own goals from a restart. A taker's second touch before another player yields an indirect free kick.

## Restart procedure

1. Store the incident, stop open play, clear old orders and award the restart.
2. Both teams choose setup positions; the awarded team may choose a taker.
3. At ready, project players to legal positions, put the ball at the taker's foot and clear setup orders.
4. Both teams lock their delivery/defensive responses against the same observation. Only the selected taker can deliver.
5. A physically valid kick resumes play. A missing delivery at the deadline abandons the game, preserving its incomplete status.

Opponents remain 9.15 m away, or 2 m at a throw. Kickoffs use the initial formation and enforce own halves. Goal-kick opponents start outside the penalty area. Throws have an elevated release and speed cap. Penalties use the 11 m spot; the keeper starts between the posts on the goal line, and everyone else is behind/outside the area and 9.15 m away. A backward penalty yields an indirect free kick. Placements are projections during stopped play, not hidden tactics.

## Fouls and cards

A straight tackle reach through the carrier before the ball is careless. Closing speed of at least 5 m/s is reckless and cautioned; at least 10 m/s is excessive and dismissed. These are declared game heuristics, not thresholds in the official Laws. A foul awards a direct free kick at the victim's position, or a penalty when that point is inside/on the offender's own penalty-area boundary. No advantage is played.

A second caution dismisses. Dismissed players keep their IDs but cannot be ordered or interact with play. Fewer than seven active players abandons the match without a fabricated forfeit score. A dismissed keeper is not automatically replaced.

## Offside

At a teammate touch, store players in the opponent half whose centres are beyond both the ball and second-last active defender, with a 1 cm tolerance. Being in this position alone is not an offence. A stored candidate is penalized on touching the ball or completing a tackle, even after returning onside.

Direct throws, corners and goal kicks are exempt. An opponent's controlled reception or deliberate kick replaces the snapshot; a body deflection or guarding save preserves it. Offside awards an indirect free kick at involvement. The stored IDs and touch tick are part of deterministic state, not a renderer flag.

## Current omissions

No advantage, substitutions, handball, heading, keeper back-pass/holding limit, penalty extension or encroachment retakes. Offside screening/obstruction without a touch or completed tackle is omitted. Free kicks use incident positions without special goal-area relocation. Cards only judge the specified tackle contact model; they do not cover denial of scoring opportunities, dissent or repeated ordinary offences. Automatic contacts use fixed-tick geometry without a separate sub-tick reconstruction of all player bodies.

Focused tests cover physical boundaries, delivery restrictions, stale orders, half endings, severity thresholds, dismissal, minimum team size and offside incident sequences. Scripted fixtures are explicitly labelled and never substituted for model decisions.
