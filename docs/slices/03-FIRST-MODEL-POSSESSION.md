# Slice 3 — Real model control and a viewport-first broadcast

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

## Result

The latest visible recording is a real, clearly labelled **incomplete LLM excerpt**. GPT-5 nano controls Coral and Gemini 3.1 Flash-Lite controls Cyan. They take the kickoff and play 4.3 seconds of football across ten simultaneous decision boundaries. All 20 replies in this run were accepted, with no repairs or fallbacks. The diagnostic checksum is `07109847`; the compressed viewer artifact is about 70 KiB. The complete-match objective remains active.

The game now fills the window. Site title/marketing sections are removed. An optional side panel identifies each team's model, intent and each player's order; tabs show exact observations updating with playback, rules/prompt, responses/retries, metadata and recording selection/import. The panel overlays on narrow screens. Goal banners and five-player huddles, keeper/tackle poses, synthetic crowd/whistles/contact/goal audio, mute and volume are implemented. Audio is muted until a user gesture.

## Invariant and one mechanism

Model latency cannot change the match. At a boundary, serialize both observations first. Dispatch both requests, keeping state frozen. If one response is valid, hold it unchanged while repairing only the invalid opponent against the same serialized input. Once both are settled, validate both batches against the original state and apply them in stable order. Advance one engine tick, capture and checkpoint. The replay consumes those recorded batches at their original ticks without a provider connection. The request IDs and exact input strings let a reader audit that process.

The schema constrains identity fields but does not choose football actions. Delivery instructions say who is legally allowed to restart, leaving target, speed, loft and teammates' orders to the models. A run that never delivers is abandoned, as demonstrated by an earlier private test.

## Verification and measured evidence

- 41 tests pass, including atomic repair/locking, hidden-observation exclusions, rejection/fallback limits, cost reservation before dispatch, incomplete checkpoint replay, recording corruption rejection, sound event boundaries and presentation-only celebrations.
- Strict TypeScript, production build, Prettier and whitespace checks pass. Production JS is about 110 KiB gzipped; the first LLM excerpt is about 70 KiB gzipped.
- The successful model test used 20 requests and reported an estimated $0.01850735 of token usage. This is measured for the short test, not a promised full-match cost.
- Browser checks at desktop and 390×844 verify viewport height, no horizontal overflow, compressed record loading, team/player labels, observation advancement and rewind, exact endpoint, sound controls and a recorded goal banner/huddle. Audio controls were exercised; this is not a claim of a human listening test.
- The first compressed-file browser check exposed double decompression under Vite's Content-Encoding header; the loader was corrected. The first provider tests exposed unsupported `oneOf`, an incremented decision identity, duplicated keeper orders and a model unavailable to this account. Corrections and the deliberate model change are recorded in decision 003.
- The production bundle and exported replay were scanned against the actual local credentials without printing them. Neither contained a key.

## Assumptions, limitations and next slice

One model per team and a shared public observation are the chosen game format, not a scientific claim that different providers/settings have equal intelligence. A short successful possession does not establish tactical quality for six minutes. Current rules still omit the referee mechanics listed in decision 002. JSON import supports the current engine version, not arbitrary historical engines. Full match files are generated locally before being served; the browser does not generate them live.

Next: implement focused foul/card/penalty/offside rules, update the shared rulebook, then progress through a longer model run to a complete two-half recording. Keep outcomes honest and retain failed runs as incomplete. Continue committing and pushing directly to `main`.
