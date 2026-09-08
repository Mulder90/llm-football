# Current progress

LLM Football is a replay-first spectator game with 22 robot players, a deterministic football engine, two team controllers and a full-screen comic stadium. The final ruleset has two 60-second playing halves. Watching recordings makes no API calls.

## Final two-minute match — live on Cloudflare

The user requested the final run with one minute per half, and allowed extra spending if needed. `football-0.9` changes only the duration and ruleset version; running speed remains 7 m/s, acceleration 18 m/s², with unchanged ball physics, prompts apart from the interpolated duration, models, cadence and repair policy. The previous match's movement orders averaged about 0.806 pace for both teams. Increasing speed would not ensure better tactics, so no paid speed experiment is being run.

**Two minutes, two models** (`final-match-001`) is the only bundled recording locally and on Cloudflare: **Coral 0–5 Cyan**, exactly 120 playing seconds, halftime at 60 seconds. Independent replay verifies **`fae9b050`**. Simulation lasts 156.75 seconds; stoppages and the existing celebrations make the watch timeline **192.5 seconds (3m 12.5s)**. All five goals belong to Cyan #10. This is the first and only final run; no result was selected or rewritten.

Generation took **53m 35s**, with **247 paired rounds / 501 requests**, seven repaired Coral replies and zero fallbacks. **487/494 first replies** passed; all 494 accepted team batches cover the full active roster. Estimated cost is **$3.022239** ($0.96770625 OpenAI / $2.05453275 Gemini), within the $4 combined / $1.50 / $2.50 ceilings and one-hour deadline. No generation is running.

The match contains 38 completed passes (Coral 24, Cyan 14), 23 shots (Coral 2, Cyan 21), six keeper catches, five distributions and no handling violations or cards. It also contains 55 interceptions and 41 failed actions, mostly tackles that did not reach the carrier. These are preserved football outcomes, not new reasons to tune or rerun. The result is one-sided and does not establish consistently good play.

TypeScript, all 287 tests, the production build, stream import, compressed round trip and independent replay pass. The published file is 3.15 MB compressed / 32.94 MB decoded, within the unchanged 80 MiB viewer limit. Only title/description differ from the untouched private generation file. The user requested committing, pushing and deploying this final result; [slice 28](slices/28-FINAL-MATCH-RELEASE.md) records the verified release. [Decision 014](decisions/014-FINAL-MATCH-DURATION.md) records the duration boundary; [slice 27](slices/27-FINAL-TWO-MINUTE-MATCH.md) retains the generation handoff.

## Previous complete match — archived Playing to win

The authorized local slice uses `football-0.8`: catches retain legal contact XY, held motion follows actual keeper displacement, and kicks/shots preserve the actual launch point. Observations expose neutral goal geometry/pitch clearance and the existing tackle foul test; the prompt explicitly prioritizes scoring more than the opponent. No card thresholds, model settings, cadence or development duration changed. TypeScript and all 287 tests pass.

Short tests used **48 requests**, all accepted first try with complete active-roster orders, at **$0.2836075 estimated** ($0.087967 OpenAI / $0.1956405 Gemini). Eight shot/cutback decisions first exposed the kick-origin error; their original internal 0.7 source/report is preserved, and the accepted choices were re-executed offline under 0.8. Both eight-second paired sequences reached their horizons without repairs, fallbacks, order failures or handling violations. The receiving drill passes its specific criterion; the keeper drill's intended pass was intercepted. That is normal football, not a readiness blocker: the user explicitly wants imperfect LLM tactics to remain.

**Playing to win** (`goal-aware-match-001`) is retained privately, with its original review file/catalogue and 0.8 source. The local and Cloudflare catalogues now contain the final 0.9 match. Cyan wins **3–1** in this preceding review after exactly 60 playing seconds (two 30-second halves). Independent replay verifies hash **`8eed7d0a`**. Both teams shoot and carry; the match contains nine shots, sixteen completed passes, two keeper catches and two throws, including one completed keeper outlet. There are no handling violations or cards. Normal interceptions and unsuccessful actions remain unchanged.

