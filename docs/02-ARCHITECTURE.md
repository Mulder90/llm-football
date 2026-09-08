# Architecture

The implementation is one strict TypeScript package: React and Canvas 2D in the spectator browser, a local Node runner for generation, Zod at external JSON boundaries and Vitest for rules and replay checks. There is no generic game framework, database, account system or provider SDK.

## Responsibilities

| Location                    | Owns                                                                           | Does not own                                    |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `src/sim/`                  | Fixed-step physics, actions, referee, phases and results                       | React, browser, network, storage or wall clocks |
| `src/protocol/`             | Observations, shared rulebook, response schema and prompt wording              | Opponent private notes or pending orders        |
| `src/generation/`           | Provider requests, paired decision barriers, validation, fallbacks and budgets | Hidden tactical decisions                       |
| `src/recording/`            | Canonical replay, viewer samples, provenance and import validation             | Inference during playback                       |
| `src/render/`, `src/audio/` | Pixel stadium, sprites, selection overlays, celebrations and sound             | Match outcomes                                  |
| `src/ui/`                   | Playback controls, catalogue/import, score and optional inspection             | Per-frame simulation                            |
| `src/fixtures/`             | Explicit passing and full-match scripted baselines                             | Secret assistance to model-controlled players   |
| `scripts/`                  | Local CLI generation, export and catalogue publishing                          | Credentials in browser assets                   |

## Decision boundary

The runner serializes both observations before either request is dispatched. It calls both models concurrently and freezes the state until both replies have settled. A valid reply is locked while only the rejected team is repaired, at most once, against the identical observation. Exhaustion records an empty batch: existing orders continue until expiry. A permanent provider failure stops generation with an incomplete record.

Both batches are validated against the same match, team, tick and decision identity before either is applied. Arrival order cannot expose an opponent's pending orders or let one side move earlier. Instantaneous kicks, pickups and keeper releases resolve before tackles, then movement/body separation, then the ball, then the match clock. A stopped phase skips subsequent open-play work. Equal physical contacts have declared priority and explicit seeded tie-breaking.

A scheduled decision is due after one simulated second. Phase changes interrupt sooner; gaining control of the ball can interrupt after a minimum 15 ticks since the last decision. A release into flight does not itself request a replan: existing runs continue, with loose-ball play reviewed at the regular interval. The scheduler remembers a release so even the same player's later recapture can prompt both teams. Both teams always receive the same opportunity. A valid order can still fail physically; that is a recorded football event, distinct from rejected JSON or operational fallback.

Both providers receive the same stable response schema. Match/team/tick/decision values are supplied in the observation and checked in code after parsing. They are no longer embedded as changing schema constants. This allows prefix/schema reuse without accepting stale replies; cache hits and actual latency remain measured provider behavior.

The observation stream shown to spectators follows these recorded boundaries. It is not a WebSocket or a claim of live model token streaming. Partial JSON never becomes a committed action.

Each team starts with null tactical memory. A valid response replaces its own memory with a bounded object containing the plan, ball player, optional pass, off-ball assignments, opponent threats and previous-attempt review. The next observation carries a clone of that team's object. A rejected reply cannot overwrite accepted memory; an exhausted repair preserves the previous object while recording empty orders. Memory references are validated against active players on the appropriate side. The simulation does not read or execute memory. The inspector can show both recorded plans after the fact, but generation never sends one team's plan or pending orders to the other.

## Four clocks

1. **Simulation:** integer ticks at 60 Hz, including setup and halftime.
2. **Playing time:** 1,800 eligible ticks per half, defined once in the current ruleset (football-0.6). Restart setup/ready and halftime pause this clock. Ends swap after the interval. Thirty seconds per half is the current development duration.
3. **Generation wall time:** provider latency, validation, retries and checkpoint writes. It cannot alter physics through response arrival order.
4. **Presentation:** a watch timeline maps to recorded simulation time, sampled/interpolated at the browser's frame rate. Each eligible goal vignette takes nine watch seconds at 1× while ordinary play retains its original rate. Controls show the extended duration. The spectator can pause, seek and change speed; a hidden tab pauses instead of catching up.

