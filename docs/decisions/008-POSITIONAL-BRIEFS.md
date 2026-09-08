# Decision 008 — Starting positions as model guidance

Status: accepted under the user's request for short positional characteristics, following the stopped 25.95-second comparison match. No generation is part of this change.

The new controllers showed useful carrying and passing, but Coral's original centre backs advanced to x=92.01 and x=86.05. At Cyan's only shot, every Coral outfielder was farther from Coral's goal than the opposing carrier. Generic support and marking jobs did not preserve defensive responsibility. This short prefix motivates guidance; it does not establish overall model quality.

## Decision

Add seven short starting-position briefs in `src/protocol/positions.ts`, using the existing 4–3–3 roster numbers:

| Numbers | Starting responsibility           |
| ------- | --------------------------------- |
| 1       | Goalkeeper                        |
| 2, 5    | Left and right fullback           |
| 3, 4    | Left and right centre back        |
| 7       | Holding midfielder                |
| 6, 8    | Left and right central midfielder |
| 9, 11   | Left and right winger             |
| 10      | Striker                           |

Each owned observation player has `startingPosition: { role, side }`. Its role refers to one shared entry in `teamContext.positioning.briefs`; prose is not repeated for every player. Each brief covers possession, defending and loss of possession. Starting positions remain stable when players move or ends swap. Current memory assignments such as support, run and mark are temporary jobs, and a player may interchange responsibilities if another player explicitly covers the vacated job.

Forward is relative to the current `opponentGoal`, and goal-side means between a threat and the current `ownGoal`. `leftTouchlineY` is 0 when attacking positive x and 68 when attacking negative x; right is the opposite. Thus the same left-back identity follows the correct flank after halftime. To reimplement this, look up the roster number in the fixed role/side table, then derive the two touchline coordinates from `attackDirection`; never infer starting position from the player's current coordinates.

The shared prompt emphasizes centre-back and holding-midfield cover behind attacks, staggered fullback advances and goal-side recovery after a turnover. Both centre backs or fullbacks should not advance without replacement cover. The keeper can distribute when in possession; guard is positioning, not a compulsory order at every boundary.

Pass guidance now asks the model to compare ball arrival with the receiver's travel time, including velocity, pace and acceleration. Identical target coordinates do not synchronize arrival, and a kicked ball does not stop at its target. The model may choose a nearer meeting point, slower delivery or wait/carry. No pass timing, receiver choice or recovery run is computed for it.

## Boundaries and verification

The engine still distinguishes only keeper and outfield players. Position briefs add no abilities, speed differences, legal restrictions, automatic formation movement or hidden tactics. Every action still requires an accepted model order. Opponent public geometry remains visible, but their orders and private memory remain hidden; starting-position annotations are supplied for the acting team's players only.

The engine version, stable identifiers and replay semantics remain unchanged. Saved matches retain their exact recorded prompts and observations; this change applies to future model requests. There has been no paid evaluation of the new briefs, so improved play is not claimed.

Observation copies of active-order targets now use the existing centimetre geometry precision. Accepted orders, recorded batches, pace and private-memory targets retain their exact numbers. The copied target is rounded only after cloning the order, so observation consumers cannot mutate canonical state. This avoids spending request bytes on additional target decimals that the surrounding observed geometry does not expose. Repeated coordination and schema-field prose is condensed; physics and referee rules remain explicit.

Focused tests cover all eleven roles, both teams and both halves, flank direction, temporary jobs versus starting roles, observation isolation, complete serialized request size and unchanged independent replay. A busy boundary with a 100-character match ID, precise active orders, full bounded feedback and maximum-length memory fits the 32 KiB cap: 31,488 bytes for CJK text and 32,688 for JSON-escaped NUL text, including the actual response schema and 1,024 bytes of overhead. Memory round-trips without trimming. All decision boundaries in the full scripted match are also checked with full memory and the actual response schema. These are stress cases, not proof that every valid combination fits; the runtime input guard remains authoritative for unusually large inputs.

Next, evaluate defensive recovery and receiver timing on the same frozen situations before judging the briefs in another model match. Prefer evidence from maintained cover, completed receptions and appropriate carrying over the wording of a model's plan.