All **210 replies across 105 paired rounds** were accepted first try, with no repairs or fallbacks. One Coral reply omitted #2; 209/210 team batches cover the full active roster. Six tackles fail to reach the carrier and one repeated restart kick executes without foot possession. These outcomes are preserved, not repaired after generation. Generation took **22m 39s**, costing **$1.26326275 estimated** ($0.39642025 OpenAI / $0.8668425 Gemini), within the $1.50 combined / $0.50 / $1 caps and 30-minute deadline. This slice's short tests plus full match total **$1.54687025 estimated**, 258 requests. No generation is running.

The user has now requested the final one-minute-per-half run. [Slice 25](slices/25-CATCH-AND-KICK-GEOMETRY.md) records this preceding review's changes, mechanism, verification and limitations.

The historical public file and catalogue were preserved under ignored `artifacts/private/football-awareness-baseline-public/` before removal from the current catalogue and release. Old recordings retain their original rulesets and outcomes; they are not relabelled for the new engine.

## Website

At the user's request, [the Cloudflare website](https://llm-football.lore-cinque.workers.dev) now serves **Two minutes, two models** as its only bundled recording, with the `football-0.9` engine and unchanged recorded 0–5 result. Release `2be72a68-3f7c-4380-9224-252230cacacb` publishes source `911be81`. All eight live assets match the tested build by SHA-256; eight older recording URLs return 404. Production playback, pause, seek to full time and the single-recording inspector pass with no browser warnings or errors. [Slice 28](slices/28-FINAL-MATCH-RELEASE.md) records the release checks. No model generation ran during deployment.

Cloudflare Web Analytics remains installed using the user's supplied module-script snippet in `index.html`. The public HTML and beacon configuration are unchanged from the analytics release (`ff722704-0ab7-4573-af6a-65b5fa656de4`). Dashboard receipt has not been checked. The browser loads Cloudflare's beacon with the public site token; simulation and recorded outcomes remain independent of analytics. Pushing Git and deploying remain separate actions.

## Previous complete match — archived keeper review

**One minute, two models** (`keeper-era-match-001`) is now retained privately: Cyan wins **1–0** after exactly 60 playing seconds under `football-0.6`. All **96 paired rounds** contain full active-roster orders; **191/192 first replies pass**, with one repaired Coral memory reference and **zero fallbacks**. The match contains eleven completed passes, 38 deliberate carrier-move decisions, three Cyan shots and a catch. Independent replay matches **`ac2a3856`**. [Slice 23](slices/23-ONE-MINUTE-REVIEW.md) records the evidence and limitations.

Generation took **21m 47s** and cost **$1.1262515 estimated** ($0.36848975 OpenAI / $0.75776175 Gemini), using 193 requests within the $3 combined / $1 OpenAI / $2 Gemini caps. The earlier full match cost $2.08662375 with the same recorded model settings and pricing: this run is **46% cheaper**, but different play, rules and prompts prevent attributing the saving to one change. Fresh user-reported balances were $3.17 OpenAI / £5.93 Gemini; estimated remaining credit is roughly **$2.80 / £5.37**, using reference FX rather than confirmed billing. The old short-trial allowance is separate. No generation is running.

**This archived match retains a reproduced keeper defect.** At tick 3245, a legal incoming catch attaches to a keeper facing outward at x=104.6: its 0.65 m hand offset puts the ball at x=105.25, beyond the 105 m goal line. The same tick awards an outside-area free kick; Cyan scores from the subsequent sequence. Original actions and score remain unchanged. This cannot establish successful keeper distribution. Coral also takes no shots and eventually carries out over the goal line. The current 0.8 engine fixes the catch placement; the private historical review retains its original rules and keeper caveat.

## Previous keeper-order reliability work

Keeper-order reliability now passes a small real-provider check: **6/6 first replies accepted**, three paired rounds, eleven orders per team per round, zero repairs, fallbacks, execution failures or handling violations. The keeper catches, rolls to Coral #7, and #7 receives. Both model teams are active. The 2.45-second excerpt stops deliberately at the three-round cap; it does not establish sustained defending or full-match reliability.

