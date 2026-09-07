# Football mechanics and referee

This is a proposed game ruleset, not a claim of complete compliance with official football laws. Implement recognisable football with explicit simplifications. Verify any rule presented as official against current authoritative sources during implementation.

## State machine

Proposed phases: kickoff setup, open play, stoppage, restart setup, restart ready, halftime, full time. Restart data identifies type, awarded team, location, eligible taker, restrictions and setup budget. Prefer variants over independent flags that permit contradictory states.

The engine decides phase changes. The referee sprite, whistle, flag and cards display that decision. No referee LLM is needed. Referee animation position must not affect decisions.

## Ball and boundaries

- Track ball radius, last-touch player/team, and whether the ball has fully crossed a boundary.
- A valid crossing of the goal plane between posts and below the crossbar yields a goal, then kickoff for the conceding team.
- Crossing a touchline yields a throw-in to the opponent of the last-touch team.
- Crossing a goal line outside the goal after a defending-team touch yields a corner; after an attacking-team touch, a goal kick.
- Posts may rebound the ball into play. Continuous crossing/contact checks should prevent a fast ball tunnelling through the frame or skipping a boundary.
- Define stable precedence for near-simultaneous contact, boundary crossing, foul and half-ending events. Emit one authoritative result per incident.

## Tackles and fouls

A model orders an attempt; the engine evaluates it. It cannot order guaranteed dispossession or declare its own foul.

Proposed ingredients: contact with player versus ball, relative speed, approach angle, tackle phase and opponent possession. Thresholds belong in ruleset configuration and need boundary tests. Do not claim that a single contact heuristic represents the full real-world law.

Start with a small foul model and no advantage. A qualifying defender foul inside its own penalty area yields a penalty; elsewhere, a free kick under our ruleset. Use incident location, not the ball's later resting position.

Later add severity-based yellow/red cards, second-yellow handling and dismissal. Orders to dismissed players fail explicitly. Define abandonment/minimum-roster rules before enabling enough dismissals to create invalid teams.

## Restart lifecycle

1. Detect incident; emit stable event ID, tick, cause and result.
2. Stop open-play interaction; cancel phase-incompatible orders.
3. Award the restart and place the ball at its defined location.
4. Give both controllers a bounded setup opportunity for positioning and taker selection.
5. Enforce placement and distance restrictions symmetrically. Specify whether repositioning is simulated or a presentation transition to valid setup positions.
6. Publish the resulting visible setup. Collect delivery and defensive responses simultaneously.
7. Resume open play on the legal restart trigger.

The defender never sees a pending kick trajectory before locking its response. Setup cannot wait indefinitely for a model to find an arrangement. Old tackles or shots cannot leak across the phase transition.

## Corners

The attacker chooses taker, runs and short-pass/cross delivery. The defender positions its players and goalkeeper. The engine does not secretly invent marking assignments or attacking runs.

Example phase fields: restartType=corner, awardedTeam=coral, location=[105,0], setupRoundsRemaining=1. Include normal public world state and legal actions. Aerial crosses require ball height; top-down rendering uses a ground shadow and a height cue.

## Offside

Treat offside as a dedicated later milestone. It requires a snapshot at the relevant attacking touch and subsequent involvement logic, with exclusions for specified restarts. It is not just a flag from current player x coordinates. Verify official details, document simplifications and test incident sequences. Before enabled, label the ruleset as not enforcing offside.

## Clock and completion

180 seconds of playing time per half; attack directions swapped at halftime; kickoff assignment specified in configuration; draws permitted. Proposed default pauses playing time during restart setup. Simulation tick remains separate and monotonic.

Specify what happens at a half boundary during an in-flight shot or an awarded penalty. No pending action may create goals after full time. Restart delays, halftime presentation and knockout extensions remain proposed decisions.

## Fixtures

Test each boundary/last-touch combination; ball on versus fully over line; goal versus over-bar shot; post rebound; tackle win versus foul; penalty-area inside/outside incident; corner setup restrictions; stale pre-stoppage order; incident precedence; half ending; attack-direction swap; offside involvement; second yellow and dismissed-player orders.
