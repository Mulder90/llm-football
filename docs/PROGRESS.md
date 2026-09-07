# The first complete LLM match

The first complete model-controlled game is recorded and replay-verified: `north-garden-001`, GPT-5 nano versus Gemini 3.1 Flash-Lite. Both 180-second playing halves completed, with a final score of Coral 1–2 Cyan and canonical replay hash `f0421b48`. The default viewer loads the full recording.

## Implemented

- Slice 1: single TypeScript package, pure fixed-step simulation, 22 stable player IDs, ground kicks, first touches/interceptions, explicit order lifetime, canonical recording and smooth playback.
- Original Canvas stadium and animated robot sprites, narrow-screen controls, pause/seek/speed/replay, player numbers, optional decision inspector, local record download.
- Headless fixture and replay verification; tests and browser checks documented in the slice handoff.

- Slice 2: full-match clock, shots/goals/frame contacts, keeper guarding, tackles, body separation, throws/corners/goal kicks and restart setup/delivery. Full scripted match and exact-end replay seeking; 29 tests pass. See [handoff](slices/02-FULL-MATCH-ENGINE.md).

- Slice 3: real simultaneous GPT-5 nano / Gemini 3.1 Flash-Lite decisions, bounded runner, exact observations/prompts/provenance, validated compressed replay import, viewport-first viewer, side inspector, goal celebrations and optional synthetic sound. 41 tests pass. The latest real footage is a 4.3-second playing-time excerpt, not a complete match. See [handoff](slices/03-FIRST-MODEL-POSSESSION.md).

- Slice 4: deterministic tackle fouls, cautions/dismissals, penalties, offside snapshots and indirect free kicks; 59 tests pass. Referee sprite, card signals and incident banners read recorded events. A 6.9-second real excerpt under football-0.3 is preserved. See [handoff](slices/04-REFEREE.md).

- Slice 5: selectable player/order links on the pitch, exact repair-message inspection, generation metadata, lighter initial loading, goal-effect timing and exact replay endpoints. 60 tests pass. See [handoff](slices/05-PLAYER-INSPECTION.md).

- Slice 6: preserved and published the full `north-garden-001` recording with exact prompts, observations, accepted decisions, rejected attempts and one explicit fallback. Generation used 637 paired boundaries and 1,283 requests, taking 63 minutes 40 seconds and an estimated $1.3533. See [complete-match handoff](slices/06-COMPLETE-MODEL-MATCH.md).

## Code quality agreement

Use descriptive names, explicit units for physics constants, named replay fields, focused functions and components, and Prettier. The user explicitly permits necessary dependencies but wants simple, maintainable code without excessive defensive checks or premature architecture. External JSON remains untrusted and must be validated.

## Next slice

Improve controller comprehension, particularly direction after the halftime end swap and actions that require ball ownership. Keep this first recording as the baseline; do not replace its mistakes with scripted play or choose a result for drama.

## Limitations

- Model football is still rough. Coral's two conceded goals follow its own wrong-end shots after halftime; failed orders remain visible in the record. The engine never corrects tactical intent.
- The football-0.3 rules intentionally simplify contact, offside involvement and several referee decisions; [the rules document](04-FOOTBALL-RULES.md) states the omissions.
- Playback is a recording. Observations follow its playhead, not a live provider token stream. Sound is synthetic and muted until enabled; event timing is checked, but there is no human listening assessment.
- The viewer runs locally and can be built as a static site; public deployment is a separate slice. Generation cannot resume a private checkpoint yet.

## Operational notes

`.env` exists and is ignored. Paid test and full-run usage are documented. Its values have not been printed or copied into the browser. Provider IDs/prices/API schemas were checked during integration and should be rechecked when changed. A Vite dev server can select the next available port: use its printed URL, not an assumed port.

The user requested direct work and pushes on `main`; the foundation commits have been fast-forwarded and pushed there. Continue on main.

Latest user direction is implemented: game/viewport by default; optional desktop side panel for clear team/player decisions, exact prompt/rules and observations following playback; goal effects and player celebrations.
