# Slice 18 — Persistent goalkeeper possession

## Result and invariant

Keepers now catch or pick up into actual hand possession, move while holding, and explicitly roll, throw, punt or put the ball down. Handling legality, protected possession and an eight-second playing-time limit belong to the deterministic engine. Controllers choose actions; rendering, audio, playback speed and request arrival cannot decide whether a catch or release succeeds.

The default **Safe hands, open play** fixture is a 16-second scripted drill. It includes pickup, movement while holding, a roll received by Coral #3, a scripted return via Cyan #10, a physical catch, and a throw received by Coral #6. Nine recorded events contain no failed orders or handling violations. Independent replay yields hash `5a64393a`. It contains no model provenance or provider requests.

The old public LLM recordings are incompatible with `football-0.6` and have been removed from the working catalogue. The deployed website remains the earlier release until separately deployed. No full-match outcome was modified and no model match was generated for this slice.

## Implementation

- `sim/ball-control.ts` separates foot/hand position and the four handling histories. `sim/keeper.ts` owns collection, explicit releases, sanctions and the playing-tick timer.
- `guard` resolves an eligible catch at physical ball contact. Movement, hold, expiry and repeated pickup cannot reset hand control. Ordinary foot/body contact remains available when a hand catch is ineligible.
- Protocol observations expose possession mode, remaining ticks and keeper eligibility/action context. New orders are keeper-only, open-play-only and bounded. Runtime validation rejects unsupported delivery, stale/wrong-team identity, non-finite values and out-of-range speed/loft.
- Frame capture and import validation preserve hand ownership and same-owner transitions. Replay still executes accepted decisions without any LLM request.
- Glove/arm poses surround the single rendered ball; a short scoop follows a successful recorded collection. Roll, throw, punt and put-down get release poses. The referee's final-five signal derives from playing ticks. Completed keeper deliveries receive the same causal teammate acknowledgment as other completed passes.
- A quiet 90 ms original synthesized glove sound follows real pickup/save events. Existing audio cancellation and fast-playback suppression apply. No new audio asset or dependency was added.

## Reimplementing the timer and replay boundary

On collection, store `sincePlayingTick = state.playingTicks` and leave it untouched by future movement orders. At each open-play step, execute instantaneous releases first, then tackles, movement and ball physics. Before advancing the clocks, compare `state.playingTicks + 1 - sincePlayingTick` with 480. Values through 480 retain possession; a value of 481 awards the corner and clears hands. Finally increment playing time once for the interval that began in play. This also records an overdue-hold sanction before a same-interval halftime/full-time event.

For the display, calculate `ceil((480 - elapsedPlayingTicks) / 60)` only once at most five seconds remain. A catch event is stamped with the interval's starting simulation tick, while its completed visible frame is at `event.tick + 1`. Scoop animation and audio start on that completed frame. Frame interpolation must compare both owner and hand-control start tick: pickup and put-down can change possession mode without changing owner. Reduced motion uses the canonical held height directly.

## Verification

- `pnpm check`: TypeScript and **220 tests across 27 files passed**. Focused coverage includes both halves, area-line ±0.000001 m boundaries, independent touch histories, protected challenges, all delivery bounds, tick 479/480/481, release at the exact limit and same-tick half endings.
- `pnpm build`: production build passed; browser JavaScript is 436.02 kB, 137.91 kB gzipped. No new dependency or provider SDK enters the viewer.
- `pnpm fixture --keeper`: 960 ticks, 329 samples, nine events, hash `5a64393a`, independent replay verified. Both intended outlet receptions resolve physically.
- `pnpm fixture`: passing baseline verifies to `cdc195ec`. `pnpm fixture --full`: scripted full match completes both 30-second halves, 3–3, with hash `5edf1d97`.
- Import checks reject old engine versions, malformed hand ownership/timers/positions, missing delivery tags, outfield keeper actions, delivery-specific overflow and non-finite numbers. Export/import/replay and same-owner pickup/put-down boundaries pass.
- The existing worst-case UTF-8/control-character memory test passes the unchanged **32 KiB** request cap with full-roster orders and the longest keeper failure feedback. No provider request was used to test the schema.
- Browser preview checked at the normal 664 × 813 viewport and at 390 × 844. Pickup/held-ball/countdown/catch frames, pause/seek, 0.5×/1×/2× playback, mute/unmute, and both camera choices were exercised. Controls and scripted labels remain readable without overlap; whole-pitch player details are necessarily small at 390 px. The temporary viewport was reset, and the preview was left paused on the physical catch. Captured console warning/error logs were empty.
- Reduced-motion collection and arbitrary-seek behavior pass focused tests. Audio tests cover physical frame crossing, backward seeks, fast-playback suppression and existing cancellation lifecycle. Browser controls were exercised, but no subjective listening assessment is claimed.
- Changed-file Prettier, whitespace and local documentation-link checks passed.

The unchanged passing fixture was independently compared with the previous engine from Git: football events and canonical player/ball evolution matched after excluding the new version/handling fields. Its diagnostic hash changes from `891d002e` to `cdc195ec` because those fields are part of canonical serialization.

## Assumptions, limits and next slice

The ball centre determines area eligibility; boundary lines count as inside. A carry violation uses the completed tick's position, not an exact swept crossing. All executed kicks count as deliberate. The engine has no headers, deliberate-trick cautions, attempted-clearance exception or new passive-contact foul model. Guard never deliberately handles an ineligible ball; an explicit illegal pickup is penalized. [Decision 011](../decisions/011-GOALKEEPER-HAND-POSSESSION.md) and the [current rules](../04-FOOTBALL-RULES.md) explain these choices.

The demo establishes physical and replay behavior, not sustained LLM keeper intelligence. Subjective audio listening has not been assessed by the agent. The proposed next slice is an offline 6–10-second evaluation harness using the real paired scheduler and scripted controllers; review that before bounded paid cases and a new complete match.