The working provider schema is unchanged. Observations now identify the active keeper; the prompt distinguishes outfield move/hold from keeper-only guarding/handling. Invalid recognized actions report their specific field, and role errors name the action and outfielder. No automatic order correction or tactical help was added. Offline replay of all 52 earlier replies preserves all acceptance/rejection results. TypeScript, **258 tests**, production build and replay verification pass.

`keeper-reliability-01` cost **$0.03487 estimated** ($0.01097875 OpenAI / $0.02389125 Gemini), six requests in 42.43 seconds. This used the remaining original allowance, with a separate $0.10 ceiling, no retries and an immediate stop on fallback or incomplete roster. The original trial total is now **$0.47101375** ($0.11885875 OpenAI / $0.352155 Gemini), **67 requests and 435.51 generation seconds**. Remaining: $0.12898625 combined / $0.08114125 OpenAI / $0.047845 Gemini. Estimates include prior reservations without usage and are not confirmed billing. No generation is running.

The **Keeper orders · first-attempt check** recording, hash `86c27e6f`, passing excerpt and separately labelled failed keeper experiment are retained privately. Their compressed catalogue copies were archived before the single-match release. [Slice 22](slices/22-KEEPER-ORDER-RELIABILITY.md) records the change, tests and sample limits. The subsequent funded full match supersedes the earlier deferral and is now the only public recording.

## Previous model excerpts and compatibility work

Two short recordings were previously available in the local catalogue and are now retained privately. The passing excerpt contains 6.7 playing seconds with both model teams active: Coral completes three passes, then loses possession; one tackle misses. It reaches the twelve-round cap before the planned eight playing seconds. The keeper excerpt contains 5.55 seconds, a catch, throw, three further passes and a 3.71 m carry, but **Cyan uses fallback on all seven rounds**. Its opposition is inactive, so this is not evidence of successful two-model keeper buildup. Both remain honestly labelled incomplete.

The Gemini HTTP 400 was isolated to the provider schema’s `batch.orders.maxItems` constraint. Omitting only that wire keyword enabled valid eleven-order replies; the local cap and all football validation stay strict. A subsequent keeper-ID schema experiment eliminated Mini repairs in that sample but produced fourteen malformed Gemini replies and seven fallbacks. That experiment was reverted; the final wire schema exactly matches the successful paired passing trial. Failed responses and original recordings are retained. No engine, tactics, provider model or cadence changed in this slice.

The original $0.60 allowance ($0.20 OpenAI / $0.40 Gemini), 144 attempts and 15 generation minutes covers the initial failed run, six compatibility probes and both excerpts together. Totals: **61 requests, 6m 33s, $0.43614375 estimated** ($0.10788 OpenAI / $0.32826375 Gemini), including conservative reservations for failures without usage. The keeper run stopped before its next Gemini boundary could be fully reserved. This is not confirmed billing. No generation is running. The separate receiver sample was skipped because its starting state is identical to the carrying case apart from match ID; the actual receptions are retained in the first excerpt.

TypeScript, **253 tests**, production build and independent replay verification passed. The passing hash is `def08e93`; the keeper hash is `51cf5d78`. [Slice 21](slices/21-MODEL-SEQUENCES-AND-SCHEMA.md) records accounting, browser checks and limitations. The user deferred the full run until they like the football and add more credit. Cost savings from the earlier leaner prompts and fewer release-triggered requests remain plausible, not a measured full-match result.

## Previous offline harness work

The offline sustained-play harness runs three eight-second scenarios through the real paired scheduler: carrying before pressure, a moving receiver acting after control, and keeper collection/distribution. Two repetitions of each produced **54 paired rounds and 108 scripted calls**, with zero repairs, fallbacks, order failures or paid requests. All six runs reached their horizon and passed the fixed criteria; repeated hashes matched. TypeScript, 242 tests, production build and local import/playback/inspection checks passed. These are scripted infrastructure checks, not measured LLM teamwork. [Slice 19](slices/19-SUSTAINED-PLAY-HARNESS.md) records the results and boundaries.

Use `pnpm evaluate-sequences --dry-run` to inspect the offline plan, then `pnpm evaluate-sequences --name <fresh-name>` to write replayable recordings and a report under ignored `artifacts/private/`. The local viewer can import those excerpts.

