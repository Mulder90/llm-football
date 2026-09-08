# Slice 7 — Two-minute halves and coordinated team decisions

The current ruleset is football-0.4: two 120-second halves, one model per team and a single timing constant used by the engine, observation, prompt and complete-record validator. The user explicitly approved removing old matches instead of maintaining compatibility. The old viewer recordings, compatibility mapping, legacy replay test and legacy-dependent diagnostic script are removed. The unused Gemini 2.5 adapter branch is removed too; current Gemini 3.1 request settings are unchanged. There is no new dependency or migration framework.

## What the models now receive

Both models already saw every teammate and opponent. The new observation makes the team situation easier to use: own/opponent goal coordinates for the current half, possession, active roster IDs and action-readiness facts for each owned player. A separate bounded list preserves the team's failed orders since its last decision, even when public ball contacts crowd the general event list.

The shared prompt asks for coordinated carrier/receiver actions, supporting angles and depth, defensive cover, divided pressing/marking and goalkeeper positioning. It asks for a purposeful order for every active player, because a note saying “the others support” does not refresh their movement. Omitted orders still follow the established continuation/expiry rule; the engine does not invent missing tactics. Prompt text now has its own module, separate from observation geometry.

The invariant remains that models choose all targets and the engine owns outcomes. Facts such as a nearby opponent or reachable carrier do not choose a receiver, passing lane, formation, marking assignment or interception. No movement, contact or scoring assistance was added to model play.

## Evidence

An initial six-snapshot diagnostic of the first prompt revision reduced immediate failures from four to one and corrected the sampled wrong-end shot. That comparison used saved original decisions, not repeated randomized trials. Its responses exposed a remaining problem: some models described teamwork while ordering only one player. This motivated the final instruction to supply the whole active roster.

Two continuous capped development runs used the same models and initial seed, but provider sampling and diverging match states prevent a controlled A/B claim:

| Measure                           | First prompt revision       | Final whole-roster instruction |
| --------------------------------- | --------------------------- | ------------------------------ |
| Record                            | coordination-possession-001 | coordination-possession-002    |
| Paired decision boundaries        | 24                          | 24                             |
| Full-roster batches / all batches | 1 / 48                      | 45 / 48                        |
| Average orders per batch          | 2.35                        | 10.60                          |
| Immediate failed-action events    | 19                          | 0                              |
| Playing seconds                   | 11.35                       | 10.75                          |
| Provider requests                 | 49                          | 51                             |
| Operational fallback batches      | 0                           | 0                              |
| Estimated usage cost              | $0.0562                     | $0.0780                        |

The published final excerpt has hash `3934e9cc`, 884 presentation ticks (14.73 seconds), 10.75 playing seconds and a 304,645-byte compressed file. It ended at the explicit decision cap, not full time. It took about 235 seconds to generate and needed three successful response repairs.

At tick 819, Coral #2 kicks toward (50,48) while #9 moves toward the same point; the other players receive support/positioning orders and #1 guards the goal. This is an actual paired plan in the accepted orders, not a claim that the pass succeeds. The run still contains five shots and only a few kicks, and some support targets are crowded. Sustained tactical quality needs longer evidence.

## Verification

Strict TypeScript and all 65 tests pass. Focused new tests cover both teams' goal directions across halftime, private-information boundaries, observation immutability, dismissal and loose possession, exact tackle reach/cooldown/ball height, restart kick readiness, feedback retention and the existing input-size limit. Match tests complete and replay four minutes of scripted play, including the final-tick scoring boundary.

The scripted fixture initially abandoned after the new halftime timing led to too many dismissals. Its explicitly scripted controller now declines tackles the referee would penalize, respects recovery and excludes dismissed receivers. This changes only the development fixture's orders. Its current hash is `35fe7751`; it reaches full time at tick 18,152 with 240 playing seconds. The browser shows FULL TIME 04:00 and a separate 05:02 presentation duration. Referee tests still cover fouls and dismissals independently.

The passing fixture retains its nine kicks, eight receptions and one interception. Its new hash `e802ee0b` differs only because the serialized engine version changed; there was no physical drift in that sequence. Publishing the real excerpt validates the JSON and independently replays accepted orders to its canonical hash before adding it to the viewer. The excerpt plays through at normal speed in the browser and retains its incomplete label. The production build succeeds, and exported assets/decoded recordings pass a scan for the configured credential values without printing them.

## Learning checkpoint

To compute action readiness, start from one frozen state. For each owned player, check active status and phase. A kick additionally requires exact ball ownership. A reachable tackle needs an opposing carrier, elapsed cooldown, carrier and ball within their separate reach limits, and a low enough ball. Compute these booleans before rounding positions for display: a carrier at 1.8001 metres must stay out of a 1.8-metre tackle range even when the UI rounds the distance to 1.80.

Serialize both team views before sending requests; retry the same bytes on a repair. Once both responses settle, apply their accepted batches and let the engine run. An opponent can kick before a proposed tackle, so readiness describes an opportunity, not a promised outcome. Tactical coordination remains in the model's orders and public plan.

Next: finish and review the complete four-minute model run, then use its pass timing and defensive spacing to choose the next focused improvement.
