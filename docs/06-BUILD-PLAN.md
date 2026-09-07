# Phased build plan

The destination is a complete LLM-controlled football game. Small slices are implementation steps, not a change of product scope. Each must establish a rules invariant and a visible result.

## 0 — review

Inspect all documents and the image. Propose boundaries, types, tests, file tree and first commits. No code until the user approves.

Exit: agreement on a first slice and consequential decisions.

## 1 — visible deterministic foundation

One strict TypeScript package. Top-down pitch/stadium, 22 identifiable players, team palettes, ball, fixed steps and stable IDs. A small fixture-driven pass-and-move sequence, one useful movement animation and local recording/playback. Fixtures are clearly labelled.

Suggested small commits: scaffolding/coordinate core; movement/pass mechanics and tests; Canvas pitch/simple animated sprites; recording/playback. Refine the sequence in the proposal.

Exit: identical headless and visible outcomes under different render-frame schedules, with intentional visual design.

## 2 — football actions

Receiving/interception, dribbling, shooting, goal detection, keeper execution and tackle primitives. Use defended attacking fixtures; document execution assistance.

Exit: a pass can be received or intercepted; a shot can score, miss or be saved according to mechanics, never hardcoded outcomes.

## 3 — first two-model possessions

Local generation runner, OpenAI/Gemini adapters, common protocol, simultaneous decision barriers, bounded memory, validation/retries and budget controls. See 07-PROVIDERS.md. Begin with a handful of decisions.

Exit: both models issue meaningful legal orders, actions/fallbacks are recorded and replay ignores API timing. Inspect validity rate, idle players, passes, possession changes and missed opportunities. Compare scripted baselines before blaming poor play on models.

## 4 — complete match and basic restarts

Two 180-second halves, swapped directions, kickoffs, boundaries, throw-ins, corners, goal kicks, score and full time. Bounded setup for both teams. Implement height before promising aerial corner deliveries.

Exit: complete short games terminate and replay consistently through stoppages. Display remaining ruleset omissions.

## 5 — officiating

Foul/contact model, free kicks, penalties, cards/dismissals and separately tested offside logic. Referee signals follow events. Advantage can wait.

Exit: representative incidents resolve predictably, orders cannot leak across phases, simplifications approved.

## 6 — broadcast polish

Expand animation and stadium detail; sound, seeking, speed controls, event markers and decision inspection. Evaluate closer top-down tracking. Resolve presentation versus playing time throughout UI.

Exit: a visitor can follow a match and inspect a goal's preceding actions; scrubbing/replaying cannot duplicate state changes or sounds.

## 7 — public website

Small completed-match catalogue and dedicated player pages. Export artifacts/provenance; label fixtures and incomplete runs. Viewer traffic creates no inference calls. Select hosting when the deliverable is ready.

Exit: a shareable match opens without an account/provider key and plays promptly; full matches accompany highlights.

## Later

22 independent controllers, live generation streaming, user-submitted code, accounts/chat, multiple sports, substitutions/injuries, weather, generated commentary, many stadiums and tournament infrastructure.
