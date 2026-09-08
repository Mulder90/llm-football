# Current progress

LLM Football is a replay-first spectator game with 22 robot players, a deterministic football engine, two team controllers and a full-screen comic stadium. Development matches have two 30-second playing halves. Watching the included recordings makes no API calls.

## Website

Development and readiness checks use the **local build**. The public website is an older release; the user asked to leave it alone and publish the new final version when ready. Pushing Git does not deploy. [Deployment instructions](DEVELOPMENT.md#deploy-the-website-to-cloudflare) remain available for that later step.

## Latest work

Keeper-order reliability now passes a small real-provider check: **6/6 first replies accepted**, three paired rounds, eleven orders per team per round, zero repairs, fallbacks, execution failures or handling violations. The keeper catches, rolls to Coral #7, and #7 receives. Both model teams are active. The 2.45-second excerpt stops deliberately at the three-round cap; it does not establish sustained defending or full-match reliability.

The working provider schema is unchanged. Observations now identify the active keeper; the prompt distinguishes outfield move/hold from keeper-only guarding/handling. Invalid recognized actions report their specific field, and role errors name the action and outfielder. No automatic order correction or tactical help was added. Offline replay of all 52 earlier replies preserves all acceptance/rejection results. TypeScript, **258 tests**, production build and replay verification pass.

`keeper-reliability-01` cost **$0.03487 estimated** ($0.01097875 OpenAI / $0.02389125 Gemini), six requests in 42.43 seconds. This used the remaining original allowance, with a separate $0.10 ceiling, no retries and an immediate stop on fallback or incomplete roster. The original trial total is now **$0.47101375** ($0.11885875 OpenAI / $0.352155 Gemini), **67 requests and 435.51 generation seconds**. Remaining: $0.12898625 combined / $0.08114125 OpenAI / $0.047845 Gemini. Estimates include prior reservations without usage and are not confirmed billing. No generation is running.

The new **Keeper orders · first-attempt check** recording is available locally through **Inside the match → Matches**, hash `86c27e6f`. The passing excerpt remains the default and the older failed keeper experiment remains labelled separately. [Slice 22](slices/22-KEEPER-ORDER-RELIABILITY.md) records the change, tests and sample limits. Next: review this catch-and-outlet clip, then a sustained keeper sequence with both teams active before the deferred full run.

## Previous model excerpts and compatibility work

Two short recordings are available in the **local catalogue**. The default passing excerpt contains 6.7 playing seconds with both model teams active: Coral completes three passes, then loses possession; one tackle misses. It reaches the twelve-round cap before the planned eight playing seconds. The keeper excerpt contains 5.55 seconds, a catch, throw, three further passes and a 3.71 m carry, but **Cyan uses fallback on all seven rounds**. Its opposition is inactive, so this is not evidence of successful two-model keeper buildup. Both remain honestly labelled incomplete.

The Gemini HTTP 400 was isolated to the provider schema’s `batch.orders.maxItems` constraint. Omitting only that wire keyword enabled valid eleven-order replies; the local cap and all football validation stay strict. A subsequent keeper-ID schema experiment eliminated Mini repairs in that sample but produced fourteen malformed Gemini replies and seven fallbacks. That experiment was reverted; the final wire schema exactly matches the successful paired passing trial. Failed responses and original recordings are retained. No engine, tactics, provider model or cadence changed in this slice.

The original $0.60 allowance ($0.20 OpenAI / $0.40 Gemini), 144 attempts and 15 generation minutes covers the initial failed run, six compatibility probes and both excerpts together. Totals: **61 requests, 6m 33s, $0.43614375 estimated** ($0.10788 OpenAI / $0.32826375 Gemini), including conservative reservations for failures without usage. The keeper run stopped before its next Gemini boundary could be fully reserved. This is not confirmed billing. No generation is running. The separate receiver sample was skipped because its starting state is identical to the carrying case apart from match ID; the actual receptions are retained in the first excerpt.

TypeScript, **253 tests**, production build and independent replay verification passed. The passing hash is `def08e93`; the keeper hash is `51cf5d78`. [Slice 21](slices/21-MODEL-SEQUENCES-AND-SCHEMA.md) records accounting, browser checks and limitations. The user deferred the full run until they like the football and add more credit. Cost savings from the earlier leaner prompts and fewer release-triggered requests remain plausible, not a measured full-match result.

## Previous offline harness work

The offline sustained-play harness runs three eight-second scenarios through the real paired scheduler: carrying before pressure, a moving receiver acting after control, and keeper collection/distribution. Two repetitions of each produced **54 paired rounds and 108 scripted calls**, with zero repairs, fallbacks, order failures or paid requests. All six runs reached their horizon and passed the fixed criteria; repeated hashes matched. TypeScript, 242 tests, production build and local import/playback/inspection checks passed. These are scripted infrastructure checks, not measured LLM teamwork. [Slice 19](slices/19-SUSTAINED-PLAY-HARNESS.md) records the results and boundaries.

Use `pnpm evaluate-sequences --dry-run` to inspect the offline plan, then `pnpm evaluate-sequences --name <fresh-name>` to write replayable recordings and a report under ignored `artifacts/private/`. The local viewer can import those excerpts.

## Previous keeper work

**Safe hands, open play** remains available: a 16-second scripted goalkeeper drill under `football-0.6`. It shows pickup, movement in hands, a roll to Coral #3, a scripted opponent return, a catch, and a throw to Coral #6. Both receptions are engine-resolved. The fixture has nine events, no failed orders or handling violations, and verifies independently to hash `5a64393a`. It is not LLM-played and made no provider requests.

Keepers now retain actual hand possession through movement and order expiry, choose roll/throw/punt/put-down, and face explicit handling restrictions and an eight-second playing-time limit. The referee signals the final five seconds and awards a corner for exceeding the limit. Replay preserves pickup/release boundaries even when the owner does not change. Glove poses and quiet catch audio follow recorded state/events. TypeScript, 220 tests, production build and three fixture replays passed; browser checks covered playback and narrow screens. [Slice 18](slices/18-GOALKEEPER-POSSESSION.md) contains the checks and limitations.

The three incompatible public LLM recordings and catalogue entries have been removed; the new catalogue contains only current-ruleset incomplete excerpts. The scripted demo remains available without backward compatibility or altered historical results.

## Previous visual work

The rendering pass rebuilds the south touchline with north-facing cutaway dugouts, smaller rear/side-facing robot substitutes, distinct coaches and grouped equipment. Sideline robots were reduced after live scale feedback; pitch-player size remains unchanged pending a separate comparison. Drummers now sit within the crowd. Paving, boards and spectator colours are quieter, seating varies in small groups, and pitch markings are drawn as crisp pixels. No match, ruleset, model or audio changes. [Slice 17](slices/17-TOUCHLINE-AND-STADIUM.md) records the implementation and verification.

## Previous controller work

The carrier now chooses whether to dribble, pass or shoot before arranging a receiver. Tactical memory requests three important off-ball jobs while actual orders still cover all eleven players. The response schema stays stable across requests; runtime identity and ownership checks remain strict. Releasing a ball into flight no longer triggers an extra early replan, while reception and phase changes still can.

A bounded five-situation evaluation made 20 requests, all accepted first try with full-roster orders and no own-order execution failures. It produced six deliberate carries of 5–11 m, four successful pressure escapes and three goals from four shooting attempts. Passing remained preferred in one recorded low-pressure possession. This is short-case evidence, not a new full match or proof of sustained teamwork.

Estimated evaluation spending: **$0.10943875** ($0.036166 OpenAI / $0.07327275 Gemini), below the $0.12 / $0.22 provider caps. No generation is running. [Slice 16](slices/16-CARRIER-CHOICES.md) records the setup, measurements, caveats and verification.

The obsolete concept image is removed, the original planning brief is archived, and current guides are separated from historical handoffs. Start at the [documentation index](README.md).

## Latest complete LLM match — previous ruleset

**Finding their shape** (`positional-match-001`) was the previous default recording: GPT-5 mini versus Gemini 3.8 Flash, 0–0 after 60 playing seconds. Its 133 paired rounds used 293 requests, including 27 repairs and two explicit Coral fallbacks. Generation took 43m 43s and an estimated $2.08662375; independent replay matches hash `cd60f48a`.

That match predates the latest carrier and scheduling changes. Coral completed more passes than the earlier nano/Flash-Lite baseline, but neither side deliberately selected a carrier move, crowding was broadly unchanged, and all ten shots belonged to Cyan in the first half. [Slice 15](slices/15-QUIET-STADIUM-AND-FOOTBALL.md) retains the full comparison and accounting.

## Implemented boundaries

- Seeded 60 Hz simulation, ground/aerial ball physics, foot/hand possession, keeper distribution and handling rules, passing, shooting, tackles, restarts, halftime and full time.
- Fouls, cards, dismissals, penalties and explicit offside rules with documented simplifications.
- Simultaneous team observations, positional briefs, private tactical memory, bounded repairs and per-provider budgets.
- Validated recordings, deterministic replay verification, import/export and local catalogue publication.
- Whole-pitch default, optional closer camera, team/model labels, replay controls and optional plans/observations/prompts inspector.
- Animated robots, referee, crowd, trees and flags; nine-second corner celebrations with visible opponents; quiet recorded ambience and event sounds.

## Next step and limitations

Next, review the new local keeper excerpt with the user, then check sustained keeper play under active opposition. The six-response check passes but does not establish longer reliability. The full two-half run is deferred until the user likes the football and adds credit. [The next-steps plan](06-BUILD-PLAN.md) describes the remaining sequence. No automatic new run is scheduled.

The engine never chooses tactics or repairs a model's chosen target. These short and partly fallback-driven evaluations cannot establish sustained defensive coordination or full-match cost savings. A model's written review may be wrong.

The viewer runs locally and on Cloudflare. Live model-token streaming, generation resume, accounts and tournaments are not implemented. The inspector replays recorded observations; browser audio needs a play gesture. See [football rules](04-FOOTBALL-RULES.md) for omitted laws and [providers](07-PROVIDERS.md) for dated pricing assumptions.

## Working agreement and history

Use descriptive names, explicit units, focused modules and Prettier. Work directly on `main` and push approved changes. Keep keys in ignored local configuration. [AGENTS.md](../AGENTS.md) is the current working agreement.

[Historical slice handoffs](slices/README.md) preserve earlier implementation stages and their test counts, prices and results. [Architectural decisions](decisions/README.md) identify choices and superseding amendments. Historical descriptions of drums, longer halves, older prompts or default matches are not current specifications.
