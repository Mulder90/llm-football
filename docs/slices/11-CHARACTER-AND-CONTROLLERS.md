# Slice 11 — Character and better football decisions

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

The user approved controller labels, robot personality, anticipation, a camera experiment and a CR7-inspired celebration. They then chose Whole pitch on by default, requested moving flags, and lowered the available generation budget.

## Broadcast

Controller model IDs appear beneath each team name. Scripted practice is explicitly labelled Scripted. The default camera preserves the whole pitch; switch Whole pitch off in Viewing options to try gentle action following and goal framing. Reduced motion selects the static view automatically.

Robots have consistent antenna/helmet details and small gait differences. Recorded receivers can raise an arm; completed first touches, failed actions and conceded goals produce short reactions. The scorer plants, jumps and turns, lands with wide arms, then holds that pose while teammates respond from a semicircle behind. The six-second celebration duration and all canonical match outcomes remain unchanged.

Corner flag cloth now draws in the animated environment over fixed cached poles. The larger stand flags have a clearer free-edge ripple. Wind uses replay time; pause freezes it and reduced motion uses a fixed pose. Restoring a cloth-free stadium painting before every frame prevents old flag silhouettes from accumulating.

The camera is a pure function of replay state. It blends current and recent ball positions, adds a small lead, and clamps the resulting frame. The goal window eases toward the net/scorer and back. This makes pause, seeking and playback speed reproducible without mutable camera smoothing. It also keeps the pitch flat and top-down.

## Controller comparison

`pnpm evaluate-controllers` compares actual engine outcomes on four fixed situations: open carrying space, immediate pass pressure, a screened passing lane and keeper distribution after two real scripted interceptions. Two repetitions per configuration give eight cases each. The exact inputs, replies, request receipts and scenario states are preserved privately in `artifacts/private/controller-comparison-002/report.json`.

| Configuration                      | Own possession after 2 s | Completed receptions | Turnovers | Median request latency |
| ---------------------------------- | -----------------------: | -------------------: | --------: | ---------------------: |
| GPT-5 nano, low                    |                      1/8 |                    0 |         5 |                12.82 s |
| GPT-5 mini, low                    |                      6/8 |                    4 |         1 |                13.86 s |
| Gemini 3.1 Flash-Lite, minimal/0.4 |                      0/8 |                    0 |         4 |                 4.26 s |
| Gemini 3.8 Flash, LOW/1            |                      6/8 |                    4 |         0 |                 6.85 s |

Mini and Flash 3.8 carried successfully in both open-space cases, about 10.1 and 11.0 metres respectively. Every final reply validated and ordered all eleven teammates. Flash 3.8 had one timeout/retry. The comparison cost estimate is $0.2705; it includes the full reservation for that unreported timeout and uses conservative undiscounted Flash rates. [Provider details and sources](../07-PROVIDERS.md).

Two seconds is a measurement cutoff, not a verdict that a still-loose pass failed. Unchanged diagnostic execution of Flash's keeper decisions reaches its receivers at 2.05 and 2.70 seconds. No model chose a useful chip in these cases; ground routes were also viable. A small set of scripted situations supports trying a stronger pair, but does not establish sustained match quality or isolate temperature from model capability.

The first private comparison was stopped and superseded because it told models the next decision was in one second while measuring two seconds without another decision. The corrected run states the actual two-second horizon, with a regression assertion. The superseded run's conservative estimate was $0.2158; both comparison runs total $0.4863. Its outcomes are not pooled into the table above.

## Fresh match and budget

A fresh 30-second-half match, `character-match-001`, was started with GPT-5 mini and Gemini 3.8 Flash. The initial runner estimate ceiling was $4. After the user clarified the available balance, a private process guard lowered the practical ceiling to $2 shared across providers. It stops early enough to reserve both a threshold-crossing boundary and the already-dispatched pair, including repair allowance. Saved metadata retains the runner's original settings; the guard record documents the later user constraint. An incomplete run remains explicitly unfinished, and no additional run is started automatically.

The user then explicitly stopped the run. Both the runner and guard exited cleanly. Final result: 25.95 playing seconds, 31.9167 recording/watch seconds, 0–0, 51 committed paired decisions, 108 requests and replay hash `36dbd671`. Generation took 13m 22.8s. Four rejected Flash memory plans were repaired; there were no committed fallback batches. The last two cancelled requests are conservatively charged their full reservations. The final estimate is $1.3133: OpenAI $0.2365 and Google $1.0768, using the undiscounted Google rates described above. Including both comparison runs, the total conservative estimate for this slice is $1.7996; these figures are not a provider balance or invoice.

The validated, independently replayed preview is published to the local catalogue as **Finding their feet**, explicitly unfinished. Its gzip file is 802,039 bytes; the original JSON is 6,843,561 bytes. The previous complete recording remains the viewer default. No further generation is running or scheduled.

Against the first 25.95 playing seconds of the earlier recording, this prefix contains 25.44 metres of controlled carrying versus 1.69, and 9/16 kicks reaching a teammate versus 4/13 (including restarts). Eight new passes reach the declared receiver. Cyan completes keeper → #2 → #6 → #8 and three consecutive carrying decisions. The sole shot is saved. Coral has an outfield pair within two metres for 3.54% of open-play ticks versus 29.43% earlier. These are observed differences between different match sequences, prompts and configurations, not a controlled causal comparison.

## Verification

Strict TypeScript, all 116 tests, Prettier and the production build pass. Focused checks cover shared evaluation snapshots, honest decision horizons, complete budget reservation, private repairs, unavailable providers, camera framing and arbitrary seeks, event timing, receiver cues, own goals, reduced motion and unchanged recordings. Browser checks cover controller labels, the Whole pitch toggle, goal composition and complete 1× playback of the existing match. Pose sheets show the scorer's plant/turn/landing and six distinct corner/stand flag poses; flag drawing checks verify fixed poles and no cached cloth. Production JavaScript is 399.09 kB, 125.93 kB gzip, with no added dependency. Both public recordings independently replay; their public and built assets pass exact credential scans, including decompressed gzip content. The generation lock is removed.

## Limits and next slice

The expressions are authored visual reactions, not access to hidden reasoning. Kick preparation is limited to the actual one-tick execution boundary. The camera intentionally starts with a small zoom range; Whole pitch remains the user's default. Presentation never alters movement, the score or recorded decisions.

The proposed next football slice combines positional role briefs with receiver arrival timing. The user asked whether players should understand role characteristics; the current engine only distinguishes keeper from outfield. Give controllers concise briefs for goalkeeper, centre-back, full-back, holding midfielder, central midfielder, winger and striker, then use existing tactical assignments for immediate pressing/support/running/covering jobs. These should guide model choices rather than insert automatic tactical movement into the engine.

Defensive recovery is a concrete problem: at Cyan's shot, every Coral outfielder is farther from Coral's goal than the opposing ball carrier. The original centre-backs have advanced into attacking roles, and Coral #7 remains near the opposite penalty area. Role briefs should emphasize keeping cover between the ball and the team's own goal, plus recovery after losing possession.

One mini pass reached its target area around 1.02 seconds while its receiver was still 2.19 metres short. Matching a runner's target coordinates to a kick target does not make them arrive together, and the ball does not stop at that target. Compare receiver travel time, ball speed and pressure before committing the pass; preserve model choice and engine outcomes. No role or timing prompt change was applied to the currently generating match.
