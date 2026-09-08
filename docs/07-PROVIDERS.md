# Providers and bounded evaluation

The runner supports a cheap default pair and the stronger pair used by the latest completed match: GPT-5 mini and Gemini 3.8 Flash. Keep real keys in an ignored local .env file or the runner environment. .env.example has empty placeholders. Never paste keys into prompts, commit them, use VITE_ prefixes or expose them to the spectator browser.

## Current tested configuration

The original Gemini 2.5 Flash-Lite suggestion returned HTTP 404 on this account in the integration smoke test: unavailable to new users. The runner now deliberately defaults to Gemini 3.1 Flash-Lite (minimal thinking, temperature 0.4), $0.25 input / $1.50 output per million tokens. GPT-5 nano uses low reasoning, after the minimal setting failed to deliver a kickoff. See [decision 003](decisions/003-MODEL-CONTROL-AND-INSPECTION.md) and the [measured test](slices/03-FIRST-MODEL-POSSESSION.md). Prices were rechecked against the official pages linked below on 2026-09-07. No automatic upgrade is permitted.

## Reviewed model configurations

| Provider | Model ID              | Standard text input / 1M tokens | Output / 1M tokens |
| -------- | --------------------- | ------------------------------- | ------------------ |
| OpenAI   | gpt-5-nano            | $0.05                           | $0.40              |
| Gemini   | gemini-3.1-flash-lite | $0.25                           | $1.50              |
| OpenAI   | gpt-5-mini            | $0.25                           | $2.00              |
| Gemini   | gemini-3.8-flash      | $0.75 introductory              | $3.75 introductory |

