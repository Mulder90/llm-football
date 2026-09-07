# Slice 4 — The deterministic referee

## Result

`football-0.3` implements tackle fouls, penalties, cautions, second-yellow/straight-red dismissal, minimum-roster abandonment, touch-snapshot offside and indirect free kicks. Models see discipline and offside state and receive the complete rulebook. The viewer adds a referee sprite, raised cards, caution markers and incident banners/whistles. Decisions and outcomes remain separate.

## Invariant and mechanism

An incident cannot keep moving the ball after the referee has stopped play. The tick executes kicks, evaluates tackles, then checks the resulting phase before movement and ball integration. A foul clears both teams' orders and awards the restart at the stored incident location. The tick advances once; setup pauses the playing clock. A dismissal that abandons a match cannot be overwritten by a simultaneous full-time clock boundary.

Offside stores candidate IDs at a teammate touch, then tests later involvement. Returning onside does not erase the stored position; an opponent's deliberate control does. Reimplement this with a signed x comparison against the ball, second-last defender and halfway line, plus a stored set of candidate IDs. The 1 cm tolerance needs a small floating-point allowance to give identical classifications after mirroring the pitch.

## Checks and evidence

Strict TypeScript, the production build, Prettier and whitespace checks pass. Browser checks load the compressed 0.3 recording and verify the yellow-card banner, raised referee card and player caution marker at fixture tick 241. The production JavaScript is 112 KiB gzipped. Production assets and the published record contain no local provider credential.

59 tests pass, including 18 new referee cases. These cover severity thresholds, inside/on/outside penalty-area boundaries, second-yellow dismissal and rejected orders, excluded contacts, below-seven abandonment, the fixed-clock penalty cutoff, symmetric penalty placement and backward delivery, indirect goal rejection, offside return runs, level/behind-ball/own-half positions in both directions, exempt restarts, save/deflection retention and controlled-play resets.

The passing fixture retains exactly nine kicks, eight receptions and one interception; the reviewed hash changes to `65a85ffc` because the engine version and referee state are now recorded. The full scripted fixture completes both halves and replays to `5830f96d`; its 22–4 result includes 13 fouls, 11 yellows, six dismissals and two saves. These are diagnostic fixture outcomes, not desired results or LLM footage.

The bounded real run `referee-possession-001` records 6.9 playing seconds, 12 paired boundaries, 26 requests and estimated usage of $0.0274898. One initial Cyan setup used an invalid guard pace field, then removed required move pace fields during repair; its explicit fallback is retained. A later malformed guard was repaired successfully. The exact action field shapes were added to the shared rulebook for subsequent runs. Final replay hash: `feaa27d2`. This remains an incomplete excerpt.

## Limitations and next slice

The precise custom rules and official-rule deviations are in [decision 004](../decisions/004-CONTACT-REFEREE.md). In particular, offside screening is omitted, cards use a simple speed/contact model, there is no advantage and penalties do not extend the fixed half clock. The rules are not a complete IFAB implementation. Historical 0.2 imports require their matching viewer/engine revision.

Next: generate a complete, honest two-half model match, publish its verified recording, finish visual/audio acceptance and push the result on main. The active goal is still incomplete until that real match is available to watch.
