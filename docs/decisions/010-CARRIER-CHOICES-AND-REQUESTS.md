# Decision 010 — Carrier choices and leaner model requests

Status: accepted under the user's approval to work on carry/pass/shoot choices and reduce unnecessary replanning and response size. This amends decision 003's identity schemas and release-triggered cadence, and decision 006's full-roster memory guidance. The user also approved removing obsolete visual guidance and refreshing the docs.

## Evidence

The complete `positional-match-001` had 133 paired rounds and 293 requests, including 27 repairs. Nineteen rounds were triggered only by a controlled ball becoming loose. Neither model issued a new carrier move at an open-play possession boundary. The prompt explained dribbling, but its possession guidance also immediately directed the carrier and receiver to arrange a pass. Repeated pass-memory relationships caused most rejected responses.

## Decision

Choose carrying, passing or shooting before arranging a receiver. Carry into useful open space, release to a better reachable outlet or escape pressure, and shoot from a credible angle and range. The restart taker still must kick. No movement helper makes this choice or corrects targets.

Keep tactical memory to short notes and up to three important off-ball assignments in the prompt, while still ordering every active player. A pass note describes a kick issued now; otherwise return null. The kicker and receiver must differ. These are clearer output instructions, not a new memory format or weaker validation. Existing recordings retain their exact inputs and remain playable.

Use one stable response schema across requests. Put changing match, team, tick and decision values in the observation and continue validating them against the frozen state after parsing. The schema no longer changes on every boundary. Providers can reuse repeated prefixes, but this is an opportunity, not a promised cache hit or speedup. See the official [OpenAI caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) and [Gemini caching guide](https://ai.google.dev/gemini-api/docs/generate-content/caching).

Keep the one-second decision interval and phase interrupts. A release into loose flight no longer causes an extra request. Gaining control can interrupt once 15 ticks have elapsed since the previous decision. Track a null owner even without asking the models, so a later recapture can be noticed. Existing orders continue only through their existing lifetime; no pass, tackle or movement is synthesized. Both teams always receive the same boundary.

## Alternatives and tradeoffs

A slower fixed cadence would save more calls but delay important receptions and turnovers. Automatic chasing, dribbling or spreading would change who controls football. This slice instead removes one redundant trigger and clarifies the existing action choice.

A loose-ball chase may now wait until the regular one-second interval. Fewer memory assignments may reduce continuity if the wrong jobs are omitted. Runtime identity rejection may reveal errors previously constrained by the provider's changing schema. These effects need measured short cases and later full-match review.

## Verification

Offline tests exercise a received pass, a subsequent aerial release without an extra early round, restart boundaries, stable provider schemas and rejected stale/wrong-team identities. Snapshot evaluation works for either team and replays the exact recorded state before trying a new batch against the opposition's recorded batch. A separate shooting fixture resolves both a goal and a miss through physics.

The bounded evaluation accepted all 20 responses on their first attempt, all with eleven orders and three memory assignments. It produced six deliberate carries over two metres, successful pressure escapes and three goals from four shooting attempts. It also retained a preference for passing in the recorded Cyan possession. Cost, timing and limitations are in [slice 16](../slices/16-CARRIER-CHOICES.md). This does not establish full-match improvement or isolate the effect of each change.

Revisit sustained carrier decisions and receiver timing next. Prefer short measured possessions before another full paid game.
