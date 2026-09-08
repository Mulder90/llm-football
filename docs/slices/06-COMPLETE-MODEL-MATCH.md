# Slice 6 — A complete model-controlled match

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

`north-garden-001` is the first complete game: Coral FC (GPT-5 nano) against Cyan FC (Gemini 3.1 Flash-Lite), ending **1–2**. Both 180-second playing halves finish normally. The committed recording is the default choice in the viewport-first viewer; no credentials or model requests are required to watch it.

The optional inspector identifies each team, model and player. Decisions can highlight the relevant player and target on the pitch. Observations follow the recording's playhead; spectators can read the exact rulebook, response schema and request messages, including repair feedback. This is replay inspection, not live inference or hidden model reasoning. Goal banners, team-coloured celebrations and optional synthetic stadium sound are presentation effects.

## Preserved evidence

| Measure                              | Result                                       |
| ------------------------------------ | -------------------------------------------- |
| Engine / recording / protocol        | football-0.3 / 2 / 1                         |
| Playing time                         | 360 seconds, 21,600 ticks                    |
| Presentation duration                | 432.45 seconds, 25,947 ticks                 |
| Paired decision boundaries           | 637                                          |
| Provider requests, including repairs | 1,283                                        |
| Explicit fallback batches            | 1, Cyan at tick 21,446                       |
| Generation wall time                 | 3,820.329 seconds, about 63m 40s             |
| Estimated model usage cost           | $1.35333105, below the configured $4 ceiling |
| Recorded frames                      | 9,245                                        |
| Canonical final hash                 | `f0421b48`                                   |
| JSON / gzip bytes                    | 76,678,417 / 5,279,749                       |

The runner finished with `generation.status: complete`, no stop reason and a `full_time` phase whose reason is `completed`. It saved the final atomic checkpoint and replay-verified it. Publishing independently validated the file and replayed its accepted batches to the same final hash before updating the local catalogue. The 73.13 MiB decoded file remains below the existing 80 MiB import limit. The gzip file is about 5.04 MiB; browser memory use is larger because the complete JSON, frames and observations are loaded eagerly.

No scripted controller supplied either team's choices. The one fallback followed two rejected Cyan responses with duplicate player orders; it supplies no new orders, so existing orders only continue until their normal expiry. Every attempt and the fallback remain inspectable. Costs are estimates derived from receipts and configured prices, not an invoice.

## The result is allowed to be awkward

There are three goals, 14 recorded saves, 10 offside offences, two frame contacts and 35 completed restarts. This particular game contains no foul or card events; focused referee tests cover those rules. The 207 `order_failed` events include model actions that cannot execute in the current state, such as shooting without possession. They are not silently repaired by a tactical helper.

Coral concedes twice after its own players shoot toward their own goal in the second half. The exact observation already says its attack direction is now `-1`; the models still make mistakes. The original run and score are retained. Goal events identify the last player to touch the ball, rather than implementing official scorer attribution. Improving football competence is the next slice, not a reason to manufacture a better first result.

The engine uses the documented [football-0.3 rules](../04-FOOTBALL-RULES.md). Contact severity is a speed-based heuristic, offside involvement is limited to ball contact or a successful tackle, and several IFAB offences and procedures are omitted. Six minutes refers to playing time: setup pauses and halftime add 72.45 seconds to the broadcast. A local generation checkpoint cannot yet be resumed, and recordings from an older engine version require that version's viewer.

## How to reimplement the fairness and replay mechanism

At a decision boundary, stop the deterministic simulation and serialize an observation for each team from the same state. Send both requests concurrently. Validate each returned JSON batch against its team, match, decision ID and tick. If one team needs a repair, retain the other team's accepted batch while repairing against the unchanged snapshot. After retries are exhausted, record an explicit empty fallback. Only then commit both batches and advance the fixed 60 Hz engine.

Store the initial state, accepted batches with their integer ticks, fallback markers, observations, request receipts and sampled frames. To verify a replay, rebuild the engine from the initial state, apply both teams' recorded batches at each original tick and step to the recorded endpoint. Compare the canonical final state hash. There are no provider calls during verification or viewing; generation latency has no tactical effect.

The viewer interpolates presentation frames without changing simulation state. Check the endpoint in seconds before converting it back to ticks: floating-point arithmetic can turn an exact duration into a value just below the final integer tick. Goal effects similarly wait for the frame after the goal incident, because that is the first frame containing the updated score. These boundaries have focused regression tests.

## Verification

- `pnpm check`: strict TypeScript and all 60 tests across six files pass. These cover simulation rules, simultaneous decision boundaries, validation/fallbacks, replay determinism and presentation timing.
- `pnpm build`: production viewer builds successfully; JavaScript is 364.46 kB, 113.34 kB gzipped. The full compressed match is copied as a separate static asset.
- `pnpm publish-recording artifacts/private/north-garden-001/match.json`: validation and independent replay pass with hash `f0421b48`; the catalogue marks the full recording complete and makes it the default.
- Browser acceptance: the published full recording plays from kickoff through full time at 4× without seeking, stops at tick 25,947 and shows 06:00 playing time, 07:12 presentation time, the 1–2 score and Watch again. Normal-speed segments, halftime/end switching and the real goal celebration were also inspected. The Match tab displays the same complete status, hash, requests, fallback and cost as the source record.
- The final observation panel shows boundary 636 at tick 25,923, Coral's second-half attack direction `-1`, 359.6 playing seconds and all 22 players. The exact recorded rules/prompt remains readable beside the pitch. Earlier slice checks cover the mobile inspector, pause, focus restoration, selected player/target and native fullscreen.
- Prettier formats the source and documentation. Exported match files (including decompressed JSON) and the production assets pass a scan for the two configured credential values without printing them. API credentials stay in ignored `.env`.

Sound event selection and timing are checked in tests, and mute controls have been exercised in the browser. A human listening assessment remains open; this handoff does not claim one.

## Next proposed slice

Make the controllers' coordinate and possession instructions easier to follow: explicitly expose own/opponent goal centres after an end swap, inspect failed action patterns, and compare a bounded new possession against this preserved baseline. Keep outcomes controlled by the engine. Public deployment and a match library remain separate work.