Goal huddles use a presentation copy of pre-goal poses during the recorded stopped-clock setup. The watch timeline gives this sequence more viewing time; it does not extend a shot, add model decisions or move canonical players. Score, inspection and event audio always sample mapped recording time. Decorative jumps and flags use watch time. [Decision 007](decisions/007-BROADCAST-TIME.md) covers the mapping and exact endpoint handling. The renderer bounds a single elapsed frame to 0.25 seconds and updates React controls at roughly 10 Hz; sprite rendering uses `requestAnimationFrame` independently.

## Physical world

Positions are metres on a 105×68 field: x along its length, y across its width, z upward. Speeds are metres per second. IDs and jersey numbers persist through halftime and dismissal. Attack direction derives from team and half.

A movement order steers toward one fixed target with bounded acceleration and braking. It does not chase, mark or choose a passing lane. Foot possession follows a carrier's foot. Nullable `ball.handControl` distinguishes hands independently of movement orders; it records the collection tick, playing-tick start and collection height. Legal guarding catches and pickups attach the ball to the keeper's hand anchor. Separate handling histories track deliberate kicks, direct teammate throw-ins, rehandling and direct hand-distribution goals. Loose control, deflections and swept goal-frame/boundary contacts retain explicit rules. The model chooses kick direction, speed and loft. The referee alone awards goals, restarts, offside and contact sanctions. [The current rules](04-FOOTBALL-RULES.md) and [decision 004](decisions/004-CONTACT-REFEREE.md) describe deliberate simplifications.

All public player positions and velocities are already present in both observations. Nearest-teammate and nearest-opponent facts summarize current geometry; neither chooses a movement target. Distinct supporting positions, pressing assignments and inferences about opponent intentions remain controller decisions. Repetitive `block` events are omitted from the bounded observation history so other incidents remain useful when reviewing a plan; the full recording still retains them.

## Canonical replay and viewer samples

One versioned JSON recording contains initial state, accepted paired batches and their ticks, explicit fallbacks, ordered events, diagnostic final hash, named viewer frame fields, exact observations and generation provenance. Samples are captured every three ticks and at incidents, phase changes and decision checkpoints. The browser interpolates adjacent samples within a phase; contacts and phase changes remain discrete, including same-owner pickup/put-down transitions. Held-ball samples carry the original control start; the visual scoop interpolates collection height only after a real collection, without modifying canonical frames.

`verifyRecording` clones the initial state and executes recorded batches through the matching ruleset. It must consume every decision and reproduce the final hash. It makes no model requests. The FNV-1a hash is a diagnostic over canonical JSON property order, not a cryptographic proof or archival promise across arbitrary runtimes. Import validation checks the original JSON without returning a reordered object. The viewer and verifier accept only the current engine version. Old recordings can be removed during development; there is no compatibility layer, legacy clock or migration system.

The simulation uses explicit seeded randomness and stable ordering, with no platform clock or hidden mutable state. Tests cover replay, numerical boundaries and the import boundary. Drawing rounds to pixels; physics retains its numerical precision. Presentation variation never consumes the simulation seed.

## Generation and publication

`scripts/generate.ts` loads ignored local `.env`, validates known provider models/prices, reserves a paired boundary and its allowed retries against explicit request/token/cost limits, and keeps a single-job filesystem lock. Checkpoints use a temporary file followed by atomic rename. Cancellation, budget exhaustion, timeout or abandonment retain an incomplete record; they never fabricate full time. Current jobs start fresh; automatic resume is not implemented.

Publishing validates and re-simulates the record, gzip-compresses it, then writes the local static catalogue. The viewer validates downloaded/imported JSON and bounds decompressed imports at 80 MiB. It accounts for browsers already decoding HTTP Content-Encoding so a gzip file is not decompressed twice. API credentials are absent from export schemas and browser imports.

Visitors reuse the same recorded artifact; watching costs no inference. The public viewer is deployed as Cloudflare Workers Static Assets using `wrangler.jsonc`: only `dist/` is uploaded, with no server handler or model credentials. `pnpm deploy` builds and publishes; Git pushes alone do not update the website. Generation remains local. A hosted generation service and automatic Git deployment are later work. See [deployment instructions](DEVELOPMENT.md#deploy-the-website-to-cloudflare).
