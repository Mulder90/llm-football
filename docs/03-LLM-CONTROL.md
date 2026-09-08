# LLM control contract

One model controls each team's whole active roster. Both models receive the same rules and action capabilities at the same frozen simulation boundary. The engine decides physics, possession, referee incidents and results. A model's tactical intent is a public plan, not evidence of hidden reasoning or a successful action.

## Inputs

The shared rulebook describes our actual simulation: coordinates, current ruleset duration, movement/ball mechanics, phase legality, order lifetimes, restarts and referee simplifications. `src/protocol/rulebook.ts` owns this text. The runner records its exact bytes; replay inspection uses that recorded text. Only the current ruleset is supported.

`src/protocol/observation.ts` produces these fields for each side:

- `responseIdentity`: match, team, decision ID and integer tick to copy into the batch.
- `phase`, `phaseInstruction`, `half`, playing time, half duration/time remaining, match time remaining and score. The current half duration is 30 playing seconds.
- `teamContext`: own/opponent goal centres for this half, possession, carrier ID, active teammate/opponent IDs and shared positional briefs with half-relative flank coordinates.
- `players`: all 22 public players with position, velocity, facing, role and discipline. Own players additionally expose their current order/lifetime, action context and stable starting position/side.
- `actionContext`: `canKickNow`, reachable opposing carrier ID or null, tackle cooldown, distance to ball, and nearest teammate/opponent IDs and distances. The nearest teammate excludes the player itself and dismissed teammates. Keepers additionally expose `handlingEligible`, nullable `handlingRestriction`, `canPickUpNow` and `canDistributeNow`. `canKickNow` requires feet; a protected keeper is excluded from reachable tackle targets. Exact geometry is checked before display rounding; these facts do not guarantee success or rule out a foul.
- `ball`: position, velocity, owner, last touch, `possessionMode` (`loose`, `feet`, `hands`) and nullable `holdTicksRemaining`; `offside`: the public current snapshot.
- `recentEvents`: latest 12 public events excluding repetitive `block` contacts; `orderFeedback`: latest 12 own failed orders/restart or keeper violations since the previous shared decision. The complete recording retains every event.
- `previousDecisionTick`: boundary against which to distinguish a new incident from retained history.
- `privateMemory`: the team's prior structured tactical plan, or null at the first decision. It is never supplied to the opponent.

Public coordinates and copied current-order targets are rounded to centimetres for observation only; the accepted orders and simulation retain their exact values. Opponent orders, opponent memory, seed and pending responses are never exposed. Both models already receive the entire opposing roster's public positions, velocities and facing. A model can infer possible runs or pressure from those facts, but its inference is not privileged access to an opponent's intended action. Nearest-player summaries do not replace the full rosters.

## Structured tactical memory

`src/protocol/schema.ts` defines the same strict memory shape for both providers:

