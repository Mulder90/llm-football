# LLM control contract

One model controls each team's whole active roster. Both models receive the same rules and action capabilities at the same frozen simulation boundary. The engine decides physics, possession, referee incidents and results. A model's tactical intent is a public plan, not evidence of hidden reasoning or a successful action.

## Inputs

The shared rulebook describes our actual simulation: coordinates, current ruleset duration, movement/ball mechanics, phase legality, order lifetimes, restarts and referee simplifications. `src/protocol/rulebook.ts` owns this text. The runner records its exact bytes; replay inspection uses that recorded text. Only the current ruleset is supported.

`src/protocol/observation.ts` produces these fields for each side:

- `responseIdentity`: match, team, decision ID and integer tick to copy into the batch.
- `phase`, `phaseInstruction`, `half`, playing time, half duration/time remaining and score.
- `teamContext`: own/opponent goal centres for this half, possession, carrier ID and active teammate/opponent IDs.
- `players`: all 22 public players with position, velocity, facing, role and discipline. Own players additionally expose their current order/lifetime and action context.
- `actionContext`: `canKickNow`, reachable opposing carrier ID or null, tackle cooldown, distance to ball and nearest opponent ID/distance. Exact geometry is checked before display rounding; these facts do not guarantee success or rule out a foul.
- `ball`: position, velocity, owner and last touch; `offside`: the public current snapshot.
- `recentEvents`: latest 12 public events; `orderFeedback`: latest 12 own failed orders/restart violations since the previous shared decision.
- `privateMemory`: the team's prior notebook, bounded to 500 characters and never supplied to the opponent.

Players' public coordinates are rounded to centimetres for observation only. Opponent orders, opponent memory, seed and pending responses are never exposed. The added nearest-opponent fact does not replace the full opposing roster.

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

The prompt asks for one purposeful order per active teammate, including the keeper. The validator still permits omitted players: their existing orders continue until normal expiry, with no invented tactical fallback. A tactical note saying “others support” cannot execute those movements.

The model must coordinate a carrier's pass with its receiver's movement and consider arrival time, opposing players and supporting angles. It must also choose defensive cover, divide pressing/marking work and keep a goalkeeper protecting the current own goal. The model chooses every target. There is no automatic receiver selection, pass correction, supporting run, man-marking or ball-chasing in the engine.

Kick/shot/tackle orders execute once and are never queued for later possession. Movement and guard persist for three seconds unless replaced, cancelled or completed. At most one order per player means the passer cannot also receive a move in the same batch; its next supporting run needs a later decision. Both sides may change the world after this snapshot, so an action that was reachable can still fail when committed.

## Validation and feedback

Every provider JSON response passes strict shape, finite/range, identity, team ownership, duplicate-player and phase validation. Invalid batches receive at most one repair against the same serialized snapshot; the other team's accepted reply stays locked. Exhaustion records an explicit empty batch. A permanent provider failure stops generation as incomplete.

An accepted action can still fail physically. A kick without possession or tackle out of reach is an engine event, not a successful action and not silently repaired into another tactic. These failures are shown to that team in its next observation. The inspector exposes recorded attempts, feedback and accepted decisions.

The runner reserves both teams' requests and possible repairs before advancing a decision boundary. Request count, input/output size, estimated usage and wall time are bounded. Slow replies do not give opponents extra simulation time. The current schedule is one second, interrupted by phase changes and eligible possession changes after a minimum 15 ticks.

## Evaluation and replay

Bounded real-model runs record exact prompts, observations, attempts, failures and accepted orders. Assess both immediate execution failures and continuous team behaviour. Single-snapshot improvements do not prove sustained teamwork. Old viewer recordings are removed when their ruleset changes; development does not maintain historical engine support.

Scripted fixtures are development controls, never labelled model-played. Replays use recorded decisions/frames and call no model. Public observation inspection follows the replay playhead; it is not a live provider token stream. See [decision 005](decisions/005-SHORTER-MATCHES-AND-COORDINATION.md) for the approved timing/coordination change and its numeric boundaries.
