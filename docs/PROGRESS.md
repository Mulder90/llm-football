# Current progress

LLM Football is a replay-first spectator game with 22 robot players, a deterministic football engine, two team controllers and a full-screen comic stadium. Development matches have two 30-second playing halves. Watching the included recordings makes no API calls.

## Website

Development and readiness checks use the **local build**. The public website is an older release; the user asked to leave it alone and publish the new final version when ready. Pushing Git does not deploy. [Deployment instructions](DEVELOPMENT.md#deploy-the-website-to-cloudflare) remain available for that later step.

## Latest work

The offline sustained-play harness runs three eight-second scenarios through the real paired scheduler: carrying before pressure, a moving receiver acting after control, and keeper collection/distribution. Two repetitions of each produced **54 paired rounds and 108 scripted calls**, with zero repairs, fallbacks, order failures or paid requests. All six runs reached their horizon and passed the fixed criteria; repeated hashes matched. TypeScript, 242 tests, production build and local import/playback/inspection checks passed. These are scripted infrastructure checks, not measured LLM teamwork. [Slice 19](slices/19-SUSTAINED-PLAY-HARNESS.md) records the results and boundaries.

Use `pnpm evaluate-sequences --dry-run` to inspect the offline plan, then `pnpm evaluate-sequences --name <fresh-name>` to write replayable recordings and a report under ignored `artifacts/private/`. The local viewer can import those excerpts.

## Previous keeper work

**Safe hands, open play** is the new default: a 16-second scripted goalkeeper drill under `football-0.6`. It shows pickup, movement in hands, a roll to Coral #3, a scripted opponent return, a catch, and a throw to Coral #6. Both receptions are engine-resolved. The fixture has nine events, no failed orders or handling violations, and verifies independently to hash `5a64393a`. It is not LLM-played and made no provider requests.

Keepers now retain actual hand possession through movement and order expiry, choose roll/throw/punt/put-down, and face explicit handling restrictions and an eight-second playing-time limit. The referee signals the final five seconds and awards a corner for exceeding the limit. Replay preserves pickup/release boundaries even when the owner does not change. Glove poses and quiet catch audio follow recorded state/events. TypeScript, 220 tests, production build and three fixture replays passed; browser checks covered playback and narrow screens. [Slice 18](slices/18-GOALKEEPER-POSSESSION.md) contains the checks and limitations.

The three incompatible public LLM recordings and catalogue entries have been removed; there is no current-ruleset LLM match yet. The scripted demo keeps the viewer usable without backward compatibility or altered historical results.

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

The next slice is bounded paired-model evaluation on the validated eight-second scenarios. Review the exact configurations, round/request allowance and fresh combined/per-provider budgets before dispatch. Then assess every outcome before a new complete two-half match. [The next-steps plan](06-BUILD-PLAN.md) describes the remaining sequence. No automatic new run is scheduled.

The engine never chooses tactics or repairs a model's chosen target. The two-second evaluations cannot establish longer buildup, defensive coordination or full-match cost savings. A model's written review may be wrong.

The viewer runs locally and on Cloudflare. Live model-token streaming, generation resume, accounts and tournaments are not implemented. The inspector replays recorded observations; browser audio needs a play gesture. See [football rules](04-FOOTBALL-RULES.md) for omitted laws and [providers](07-PROVIDERS.md) for dated pricing assumptions.

## Working agreement and history

Use descriptive names, explicit units, focused modules and Prettier. Work directly on `main` and push approved changes. Keep keys in ignored local configuration. [AGENTS.md](../AGENTS.md) is the current working agreement.

[Historical slice handoffs](slices/README.md) preserve earlier implementation stages and their test counts, prices and results. [Architectural decisions](decisions/README.md) identify choices and superseding amendments. Historical descriptions of drums, longer halves, older prompts or default matches are not current specifications.