| Field          | Meaning and bound                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`         | One objective, up to 120 characters                                                                                                             |
| `ballPlayerId` | One active teammate carrying, pressing or collecting the ball, or null                                                                          |
| `pass`         | Null, or a distinct active teammate's `receiverId` and a pitch-bounded `target` meeting point                                                   |
| `assignments`  | Up to 10 distinct active teammates, each with `role` (`width`, `support`, `run`, `cover` or `mark`) and an opposing active `opponentId` or null |
| `threats`      | Up to two opposing active players, each with `opponentId` and a `concern` of at most 80 characters                                              |
| `review`       | The model's assessment of its previous attempt, up to 120 characters                                                                            |

`ballPlayerId` always names an active player on the controlled team, including while defending: choose the teammate responsible for pressing or collecting, not the opposing carrier. Actual possession is already in `ball.owner`; an opponent can be tracked in `threats`. A wrong-side or dismissed `ballPlayerId` produces a field-specific repair error. Validation never picks a replacement player or rewrites the model’s plan.

A new match starts with null memory. Each accepted response replaces that team's memory, which is cloned into its next observation. Invalid replies cannot replace it, and operational fallback preserves the previous memory. The model must revise stale references or plans after dismissal, a turnover, restart or end swap. No automatic tactical reset chooses a replacement plan.

Memory is not an action queue or engine-certified result. The model must translate retained assignments and pass plans into actual orders. It should review events and current ownership, use event ticks to avoid treating old incidents as new, and say unresolved when evidence is inconclusive. A confident `review` does not prove that a pass succeeded. The spectator inspector labels this field as a model assessment and can reveal both plans from the recording; the opposing controller never receives them.

For new responses, the prompt asks for at most three useful off-ball assignments, a short plan and review, and only current threats. These are brevity instructions; the schema bounds above still define what is accepted. All active players still receive actual orders. `pass` describes a teammate pass issued in the current batch: `ballPlayerId` is its kicker or keeper distributor and `receiverId` a different teammate. Otherwise the model should return `pass: null`, including during carrying, defending or flight. This avoids repeatedly describing the entire formation or confusing an in-flight receiver with its passer. Historical recordings retain their exact original prompts and memory.

## Positional responsibilities

Starting positions follow the existing 4–3–3 roster: #1 keeper, #2/#5 fullbacks, #3/#4 centre backs, #7 holding midfielder, #6/#8 central midfielders, #9/#11 wingers and #10 striker. Seven shared short briefs cover possession, defending and recovery. Stable starting roles can coexist with temporary memory assignments; interchanges need explicit cover. Half-relative goals and left/right touchlines keep the same identities meaningful after ends swap.

The model chooses when to advance, who presses and who recovers. Centre backs and the holding midfielder should maintain cover, with staggered fullback advances and goal-side recovery after losing possession. These are instructions, not movement constraints, abilities or automatic formation assistance. See [decision 008](decisions/008-POSITIONAL-BRIEFS.md). Existing recordings retain their original inputs.

## Coordinated action batches

Return `{ batch, intent, memory }`. A batch copies the exact identity and adds `orders`. Action shapes are generated from the strict schema in `src/protocol/schema.ts`; targets are metre coordinates on the pitch.

| Order            | Parameters beyond `type` and `playerId` | Meaning                                             |
| ---------------- | --------------------------------------- | --------------------------------------------------- |
| `hold`           | none                                    | Brake and stay                                      |
| `move`           | `target`, `pace`                        | Move toward a fixed point                           |
| `guard`          | `target`                                | Keeper positioning with declared catching reach     |
| `kick` / `shoot` | `target`, `speed`, `loft`               | Release the owned ball now toward a direction point |
| `tackle`         | `targetId`                              | Attempt contact with the named carrier now          |
| `restart_taker`  | none                                    | Select an owned taker during awarded setup          |

Keeper-only open-play actions extend this table: `pickup` and `put_down` take no additional parameters; `distribute` takes `delivery` (`roll`, `throw`, `punt`), `target`, `speed`, and required `loft`. Roll bounds are 2–12 m/s and zero loft; throw 2–18 and 0–6; punt 2–30 and 0–8. The stable schema uses shared shapes for identical parameters, with delivery-specific range enforcement in runtime and recording validation. Wrong-state attempts produce events; invalid identity, role, phase or parameters reject the batch. See [keeper handling](04-FOOTBALL-RULES.md#keeper-handling) for eligibility and sanctions.

The prompt asks for one purposeful order per active teammate, including the keeper. The validator still permits omitted players: their existing orders continue until normal expiry, with no invented tactical fallback. A tactical note saying “others support” cannot execute those movements.

The model first chooses whether to carry, pass or shoot from the actual space, pressure and goal position. `canKickNow` permits a release; it does not require one. A carrier's `move` retains its existing possession mode: dribbling at feet or carrying in hands with the original timer. Only after choosing a pass should the model coordinate the receiver's movement and ball arrival. Matching targets alone does not synchronize arrival: compare ball speed with receiver travel time, velocity, pace and acceleration. Choose a reachable meeting point, slower delivery or retain possession when needed. Supporting runs, defensive cover, pressing and keeper positioning remain explicit model choices. There is no automatic receiver selection, pass correction, marking or ball-chasing.

The spacing guidance names one ball player and gives the pass meeting point to one receiver. Other players need distinct targets, width, different depths and defensive cover. It asks the model to compare friendly movement targets before submitting, to prefer at least six metres between supporting players where space allows, and to retain useful current destinations across decisions. Close challenges and runs can be exceptions. Six metres is prompt guidance, not a collision radius, hard validation rule or hidden movement correction.

Kick/shot/tackle/pickup/put-down/distribution orders execute once and are never queued for later possession. Movement and guard persist for three seconds unless replaced, cancelled or completed. At most one order per player means the passer cannot also receive a move in the same batch; its next supporting run needs a later decision. Both sides may change the world after this snapshot, so an action that was reachable can still fail when committed.

## Validation and feedback

Every provider JSON response passes strict shape, finite/range, identity, team ownership, duplicate-player and phase validation. Memory also validates active player ownership, distinct assignments and a different receiver from the ball player for a pass. Invalid responses receive at most one repair against the same serialized snapshot; the other team's accepted reply stays locked. Exhaustion records an explicit empty batch and preserves the previous memory. A permanent provider failure stops generation as incomplete.

An accepted action can still fail physically. A kick without possession or tackle out of reach is an engine event, not a successful action and not silently repaired into another tactic. These failures are shown to that team in its next observation. The inspector exposes recorded attempts, feedback and accepted decisions.

The runner reserves both teams' requests and possible repairs before advancing a decision boundary. Request count, input/output size, estimated usage and wall time are bounded. Slow replies do not give opponents extra simulation time. The current schedule is one second, interrupted by phase changes and gaining control after a minimum 15 ticks. A release alone does not trigger another request; reception, recapture and turnovers can. Phase changes can still interrupt sooner.

One stable JSON schema is used across requests and recorded in provenance. Identity values remain in `responseIdentity` and must match the frozen state exactly in runtime validation; unsupported versions, stale replies and wrong-team orders remain rejected. Compact JSON and brief public notes reduce repeated output. See [decision 010](decisions/010-CARRIER-CHOICES-AND-REQUESTS.md).

## Evaluation and replay

The sustained-play harness reuses the actual paired match loop from fresh scenario states. Both controllers can replan through a bounded playing-time horizon. An optional `evaluation` observation contains `plannedPlayingTicks` and `remainingPlayingTicks`; `secondsUntilNextScheduledDecision` still describes the one-second cadence, and regular match clocks stay intact. Scripted traces use the same schema, memory, repairs and receipts with explicit scripted provenance. The offline CLI has no paid mode. [Slice 19](slices/19-SUSTAINED-PLAY-HARNESS.md) records the baseline.

Bounded real-model runs record exact prompts, observations, attempts, failures and accepted orders. Assess both immediate execution failures and continuous team behaviour. Single-snapshot improvements do not prove sustained teamwork. Old viewer recordings are removed when their ruleset changes; development does not maintain historical engine support.

Scripted fixtures are development controls, never labelled model-played. Replays use recorded decisions/frames and call no model. Public observation inspection follows the replay playhead; it is not a live provider token stream. See [decision 006](decisions/006-TACTICAL-MEMORY.md) for the approved memory, spacing and development-duration change.
