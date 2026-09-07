# Architecture

All choices below are design proposals to refine through implementation; invariants in AGENTS.md remain binding unless the user revises them.

## Responsibilities

| Component | Owns | Must not own |
| --- | --- | --- |
| Football simulation | State, movement, ball physics, contacts, referee, phases and results | Provider requests or rendering |
| Observation builder | Public world snapshot, perspective, recent public events | Opponent private notes or pending orders |
| Team controller adapter | Converting observation to unknown action payload | Direct state mutation |
| Match runner | Decision barriers, validation, fallbacks, generation lifecycle | Hidden tactical decisions |
| Recorder | Inputs, applied ticks, events, provenance, checkpoints | Re-running models during replay |
| Playback controller | Playhead, speed, pause, seeking | Changing canonical outcomes |
| Canvas renderer/audio | Visual and sound presentation of playback state | Scoring, collisions or refereeing |
| React shell | Match selection, controls and inspection | Per-frame physics in React state |

## Core loop

Freeze state at a decision boundary. Build both observations from this same state. Call both controllers concurrently. Lock their responses independently, validate them, resolve failures using a declared bounded policy, and apply both order sets at one effective simulation tick. Advance a fixed number of ticks or stop earlier at a defined interrupt event. Record everything needed to repeat that progression.

Response arrival order must not let one side observe the other side's pending action or move first. Simultaneous conflicting contacts require a documented stable resolution rule that does not systematically favour array order or team colour.

The conceptual observation stream is a sequence of immutable snapshots and events. It does not require a persistent WebSocket to a provider. Token streaming is transport detail: partially generated JSON is never a committed action.

## Four clocks

1. Simulation tick: integer, monotonic, advances the physical world.
2. Playing clock: accumulates eligible ticks toward 180 seconds per half; may pause during restarts.
3. Generation wall time: waiting on inference, retries and local computation; does not alter match results in lockstep mode.
4. Presentation time: timeline containing playable motion, restart transitions, halftime and celebrations; can be paused, sought and sped up.

Use explicit phase and timing mappings. A goal animation must not extend the canonical shot or accidentally allow another goal. Model timeouts are operational limits; record their resolved fallback so replay is repeatable.

At one decision per simulated second, six minutes of active play imply approximately 720 team responses (360 boundaries times two teams), plus extra restart/interrupt decisions and retries. This is a design-budget estimate, not a measured cost or latency promise. Measure shorter test runs before generating many full matches.

## Physical world

Proposed coordinates: metres, x along pitch length, y across width, z upward. Initial field proposal 105 by 68 metres. Team/player IDs remain stable across halves; attack direction changes. Rendering converts these coordinates independently.

Players have position, velocity, facing, radius, locomotion limits, active order and action phase. Ball state includes position/velocity in 3D even though the view is top-down. Aerial movement later enables crosses, catches and shots over the crossbar. Decide possession/contact mechanics explicitly rather than treating the ball as permanently glued to a player.

Use simple explainable execution primitives before complex biomechanics. A movement controller may steer toward an explicitly ordered target with acceleration limits. It must not secretly choose a tactical target. Ball contacts and first-touch assistance need documented, identical rules for both teams.

## Determinism scope

Fixed steps, seeded randomness and stable iteration are necessary, not sufficient. Floating-point transcendental functions, collision ties, rounding and engine changes can cause drift. Start by specifying supported-runtime reproducibility. Add golden PRNG tests, replay state checks and cross-runtime tests before making broader guarantees.

Keep simulation randomness distinct from presentation randomness. Extra confetti must never change the next ball deflection. If no randomness is needed for a mechanic, do not add it for spectacle.

## Two records

The canonical simulation record includes rules/game version, configuration, initial state or seed, applied order batches, effective ticks, explicit fallback decisions and optional checkpoint hashes. Re-simulation requires the compatible engine version; a version string alone does not preserve old code.

The viewer artifact can additionally contain compact state samples/keyframes and ordered events, allowing smooth playback and seeking without inference. Start with enough recording for one local fixture. Add checkpoint intervals and compression after measuring size. Decide whether old games retain a compatible engine or play recorded state samples.

A generation record separately contains exact provider/model identity, prompt/rulebook version, memory policy, budgets, request durations, validation failures and usage when available. Export no credentials. Public inspection shows observations, accepted orders and explicitly retained notes, not invented private reasoning.

## Deployment boundary, later

Initially run generation locally in a Node process with environment-configured credentials and explicit limits; export finished match artifacts. The spectator web app serves and plays those artifacts. Every visitor watching the same match reuses its data. A server-side job system is a later need, not required for the initial demonstration.
