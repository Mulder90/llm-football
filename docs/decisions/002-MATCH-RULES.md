# 002 — A complete match clock and physical football incidents

Status: accepted under the user's instruction to implement the complete match autonomously in reviewable slices. Builds on 001; engine `football-0.2`, recording format 2.

## Decision

The match has discriminated phases: open play, restart setup, restart ready, halftime and full time. Each half has exactly 10,800 playing ticks at 60 Hz. Restart setup takes 120 simulation ticks and halftime 180; neither consumes playing time. The selected taker must deliver within 360 simulation ticks after setup. A missing delivery marks the match abandoned, without inventing an action. Half boundaries resolve after that tick's physical incident: a crossing on the last tick counts; a ball still in flight at full time cannot score later.

Both teams see the same boundary. Kicks execute before tackle attempts, then players move, bodies separate, and the ball advances. Swept ball incidents compete by time of contact: earliest wins. Exact ties prefer frame, then players, then boundary; exact player ties use seeded randomness in stable ID order. Goal-line planes precede touchlines at an exact corner. Only one ball incident is resolved per tick; the unused fraction is discarded. This is a declared fixed-step approximation, not a high-precision rigid-body solver.

The ball has height and vertical velocity. Ground friction, gravity and damped bounces are explicit constants. Ground first touches are automatic within 0.9 m below 0.65 m at up to 18 m/s. Faster or higher balls can rebound from player bodies. An explicit keeper `guard` order moves to a fixed target with 1.6 m catching reach and 2.4 m height while the keeper is inside its own penalty area. It does not predict or chase a shot. Contact control itself is mechanical assistance, applied equally to both teams.

A `tackle` targets a named opposing carrier. It must physically reach both player and ball, has a recovery period, and cannot chase automatically. Player circles receive symmetric separation in two stable solver passes. Dense crowds may retain small overlaps; contact does not provide tactical avoidance.

Restart setup cancels old orders. Models may choose a taker and move players, after which the referee projects positions into legal setup areas. The default taker is the nearest teammate, or the keeper for a goal kick. Kickoff resets the formation; second-half formation swaps ends while IDs stay fixed. Setup positioning is a visible referee reset, not football AI. Delivery requires a valid kick from the selected taker. The whole ball must cross a boundary; direct throw-in goals and direct own goals from restarts are disallowed. Another touch clears the direct-restart restriction. An illegal second touch awards a free kick.

## Scope and sources

This is an explicitly simplified football game. It does **not yet enforce fouls, cards, penalties, offside, advantage, heading, goalkeeper back-pass rules or an eight-second possession limit**. The second-touch free kick is provisionally direct; indirect restart semantics follow with the referee slice. No claim of complete IFAB compliance is made. A penalty extension to half duration is not implemented yet.

Boundary and restart decisions were checked against IFAB's [ball in/out of play](https://www.theifab.com/laws/latest/the-ball-in-and-out-of-play/), [goal determination](https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/), [kickoff](https://www.theifab.com/laws/latest/the-start-and-restart-of-play/), [throw-in](https://www.theifab.com/laws/latest/the-throw-in/), [goal kick](https://www.theifab.com/laws/latest/the-goal-kick/), and [corner](https://www.theifab.com/laws/latest/the-corner-kick/) laws. Our compressed playing clock and bounded setup are game-design choices.

## Recording and presentation

Samples include height, keeper stance, action animation ticks and discriminated phase data. Capture every third tick and on an event or phase change. Do not interpolate across phase resets or ownership changes. Replay remains independent of models and wall time. Its range control uses integer ticks because a fractional seconds step can make the exact duration unreachable in the browser.

The full development fixture uses a public-order scripted controller outside `src/sim`. Its keeper angle selection, pressing and passes are explicit fixture tactics. A high score or lack of saves is evidence of weak baseline play, not a reason to alter engine results. Rule-specific save and rebound tests establish those mechanics independently. The later LLM controllers must receive the exact execution contract above.
