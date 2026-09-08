# 011 — Goalkeeper hand possession

## Context and decision

The keeper slice was approved after the build-plan review. A successful `guard` previously became ordinary foot possession, so a later order could erase the meaning of a catch. In `football-0.6`, the ball stores hand control independently of a player's active order: collection simulation tick, collection playing tick, pickup/catch kind and original contact height. Movement, hold, omitted orders and expiry do not release the ball or restart the timer.

Keepers explicitly choose `pickup`, `put_down`, or `distribute` with a roll, throw or punt and bounded direction, speed and loft. A normal kick requires feet. Guard can catch only a physically reachable, legally eligible ball; otherwise it uses ordinary foot/body contact. No helper chooses an outlet, corrects aim or chases for a keeper. Scripted fixture outlets remain explicitly scripted.

The principal alternative was inferring hands from the current guard order. That cannot preserve ownership through a move or distinguish a put-down from a catch during replay. A separate possession field establishes those boundaries without a general action-state framework or new dependencies.

## Rules and timing

The eight-second rule uses 480 playing intervals at 60 Hz. The collection interval counts once. Instant releases execute before the next interval; a release at elapsed tick 480 is legal. If the keeper still holds during interval 481, the referee awards the opponent a corner at the nearest corner of the defended goal. Equal distance selects the bottom touchline. The final-five countdown derives from remaining playing ticks, so presentation speed and seeking cannot change a sanction.

Inside-area back-pass, direct teammate throw-in and rehandling violations award an indirect free kick; carrying outside the own penalty area awards a direct free kick. Explicit reachable challenges of protected hands award the keeper's team an indirect free kick. A hand distribution directly into the opponent's goal produces a goal kick; a direct own goal stands. Existing offside and restart handling remain engine-owned.

Touch history is separate from `lastTouch`: deliberate kick, direct teammate throw-in, last hand release and direct hand distribution have different reset conditions. Any other-player touch clears rehandling, but an opponent deflection does not erase a teammate-kick restriction; opposing controlled play does. The keeper's own foot touch cannot erase a direct throw-in restriction.

## Consequences and deliberate approximations

- Penalty-area eligibility uses the **ball centre**, with the line included. A held movement violation is detected at the completed 1/60-second position, so the free-kick spot can be slightly beyond the line. No swept whole-ball handball geometry is claimed.
- Executed kick, shoot and punt orders count as deliberate kicks regardless of their prose or intended recipient. The engine does not infer intent, model headers, or implement the attempted-clearance exception and deliberate-trick cautions.
- Guard catches within the declared existing reach, height and control-speed limits. There is no automatic illegal catch or hidden save guarantee. Passive body separation continues; this slice adds protection against explicit tackles, not a new collision-foul system.
- A restart, halftime or full time clears hand control and its histories. An overdue hold in the final playing interval is recorded before the half-ending event; the half ending supersedes the awarded restart.
- `football-0.6` replaces the development ruleset. Recording format remains version 2, but engine-version checks reject older files. Incompatible public LLM fixtures are removed instead of adding compatibility. The new demo is labelled scripted.
- Held state is captured in replay frames. Same-owner pickup and put-down are discrete boundaries. The renderer may interpolate the scoop after a recorded collection, but never changes canonical state or invents a catch.
- Shared JSON-schema shapes keep requests within the existing 32 KiB allowance. Strict runtime and recording validation enforce delivery-specific limits, identities and hand-state consistency.

## Evidence and revisit condition

[Slice 18](../slices/18-GOALKEEPER-POSSESSION.md) records the replay, numeric boundary, import, request-size, audio and browser checks. [Football rules](../04-FOOTBALL-RULES.md#keeper-handling) contains the implemented laws and source links.

Revisit a documented approximation when a repeatable current-ruleset match demonstrates that it affects play enough to justify a separately approved mechanics slice. Sustained keeper decisions and paid evaluation are subsequent work; this decision does not authorize new model spending or deployment.
