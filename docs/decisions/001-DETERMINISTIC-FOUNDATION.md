# 001 — Deterministic football core and recorded presentation

Status: accepted under the user's 2026-09-07 instruction to implement the project, choose sensible defaults, and commit in slices.

## Context and decision

One strict TypeScript package. `src/sim` owns football state and advances only through `step(state)`. It imports only other simulation files. No clock, provider, UI or storage dependencies. Node and the browser can run the same source. React owns controls; Canvas owns per-frame drawing.

Use 60 fixed ticks/second, metres on a 105 × 68 field, and separate monotonically increasing simulation ticks and playing ticks. First slice uses only open play and a terminal stoppage on ball-out; complete restart timing follows in its own slice. Both team batches validate before applying either. Stable player-ID order and a state-carried xorshift32 generator resolve exact contact ties; no randomness is added to improve drama.

Movement is acceleration-limited steering toward an explicitly ordered fixed point, with braking to stop there. There is no automatic chasing or tactical support movement. A possessed ball stays at the carrier's foot while moving (explicit dribbling assistance in this simplified engine). Any loose ground ball crossing a 0.9 m first-touch radius is controlled automatically, regardless of speed, unless the player kicked it in the last 18 ticks. This generous first-touch model is provisional and symmetric. No tackles or player-body collisions yet.

Record initial state, applied batches and ticks, fallbacks, final-state diagnostic hash, ordered events, and readable viewer samples with named fields every three ticks. Compression is deferred until full-match size is measured. Playback interpolates samples and never advances the simulation or calls a model. Hash is FNV-1a over the current engine's JSON state; it detects ordinary accidental drift, is not cryptographic, and is not a permanent archival contract. Re-simulation rejects a mismatched engine version.

Canvas logical resolution is 960 × 660 with a 7 pixels/metre pitch, flat geometry and stable foot anchors. Original code-drawn pixel assets replace the concept screenshot. CSS nearest-neighbour scaling fits the full field at narrow widths; fractional scale can make pixel clusters uneven, so uniform integer pixels across every viewport are not claimed. Drawing rounding never enters simulation state.

## Principal alternative

Run world updates from animation frames and reconstruct replays from model prompts. This would couple outcomes to browser/API timing and would not preserve the decisions actually used. A generic game framework or ECS would add surface before football semantics are established.

## Consequences, evidence and revisit condition

The fixture regenerates and re-simulates identically in Node 24.2. Browser rendering uses its own generated fixture; browser-visible verification is recorded in the slice handoff. Floating-point square roots, arithmetic and future mechanics still limit cross-runtime guarantees. Fixed step alone is not proof of cross-platform bit identity; expand the runtime matrix before making that claim.

Input schema, engine semantics and sample format are versioned separately in code. On semantic changes, bump the engine version and retain old viewer samples. Add checkpoints/compression after measuring full-match artifact size. Revisit receiving assistance after the first real model possessions, collision rules before defended physical play, and numeric representation if verified cross-runtime drift appears.