## Previous keeper work

**Safe hands, open play** remains available: a 16-second scripted goalkeeper drill under `football-0.6`. It shows pickup, movement in hands, a roll to Coral #3, a scripted opponent return, a catch, and a throw to Coral #6. Both receptions are engine-resolved. The fixture has nine events, no failed orders or handling violations, and verifies independently to hash `5a64393a`. It is not LLM-played and made no provider requests.

Keepers now retain actual hand possession through movement and order expiry, choose roll/throw/punt/put-down, and face explicit handling restrictions and an eight-second playing-time limit. The referee signals the final five seconds and awards a corner for exceeding the limit. Replay preserves pickup/release boundaries even when the owner does not change. Glove poses and quiet catch audio follow recorded state/events. TypeScript, 220 tests, production build and three fixture replays passed; browser checks covered playback and narrow screens. [Slice 18](slices/18-GOALKEEPER-POSSESSION.md) contains the checks and limitations.

The three incompatible public LLM recordings and catalogue entries were removed at that stage. The current single-match catalogue contains the complete keeper-review match; scripted demos remain available in development without backward compatibility or altered historical results.

## Previous visual work

The rendering pass rebuilds the south touchline with north-facing cutaway dugouts, smaller rear/side-facing robot substitutes, distinct coaches and grouped equipment. Sideline robots were reduced after live scale feedback; pitch-player size remains unchanged pending a separate comparison. Drummers now sit within the crowd. Paving, boards and spectator colours are quieter, seating varies in small groups, and pitch markings are drawn as crisp pixels. No match, ruleset, model or audio changes. [Slice 17](slices/17-TOUCHLINE-AND-STADIUM.md) records the implementation and verification.

## Previous controller work

The carrier now chooses whether to dribble, pass or shoot before arranging a receiver. Tactical memory requests three important off-ball jobs while actual orders still cover all eleven players. The response schema stays stable across requests; runtime identity and ownership checks remain strict. Releasing a ball into flight no longer triggers an extra early replan, while reception and phase changes still can.

A bounded five-situation evaluation made 20 requests, all accepted first try with full-roster orders and no own-order execution failures. It produced six deliberate carries of 5–11 m, four successful pressure escapes and three goals from four shooting attempts. Passing remained preferred in one recorded low-pressure possession. This is short-case evidence, not a new full match or proof of sustained teamwork.

Estimated evaluation spending: **$0.10943875** ($0.036166 OpenAI / $0.07327275 Gemini), below the $0.12 / $0.22 provider caps. No generation is running. [Slice 16](slices/16-CARRIER-CHOICES.md) records the setup, measurements, caveats and verification.

The obsolete concept image is removed, the original planning brief is archived, and current guides are separated from historical handoffs. Start at the [documentation index](README.md).

## Previous complete LLM match — previous ruleset

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

Next, prepare accurate X/LinkedIn material from the live **Two minutes, two models** result. [The next-steps plan](06-BUILD-PLAN.md) describes the remaining sequence. Normal LLM mistakes do not require another tuning cycle or a replacement match.

The engine never chooses tactics or repairs a model's chosen target. The latest match demonstrates paired generation, carrying and shots by both models, and a completed keeper outlet. One match cannot establish consistently good teamwork, finishing or defending. A model's written review may be wrong.

The viewer runs locally and on Cloudflare. Live model-token streaming, generation resume, accounts and tournaments are not implemented. The inspector replays recorded observations; browser audio needs a play gesture. See [football rules](04-FOOTBALL-RULES.md) for omitted laws and [providers](07-PROVIDERS.md) for dated pricing assumptions.

## Working agreement and history

Use descriptive names, explicit units, focused modules and Prettier. Work directly on `main` and push approved changes. Keep keys in ignored local configuration. [AGENTS.md](../AGENTS.md) is the current working agreement.

[Historical slice handoffs](slices/README.md) preserve earlier implementation stages and their test counts, prices and results. [Architectural decisions](decisions/README.md) identify choices and superseding amendments. Historical descriptions of drums, longer halves, older prompts or default matches are not current specifications.
