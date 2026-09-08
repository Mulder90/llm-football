# Slice 8 — Tactical memory and one-minute development matches

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

The current ruleset is football-0.5: two 30-second playing halves. The user explicitly stopped the longer generation and prioritized entertaining football before further broadcast or rendering work. This slice gives both teams a structured plan that survives between decisions and makes spacing responsibilities explicit. It adds no new physical assistance or dependencies.

## What changed

The former free-text notebook is replaced by a bounded object: short plan, one ball player, optional pass receiver and meeting point, distinct off-ball assignments, up to two observed opponent threats and a review of the previous attempt. A valid response must reference active players on the correct side. The first observation has null memory; later observations carry the team's last accepted object. Fallback preserves it.

The models already saw all teammates and opponents, including public positions, velocities and facing. They continue to see that complete field while pending opponent orders and memory remain private. Each owned player now also gets a nearest-teammate ID and distance, excluding itself and dismissed teammates. This is a spacing fact, not a chosen movement target.

The shared prompt asks for one ball player, one receiver at a pass meeting point, and different supporting destinations for everyone else. It asks the model to retain useful jobs across decisions, preserve width and cover, and compare friendly targets before returning orders. Six metres between supporting players is a preference when space allows, with close-play exceptions. Neither that preference nor the remembered roles is enforced by movement helpers.

The recent-event list excludes repetitive `block` contacts so useful incidents remain available for the model's review. Full recordings retain those events. The observation exposes `previousDecisionTick` to distinguish new incidents from older retained ones. The optional inspector renders the plan, assignments, threats and review with team/player names. Review is explicitly labelled as a model assessment.

## Invariant and mechanism

Memory cannot move a player or declare a result. To reimplement the loop, start with one nullable memory object per team. At a shared decision boundary, build each observation from the same frozen football state and a clone of that team's own object. Serialize both before starting either provider request. Validate each returned JSON response, including memory's shape, bounds and player references. Keep an accepted response locked while the other team repairs against its unchanged snapshot.

After both responses settle, commit their accepted action batches and replace each team's stored memory with its accepted memory. An exhausted repair contributes empty orders and the previous memory; an invalid attempted plan never overwrites it. Run the physics using only the committed orders. At the next decision, the model compares the actual ball state and events against its retained plan, then writes a new review and plan. The review remains the model's claim even when it confidently describes success.

Assignments must still become current `move`, `guard`, `hold`, `kick`, `shoot` or `tackle` orders. Movement keeps its existing three-second expiry; immediate kicks and tackles never queue for later. Body separation resolves overlap mechanically but does not create football spacing. Decision notes now belong to the recording layer; the simulation has no dependency on the tactical-memory schema. Clock and memory changes do not alter contact, scoring, referee or movement mechanics.

## Recorded evidence

The previous `coordination-match-001` generation was stopped at the user's request after 129.3667 playing seconds. Its saved estimated usage is $1.008124. It remains a private incomplete checkpoint rather than being presented as a completed match. Old public recordings were removed because the project supports only the current ruleset.

The new complete scripted fixture reaches 60 playing seconds and full time at tick 4,734, with hash `57cd43fa` and a 3–3 score. Its presentation duration is 78.9 seconds because restart setup/delivery and the halftime interval pause the playing clock. This is a scripted lifecycle baseline, not model-played footage or a desired score. The passing fixture retains nine kicks, eight receptions and one interception, with current hash `891d002e`.

A two-request smoke check accepted both responses with no fallback, replay hash `95779cb7`, and estimated cost $0.0036171. The complete `tactical-memory-match-001` evaluation finishes both 30-second halves normally, 0–2, with hash `31ab92f4`. It records 3,600 playing ticks and 4,853 presentation ticks (80.883 seconds), 138 shared decision boundaries and 298 provider requests. Generation took 1,625.797 seconds (27m 05.8s), costing an estimated $0.6361261 under its $0.75 ceiling. Publishing independently validates and replays it; JSON is 16,911,422 bytes and gzip is 1,229,037 bytes.

