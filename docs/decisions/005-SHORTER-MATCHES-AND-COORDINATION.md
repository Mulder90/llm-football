# Decision 005 — Shorter matches and coordinated team decisions

Approved by the user on 8 September 2026: reduce matches to two-minute halves and improve how a team considers its teammates and opponents. The user also explicitly prefers deleting old recordings to maintaining backward compatibility during development. One model per team and deterministic engine outcomes remain the architecture.

## One current ruleset

The current ruleset is football-0.4, with two 120-second playing halves. `MATCH_TIMING.halfPlayingTicks` is the single duration constant. The engine clock, observation time remaining, rulebook and complete-record validation derive from it. The scoreboard reads recorded playing ticks.

The viewer and verifier accept only the current ruleset. Old public recordings are removed; there is no legacy duration map, old engine dispatcher or migration layer. A version check prevents accidentally presenting unsupported files as current. Format 2 and action protocol 1 remain unchanged because their existing shapes and action semantics still apply; observations gain additive fields.

## Coordination belongs in the controller

The models already saw all 22 public players. The missing part was a useful team plan expressed through executable orders. The shared prompt now explicitly asks the model to compare teammates and opponents, coordinate a carrier's kick with a receiver's meeting point, create supporting angles and depth, preserve defensive cover, divide pressing/marking work and reassess its memory after every observation. Public intent should identify interacting players. No separate planning model or new action vocabulary is introduced.

The prompt asks for one purposeful order per active teammate, including the keeper. This instruction addresses observed replies that described support but ordered only the carrier; unrefreshed movement expires after three seconds. The validator still accepts omission with its existing continuation/expiry semantics. The engine never fills the gaps with tactics.

The observation adds team context: own/opponent goal centres for this half, possession and active roster IDs. Each owned player gets action context: kick readiness, a reachable opposing carrier (or null), tackle cooldown, distance to the ball and nearest opponent. These are mechanical preconditions and public geometry. They do not select a pass, target, runner, marker, formation or successful outcome. The full roster remains available; the nearest opponent is a convenience, not the only opponent to consider.

Reach uses exact engine coordinates before centimetre rounding. Both carrier and ball must be within their declared tackle distances, the ball must be low enough, the player must be active, cooldown must have ended and the phase must be open play. This is conservative: it does not advertise a body-only contact as a useful tackle. Even a reachable tackle may foul or fail when the opponent kicks first. `canKickNow` confirms possession/phase, not the quality or legality of a chosen direction.

Own failed-order and restart-violation feedback is collected since the previous shared decision tick and capped at the latest 12 items. It has a separate list so a burst of unrelated public contacts cannot hide a team's failure. Repair attempts reuse the same serialized snapshot. Opponent orders, notebooks and pending replies remain private during generation.

## Verification and evidence limits

Focused tests cover goal direction for both teams/halves, privacy, state immutability, dismissal, loose possession, exact reach/cooldown/height, restart readiness, feedback retention, request size and complete four-minute play. The explicitly scripted development controller now declines tackles the referee would penalize, observes recovery and ignores dismissed receivers. Those fixture tactics are not supplied to model-controlled teams.

A one-off six-snapshot diagnostic compared an initial prompt revision with saved old decisions before legacy support was removed. Immediate failures fell from four to one, and the sampled wrong-end shot corrected its direction. This was not a randomized A/B experiment or proof of sustained tactical quality. Its legacy-dependent diagnostic script was removed with the compatibility code. The results also motivated the final whole-roster instruction because some new replies still ordered only one player.

Continuous current-ruleset model runs are the next evidence: inspect the actual batches, pass/receiver interactions and defensive positioning. Preserve real errors and incomplete status; never manufacture a favourable match result.
