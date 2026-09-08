# Tactical memory and clearer football

The latest complete match is **Finding their shape** (`positional-match-001`): GPT-5 mini versus Gemini 3.8 Flash, two 30-second playing halves, finishing 0–0. It took 43m 43.3466s and 293 requests across 133 paired rounds. Independent replay verified hash `cd60f48a`; the recording is published locally with two explicit Coral fallbacks. Match estimates were $0.68721075 OpenAI / $1.399413 Gemini, $2.08662375 combined. Including readiness checks, the slice used an estimated $2.12030425; cached-input discounts are not applied. See the [quiet stadium and football handoff](slices/15-QUIET-STADIUM-AND-FOOTBALL.md) for full accounting, definitions and findings.

Coral sent more kicks successfully to teammates, and Cyan stopped assigning identical move targets within individual batches. Actual close crowding did not improve, neither team produced a continuous carry of at least two metres, and the models never chose a new carrier move at a controlled-ball open-play decision. All ten shots belonged to Cyan in the first half. This single match changes both controllers and prompts relative to the older baseline, so it cannot isolate the effect of positional briefs. Quiet real stadium ambience has replaced synthesized percussion; approved whistles and the goal roar remain.

The current ruleset is football-0.5 with two 30-second development halves. Each controller carries structured tactical memory, receives positional briefs and the complete public rosters, and must choose its own movements and coordination. A readiness check clarified that the memory’s ball player must always be an own teammate, even when defending. The user’s priority remains entertaining football. An earlier one-minute baseline, `tactical-memory-match-001`, took 27m 05.8s and an estimated $0.6361; its historical results and handoffs remain useful for comparison.

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

- Slice 14: comic score tiles and goal/kickoff/interval/referee announcements, nine-second corner celebrations, visible disappointed opponents and correct airborne-scorer layering. Larger supporter waves and an edited licensed stadium-goal recording replace the studio applause. Shared presentation sampling, paused-render cleanup, consolidated CSS and separate provider budget caps are implemented. No model calls or simulation changes. See [handoff](slices/14-COMIC-MATCHDAY.md).

- Slice 15: quiet recorded stadium ambience replaces all percussion, while approved whistles and the goal roar remain. Positional readiness checks led to clearer own-player memory guidance and actionable repair feedback. All 172 tests pass. The complete mini/Flash match, Finding their shape, finishes 0–0 and replay-verifies as `cd60f48a`; passing receipts improve for Coral, but carrying and actual spacing still need work. Match plus readiness estimates total $2.12030425. See [handoff](slices/15-QUIET-STADIUM-AND-FOOTBALL.md).

## Code quality agreement

Use descriptive names, explicit units for physics constants, named replay fields, focused functions and components, and Prettier. The user explicitly permits necessary dependencies but wants simple, maintainable code without excessive defensive checks or premature architecture. External JSON remains untrusted and must be validated.

## Next slice

Proposed: avoid early replanning solely on controlled-to-loose ball releases, use stable provider schemas where possible to support caching, and shorten/clarify tactical memory. In the completed match, release-only ownership changes explain 19 of 133 rounds (14.3%); removing them would change football as well as request volume, so this is not a savings forecast. Validate carrier choices, receiver timing and defensive recovery in short situations before another paid match. These changes are not implemented, and no further paid generation starts automatically.

## Limitations

- Model football is still rough. Structured assignments and fewer immediate failures do not prove good pass timing or defensive shape. A model's review may be inaccurate, and the engine never corrects tactical intent or spreads players into better positions.
- The football-0.5 rules intentionally simplify contact, offside involvement and several referee decisions; [the rules document](04-FOOTBALL-RULES.md) states the omissions.
- Playback is a recording. Observations follow its mapped recording time, not a live provider token stream. Sound starts on the user's play gesture and can be muted before starting. The user approved the revised whistle and rejected the synthetic crowd voice; no agent listening assessment is claimed.
- The viewer runs locally and can be built as a static site; public deployment is a separate slice. Generation cannot resume a private checkpoint yet.

## Operational notes

`.env` exists and is ignored. Paid test and full-run usage are documented. Its values have not been printed or copied into the browser. Provider IDs/prices/API schemas were checked during integration and should be rechecked when changed. A Vite dev server can select the next available port: use its printed URL, not an assumed port.

The user requested direct work and pushes on `main`; the foundation commits have been fast-forwarded and pushed there. Continue on main.

The viewport-first presentation, optional desktop side panel, exact prompt/rules and observation replay, goal effects and player celebrations remain available. The current work includes controller memory, football spacing and the presentation improvements approved while the evaluation ran.