There are 22 repair requests, 30 rejected replies, no provider errors and eight explicit fallback batches. 266 of 276 team batches order the full active roster. The engine records two goals, 32 shots, 17 saves, 26 kicks, five successful tackles, one offside and 11 failed actions. These are the actual results; no choices or scores were changed for presentation. The first 30 playing seconds provide a duration-matched diagnostic, not a controlled A/B trial: both runs use the same initial seed/models, but sampling, changed instructions and diverging match states prevent causal claims about memory alone.

| First-half measure                           | Coral before | Coral now | Cyan before | Cyan now |
| -------------------------------------------- | -----------: | --------: | ----------: | -------: |
| Outfield player-time within 3m of a teammate |       16.58% |    16.48% |      11.93% |    1.96% |
| Batches with move targets within 3m          |      22 / 55 |   21 / 64 |      8 / 55 |   2 / 64 |
| Close move-target pairs                      |          111 |        23 |          10 |        2 |
| Kicks first controlled by another teammate   |       3 / 11 |     0 / 9 |       0 / 2 |    4 / 5 |

No two current first-half move targets are exactly identical. Actual-position crowding improves strongly for Cyan and is effectively unchanged for Coral. The crowding diagnostic weights adjacent open-play frame intervals by elapsed playing ticks, excludes keepers and dismissed players, and measures 29.9833 seconds of the new first half versus 29.9333 seconds of the old sample.

Passing remains uneven. Two of Cyan's five declared passes reach their intended receiver; two reach different teammates. All nine Coral kicks go first to an opponent, including seven declared passes. Its goalkeeper repeatedly aims toward #9 while Cyan #10 intercepts. Across the complete minute, Coral reaches its declared receiver on 1 of 10 declared passes and Cyan on 5 of 10. One later Cyan order brings three players to one point, so convergence remains possible. Full-match crowded player-time is 15.45% for Coral and 5.81% for Cyan. The pass diagnostic follows event IDs to the first controlled touch, ignoring deflections; it includes kick-based restarts/clearances and excludes shots. A reception event alone is not proof that the planned receiver got the ball.

## Verification

Focused verification covers strict memory shape and bounds, correct active-player references, distinct assignments, different pass receiver and ball player, private memory delivery, fallback preservation, observation immutability and request-size limits. Current-clock fixtures replay independently, including both end swaps and exact full time. Before presentation integration, strict TypeScript and all 73 tests across eight files passed, and the production viewer built successfully. The new Team plan disclosures have been checked in the browser against the first real excerpt, including both teams, collapsed defaults and the model-assessment label. The complete recording passes validation and independent replay. Final integrated verification reaches 80 tests; renderer playback, build and exported-asset checks are recorded with [slice 9](09-LIVELIER-BROADCAST.md), which was approved while generation ran.

Useful numeric boundaries remain unchanged: action readiness uses exact coordinates before centimetre rounding, and each half ends after its 1,800th playing tick's incidents. A shot still in flight after the final tick cannot score later. Presentation may be longer than 01:00 because stopped-clock phases consume simulation ticks. The replay endpoint must select its exact final integer tick despite seconds-to-ticks floating-point conversion.

## Limitations and next slice

The model can retain an unhelpful plan, infer an opponent's intent incorrectly, assign distinct roles with crowded targets, or misdescribe an outcome in its review. Soft spacing instructions do not guarantee separation. A one-minute match is useful development evidence but cannot establish sustained tactical quality across longer play. Existing simplified football rules remain documented in [the rules](../04-FOOTBALL-RULES.md).

Next: improve goalkeeper distribution and adaptation after repeated interceptions, using actual first controlled touches to evaluate passes. Keep tracking spacing, off-ball continuity and defensive cover. The separately approved rendering work is documented in slice 9.
