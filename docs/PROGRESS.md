# Shorter matches and team coordination

The current ruleset is football-0.4 with two 120-second halves. Team observations and the shared prompt now support coordinated full-roster decisions. A verified 10.75-second real excerpt is in the viewer; the complete four-minute model run is in progress. Per the user's explicit direction, old viewer recordings and compatibility code have been removed.

## Implemented

- Slice 1: single TypeScript package, pure fixed-step simulation, 22 stable player IDs, ground kicks, first touches/interceptions, explicit order lifetime, canonical recording and smooth playback.
- Original Canvas stadium and animated robot sprites, narrow-screen controls, pause/seek/speed/replay, player numbers, optional decision inspector, local record download.
- Headless fixture and replay verification; tests and browser checks documented in the slice handoff.

- Slice 2: full-match clock, shots/goals/frame contacts, keeper guarding, tackles, body separation, throws/corners/goal kicks and restart setup/delivery. Full scripted match and exact-end replay seeking; 29 tests pass. See [handoff](slices/02-FULL-MATCH-ENGINE.md).

- Slice 3: real simultaneous GPT-5 nano / Gemini 3.1 Flash-Lite decisions, bounded runner, exact observations/prompts/provenance, validated compressed replay import, viewport-first viewer, side inspector, goal celebrations and optional synthetic sound. 41 tests pass. The latest real footage is a 4.3-second playing-time excerpt, not a complete match. See [handoff](slices/03-FIRST-MODEL-POSSESSION.md).

- Slice 4: deterministic tackle fouls, cautions/dismissals, penalties, offside snapshots and indirect free kicks; 59 tests pass. Referee sprite, card signals and incident banners read recorded events. A 6.9-second real excerpt under football-0.3 is preserved. See [handoff](slices/04-REFEREE.md).

- Slice 5: selectable player/order links on the pitch, exact repair-message inspection, generation metadata, lighter initial loading, goal-effect timing and exact replay endpoints. 60 tests pass. See [handoff](slices/05-PLAYER-INSPECTION.md).

- Slice 6: preserved and published the full `north-garden-001` recording with exact prompts, observations, accepted decisions, rejected attempts and one explicit fallback. Generation used 637 paired boundaries and 1,283 requests, taking 63 minutes 40 seconds and an estimated $1.3533. See [complete-match handoff](slices/06-COMPLETE-MODEL-MATCH.md).

- Slice 7: one current two-minute-half ruleset, explicit goal/possession/action context, team failure feedback, whole-roster coordination instructions, and 65 passing tests. The new short model run has 45 full-roster batches out of 48 and no failed execution events. See [handoff](slices/07-SHORTER-COORDINATED-MATCHES.md).

## Code quality agreement

Use descriptive names, explicit units for physics constants, named replay fields, focused functions and components, and Prettier. The user explicitly permits necessary dependencies but wants simple, maintainable code without excessive defensive checks or premature architecture. External JSON remains untrusted and must be validated.

## Next slice

Complete the new four-minute model match and inspect sustained coordination. Then address pass timing and defensive spacing using recorded evidence. Keep outcomes determined by the engine.

## Limitations

- Model football is still rough. More orders and fewer immediate failures do not prove good pass timing or defensive shape. The engine never corrects tactical intent.
- The football-0.4 rules intentionally simplify contact, offside involvement and several referee decisions; [the rules document](04-FOOTBALL-RULES.md) states the omissions.
- Playback is a recording. Observations follow its playhead, not a live provider token stream. Sound is synthetic and muted until enabled; event timing is checked, but there is no human listening assessment.
- The viewer runs locally and can be built as a static site; public deployment is a separate slice. Generation cannot resume a private checkpoint yet.

## Operational notes

`.env` exists and is ignored. Paid test and full-run usage are documented. Its values have not been printed or copied into the browser. Provider IDs/prices/API schemas were checked during integration and should be rechecked when changed. A Vite dev server can select the next available port: use its printed URL, not an assumed port.

The user requested direct work and pushes on `main`; the foundation commits have been fast-forwarded and pushed there. Continue on main.

Latest user direction is implemented: game/viewport by default; optional desktop side panel for clear team/player decisions, exact prompt/rules and observations following playback; goal effects and player celebrations.