The original cheap pair remains the full-match generation default. The user approved testing stronger controllers on 8 September 2026. GPT-5 mini uses low reasoning/verbosity, like nano. Gemini 3.8 Flash uses LOW thinking and temperature 1, following the [supported thinking settings](https://ai.google.dev/gemini-api/docs/generate-content/thinking) and [temperature guidance](https://ai.google.dev/gemini-api/docs/gemini-3#temperature). The baseline Flash-Lite configuration remains minimal/0.4 so the comparison preserves its existing configuration. This compares configurations, not model architecture alone.

Prices and API settings were rechecked on 8 September against [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini), [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano) and [Google pricing](https://ai.google.dev/gemini-api/docs/pricing). Future Gemini 3.8 Flash requests now use Google’s current standard introductory prices: $0.75 input / $3.75 output per million tokens, including thinking output, verified on 2026-09-08 and valid through 2026-12-31. Recheck the adapter prices before generation on or after 2027-01-01; Google currently lists $1.50 input / $7.50 output from that date. Earlier trials that captured $1.50 / $7.50 retain those rates and estimates; their accounting is not rewritten. Cached input remains charged at full input price in our estimates. Recheck prices before subsequent configuration changes. All four configurations completed real structured-output requests on this account before the keeper-era schema change; unreviewed model IDs still fail closed.

An earlier fixed-situation comparison motivated trying mini against Flash 3.8: both retained possession in 6 of 8 two-second cases, versus 1/8 for nano and 0/8 for Flash-Lite. This small development evaluation is not a general model ranking or proof of sustained match quality. See [the character and controller handoff](slices/11-CHARACTER-AND-CONTROLLERS.md).

```sh
pnpm evaluate-controllers --dry-run --models gpt-5-mini,gemini-3.8-flash --scenarios carry-space,pass-pressure,shooting-chance --repetitions 2
pnpm evaluate-controllers --name comparison-01 --models gpt-5-mini,gemini-3.8-flash --scenarios carry-space,pass-pressure,shooting-chance --usd .34 --openai-usd .12 --gemini-usd .22 --repetitions 2
OPENAI_MODEL=gpt-5-mini GEMINI_MODEL=gemini-3.8-flash pnpm generate --decisions 10 --usd .5 --name stronger-trial
```

The comparison runner provides five deterministic 22-player situations: carrying space, pass pressure, a blocked lane, keeper distribution and an open shot. Optional recorded possessions reconstruct exact states and prior memory from accepted match decisions, using the opponent batch at that boundary. Opposition does not replan within the two-second case. Every controller receives identical observation/rulebook bytes, including the actual two-second evaluation horizon. It permits one repair, reserves all concurrent requests and repair allowance, shares the generation lock, and writes exact private observations/replies/configurations plus actual engine outcomes. Invalid replies have no football outcome; they are not replaced by invented tactics. A permanent provider failure is tried once and remains visible as an incomplete comparison. The report and any practice footage are not a model-versus-model match.

Output billing can include reasoning/thinking tokens. Count the rules and retained context as input. Use actual reported usage where available and never promise a per-match cost before measuring representative requests.

## Adapters

One thin adapter per provider returns structured JSON for common validation. The implementation uses the verified structured-output schema subset and validates each provider envelope. Handle refusals, truncated output and empty responses explicitly. Do not assume matching sampling/temperature/reasoning controls across providers; use supported low-cost settings and record them.

The same stable JSON schema is sent across requests. Changing identity values are copied from the observation and checked against the frozen state in code. Repeated-prefix reuse is possible, but cache hits and latency are measured rather than guaranteed. Input estimates still ignore cache discounts.

No tools, browsing, images or audio are required in team requests. Complete JSON must validate before commitment even if transport streams tokens.

The latest [carrier-choice evaluation](slices/16-CARRIER-CHOICES.md) accepted 20/20 responses first try at an estimated $0.10943875. Short-case behavior and per-request timing do not predict a complete game.

## Bounded progression

`pnpm evaluate-sequences` defaults to repeated paired decisions offline with explicit scripted provenance and zero provider calls. Its explicit `--mode models` option uses the reviewed mini/Flash pair and requires combined, OpenAI and Gemini allowances. Every dry run remains offline and skips credential loading. The job shares spending, requests and wall time across scenarios; it stops at the first incomplete scenario and retains failed football criteria without reruns. See [the development commands](DEVELOPMENT.md#evaluate-sustained-play-with-models).

The first paired three-scenario trial had one eight-second repetition each, at most 12 paired boundaries per scenario, 144 request attempts including repairs and a shared 15-minute deadline. The user approved $0.60 combined ($0.20 OpenAI / $0.40 Gemini) for this run. Mini and Flash prices were checked again against the official pages above on 2026-09-08 and match the adapters. Configured local credentials are present; their presence does not establish available credit. `sustained-model-01` stopped on its first boundary: Gemini returned HTTP 400 with the generic “Request contains an invalid argument” message. No team pair was committed. Three requests (including one accepted OpenAI repair) produced a conservative $0.047654 estimate: $0.007718 OpenAI and $0.039936 Gemini reservation without reported usage. Do not call that confirmed billing or a completed model sequence. The follow-up diagnosis isolated `maxItems: 11` on `batch.orders` as the triggering provider constraint. Removing only that wire keyword produced a valid eleven-order Gemini reply; the local eleven-order cap remains strict. `sustained-model-02` then produced 6.7 playing seconds with both models active, three completed passes and no fallback, stopping at its twelve-round cap. A keeper-ID schema experiment in `sustained-keeper-01` produced invalid Gemini output on all fourteen attempts; Cyan fell back on seven rounds. That experiment was reverted to the successful paired-trial wire schema. Its catch/throw/carry footage has inactive opposition and is labelled accordingly.

After clearer keeper instructions and specific field feedback, `keeper-reliability-01` accepted all six first attempts over three paired rounds, with full rosters, zero fallbacks and no execution failures. This small check disabled repairs, retained the 4096-output-token/32 KiB-input limits, and capped spending at $0.10 ($0.04 OpenAI / $0.06 Gemini) within the original unspent allowance. It stopped at the planned three-round limit after a keeper catch, roll and reception. Cost: $0.03487, including $0.01097875 OpenAI / $0.02389125 Gemini; 42.43 generation seconds. The production repair policy is unchanged. [Slice 22](slices/22-KEEPER-ORDER-RELIABILITY.md) records the first-attempt check.

The entire approved trial now totals **67 requests, 435.508 generation seconds and $0.47101375 estimated**: $0.11885875 OpenAI / $0.352155 Gemini. Failed requests without usage retain conservative reservations; this is not confirmed billing. Remaining allowances are $0.12898625 combined / $0.08114125 OpenAI / $0.047845 Gemini. The latter is below the $0.079872 reservation needed for a normal paired boundary with repairs. No generation is running and no allowance resets on a new CLI invocation. The full run is deferred pending the user’s review and additional credit. [Slice 21](slices/21-MODEL-SEQUENCES-AND-SCHEMA.md) records the full ledger and results; [slice 20](slices/20-PAIRED-MODEL-TRIAL.md) retains the original failure.

The full-match and older single-decision comparison CLIs accept optional `--openai-usd` and `--gemini-usd` ceilings alongside the combined `--usd` limit. Generation also reads `GENERATION_MAX_OPENAI_USD` and `GENERATION_MAX_GEMINI_USD`. These values are all USD estimates; convert a GBP balance before setting the Gemini cap. Omitting a provider cap leaves the combined limit in force; zero prevents a request to that provider. At each boundary, reserve every concurrent request and its full repair allowance against both limits before dispatch. Stop both teams and checkpoint when either provider cannot fund the next boundary. Reports expose `estimatedUsdByProvider`; cancelled or failed requests without usage retain their full reservation. [Decision 009](decisions/009-PROVIDER-BUDGETS.md) records this boundary.

1. Offline fixtures and mocks by default in tests.
2. One explicit smoke request per provider to check access and output.
3. At most 10 decision boundaries for the first model run: 20 base requests.
4. Measure input/output/reasoning usage, latency, validity and behaviour.
5. Progress through short possessions before full matches.

The runner enforces one retry per team decision, one generation job at a time, bounded input/history/memory, output-token limits, a decision cap and a conservative estimated dollar ceiling.

Reserve budget for both concurrent requests and retry allowance before dispatch. Count SDK retries or disable them in favour of one policy. Stop scheduling, checkpoint and mark incomplete when budget is insufficient. An application dollar estimate is not an absolute billing guarantee, especially with missing usage or changed prices; request/token caps remain enforceable. Fail closed for paid models lacking configured price estimates.

Do not silently upgrade models. Report failure and allow deliberate configuration changes. Save controller configuration in match provenance. Watching/replaying makes zero inference calls.

.env.example now describes the implemented local runner. Browser playback never reads it or calls a provider.
