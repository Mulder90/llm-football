# Slice 1 — Visible deterministic foundation

## What changed and the invariant

The project now runs locally as a Vite/React/Canvas app. A 24-second fixture places all 22 players in an original top-down stadium. Nine explicit kicks produce eight same-team receptions and one interception through the physics/contact rules. No result is assigned by the fixture.

`src/sim` contains state, math, order validation and fixed updates. `src/fixtures` contains the deliberately scripted orders. `src/recording` captures states and verifies canonical re-simulation. `src/render` and `src/ui` only read the record. `scripts/fixture.ts` runs without a browser. The same accepted orders reproduce the same canonical final state; playback only moves a playhead through recorded samples.

## Maintainability

After the user's review, physics tuning moved to `src/sim/rules.ts`, with units and rationale. The tick orchestration, movement and ball contacts are separate functions/files. Replay frames use named position/velocity/facing fields instead of positional number arrays. UI controls, playback timing, scoreboard and decision inspection have focused components. Prettier formats source and documentation (`pnpm format`, `pnpm format:check`). The canonical checksum stayed unchanged through the refactor. Pixel-art offsets remain local drawing data rather than becoming a catalogue of one-use constants.

## Execution semantics

- At most one order per owned player per batch. Unsupported versions, non-finite/out-of-range values, stale boundaries, wrong ownership and duplicate IDs reject the batch before either team is applied.
- Moves/holds live for 180 ticks (three seconds). Omission continues the current order. Completion/expiry leads to neutral braking. No target is chosen by the engine.
- Ground kicks use an explicit target direction and speed (2–30 m/s); target is not a guaranteed destination. Friction removes 1.4 m/s each second. Kicks execute once at the next fixed update. A kick without possession fails and is consumed.
- Possession follows the carrier's foot. Swept relative player/ball motion detects entry into a 0.9 m receiving circle. Earlier contact wins. Contacts tied within 1e-9 of a tick use the explicit PRNG and stable ID-sorted candidates. The kicker cannot immediately re-receive for 18 ticks.
- Crossing is based on the whole 0.11 m ball. A ball-out stops this fixture engine and clears orders. Restarts are not implemented in this slice.

## Reimplement the movement helper

Each tick, subtract player position from the ordered point to get a delta and its length `d`. Normalize that delta (zero remains zero). Choose desired speed as the minimum of the pace-scaled 7 m/s maximum, `sqrt(2 * 18 * d)` for braking distance, and `d / dt` to limit overshoot. Desired velocity is direction times that speed.

Subtract actual velocity from desired velocity, then cap that change vector's length to `18 * dt` (acceleration in m/s²). Add the capped change to velocity, and integrate position by `velocity * dt`. At expiry, desired velocity becomes zero, so the same acceleration cap provides braking. Record travelled distance for the sprite's walk cycle. Sprite animation never feeds back into position.

## Verification

- `pnpm check`: TypeScript strict checking and eight focused Vitest tests.
- `pnpm build`: production build, with no provider SDK or credentials imported by the browser.
- `pnpm fixture`: 1,440 ticks, 481 samples, 18 contact/kick events; verified canonical hash `dc3e4d38`; approximately 2.5 MiB of uncompressed JSON with readable, named frame fields.
- Tests cover deterministic regeneration/replay, playback at 30/60/144 Hz plus seeking, invalid batches and atomic application, omission/expiry/impossible kicks, PRNG golden values and swept/tied contacts, and whole-ball boundary crossing.
- Browser: inspected original stadium and sprites, played the sequence through its end, restarted it, paused, used keyboard seek and inspected current orders. Checked 390 × 844 viewport with no horizontal overflow. The browser-generated checksum also matched Node (`dc3e4d38`). A fresh browser session after the refactor showed no warnings or errors. Fullscreen, 4× playback and player-number controls were checked as well.

## Numeric and browser details

State samples are every three simulation ticks (20 Hz); interpolation provides presentation at the display's rate. Contact ownership changes remain discrete instead of interpolating the ball through a receiver. Events are stamped with the start tick of the update that resolves them. This permits a small sub-sample visual lag around contacts, to be refined with contact/event-aligned samples.

Physics uses unrounded JavaScript numbers; only drawing snaps pixels. xorshift32 uses explicit unsigned integer state and has golden tests. The replay hash is a diagnostic checksum, not a cryptographic proof. Tested same-runtime reproducibility is narrower than an all-platform determinism guarantee.

The browser hides/pause-resets timing rather than catching up after a hidden tab. Individual large frame gaps are capped at 250 ms of presentation time to avoid jumping past the action. These choices change viewing time, never canonical match time. React sees only throttled UI updates; frame drawing uses refs. StrictMode effect cleanup removes animation frames and listeners.

## Limitations and next slice

This is a labelled fixture, not LLM play and not a complete football game. No shots/goals, tackle/contact fouls, physical body collisions, keeper saves, restarts, halftime, offside, cards or audio yet. Automatic first touches are generous and always succeed within the receiving radius. Players can overlap. The foundation assumes ground kicks while reserving ball height in the state.

Next: establish football actions and the complete match state machine with defended fixtures and boundary tests, then run the first bounded real two-model possession. The user's full goal remains active.
