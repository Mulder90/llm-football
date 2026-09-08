# Tactical memory and clearer football

The current ruleset is football-0.5 with two 30-second development halves. Each controller now carries structured tactical memory, sees nearest-teammate spacing alongside the complete public rosters, and receives explicit guidance to distribute off-ball jobs and targets. The user's priority is entertaining football before more broadcast or rendering work. A complete one-minute model match is now published locally: generation took 27m 05.8s and an estimated $0.6361. Its first half shows much less Cyan crowding; Coral remains prone to repeated intercepted keeper passes. The user also approved stadium, player, goal and referee presentation improvements during generation.

At the user's request, `coordination-match-001` was stopped after 129.3667 playing seconds, with saved estimated usage of $1.008124. Its private incomplete checkpoint remains diagnostic evidence. Previous public recordings are removed, and no compatibility layer is maintained. The entries below describe historical slices and their evidence at the time; older artifacts are not current viewer content.

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

- Slice 8: structured team plans with validated player references, private carry-forward and fallback preservation; opponent-awareness and spacing guidance; nearest-teammate geometry; 30-second halves and a readable inspector view of each recorded plan. The scripted baseline completes one minute of play with unchanged physical rules. Verification and model-run evidence are tracked in the [handoff](slices/08-TACTICAL-MEMORY.md).

- Slice 9: supporter sections, varied crowd/flag animation, expressive robot poses, a causal animated referee and synchronized net/goal/huddle effects. These read the recording without changing it. All 80 tests pass; production build, full 1× browser playback and export checks pass. See [handoff](slices/09-LIVELIER-BROADCAST.md).

- Slice 10: full-screen stadium with compact TV overlays and simpler optional explanations, six-second goal celebrations on a separate watch timeline, animated trees, clearer ball height, and scripted carrying/chipping practice. Live user feedback shaped deeper 130 BPM drums, the approved whistle, a licensed recorded goal cheer, and removal of synthetic crowd voices/claps. All 98 tests pass, as do the build, full 1× browser playback, exact slider endpoints and export checks. See [handoff](slices/10-MATCHDAY-FEEL.md).

- Slice 11: controller names under teams, Whole pitch on by default with an optional closer camera, individual robot mannerisms, scorer jump/turn/wide-arm landing, receiver/event reactions and fluttering corner/stand flags. All 116 tests pass. A fixed-situation evaluation supports testing GPT-5 mini against Gemini 3.8 Flash; their fresh match was stopped on user request after 25.95 playing seconds, 0–0, with a conservative $1.3133 estimate. It remains explicitly unfinished in Matches as Finding their feet; the earlier complete match remains the default. Both the generation and its lower-budget guard exited. See [handoff](slices/11-CHARACTER-AND-CONTROLLERS.md).

- Slice 12: shared recorded moments synchronize attacking percussion, supporter buildup and opposing crowd reactions. Cyan retains the turning leap; Coral has two compact hops, with actual saves, near misses and completed passes driving brief robot gestures. Future observations include seven positional briefs and receiver-arrival guidance. Offline verification and limitations are in the [handoff](slices/12-ANTICIPATION-AND-ROLES.md); no paid generation was started.

- Slice 13: toy-like expressive robot helmets, event punctuation and carrying puffs, reacting coaches/bench crews, club pennants and tiny drummers. Playback controls disappear after 2.8 seconds of idle play with keyboard/pointer safeguards. Opening-half presentation places the taker and support near the centre and respects referee geometry without rewriting recorded play. All 156 tests pass; no paid generation or engine change. See [handoff](slices/13-PLAYFUL-BROADCAST.md).

## Code quality agreement

Use descriptive names, explicit units for physics constants, named replay fields, focused functions and components, and Prettier. The user explicitly permits necessary dependencies but wants simple, maintainable code without excessive defensive checks or premature architecture. External JSON remains untrusted and must be validated.

## Next slice

Proposed: evaluate defensive recovery and receiver arrival on frozen situations before another model match, once a paid evaluation budget is agreed. Positional briefs now explain stable starting responsibilities alongside temporary tactical jobs. They do not add automatic positioning or prove improved play. No further paid generation is scheduled; the user explicitly stopped the latest run.

## Limitations

- Model football is still rough. Structured assignments and fewer immediate failures do not prove good pass timing or defensive shape. A model's review may be inaccurate, and the engine never corrects tactical intent or spreads players into better positions.
- The football-0.5 rules intentionally simplify contact, offside involvement and several referee decisions; [the rules document](04-FOOTBALL-RULES.md) states the omissions.
- Playback is a recording. Observations follow its mapped recording time, not a live provider token stream. Sound starts on the user's play gesture and can be muted before starting. The user approved the revised whistle and rejected the synthetic crowd voice; no agent listening assessment is claimed.
- The viewer runs locally and can be built as a static site; public deployment is a separate slice. Generation cannot resume a private checkpoint yet.

## Operational notes

`.env` exists and is ignored. Paid test and full-run usage are documented. Its values have not been printed or copied into the browser. Provider IDs/prices/API schemas were checked during integration and should be rechecked when changed. A Vite dev server can select the next available port: use its printed URL, not an assumed port.

The user requested direct work and pushes on `main`; the foundation commits have been fast-forwarded and pushed there. Continue on main.

The viewport-first presentation, optional desktop side panel, exact prompt/rules and observation replay, goal effects and player celebrations remain available. The current work includes controller memory, football spacing and the presentation improvements approved while the evaluation ran.
