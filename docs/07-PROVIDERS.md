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

The original cheap pair remains the CLI default. The user approved testing stronger controllers on 8 September 2026. GPT-5 mini uses low reasoning/verbosity, like nano. Gemini 3.8 Flash uses LOW thinking and temperature 1, following the [supported thinking settings](https://ai.google.dev/gemini-api/docs/generate-content/thinking) and [temperature guidance](https://ai.google.dev/gemini-api/docs/gemini-3#temperature). The baseline Flash-Lite configuration remains minimal/0.4 so the comparison preserves its existing configuration. This compares configurations, not model architecture alone.

Prices and API settings were rechecked on 8 September against [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini), [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano) and [Google pricing](https://ai.google.dev/gemini-api/docs/pricing). Future Gemini 3.8 Flash requests now use Google’s current standard introductory prices: $0.75 input / $3.75 output per million tokens, including thinking output, verified on 2026-09-08 and valid through 2026-12-31. Recheck the adapter prices before generation on or after 2027-01-01; Google currently lists $1.50 input / $7.50 output from that date. Earlier trials that captured $1.50 / $7.50 retain those rates and estimates; their accounting is not rewritten. Cached input remains charged at full input price in our estimates. Recheck prices before subsequent configuration changes. All four configurations completed real structured-output requests on this account; unreviewed model IDs still fail closed.

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

The separate `pnpm evaluate-sequences` CLI now exercises repeated paired decisions offline with explicit scripted provenance and zero provider calls. Its callable runner retains the same model budget reservations, but the CLI intentionally exposes no paid configuration. Review the scripted results and a concrete spending allowance before adding and running the paired-model evaluation.

Both CLIs now accept optional `--openai-usd` and `--gemini-usd` ceilings alongside the combined `--usd` limit. Generation also reads `GENERATION_MAX_OPENAI_USD` and `GENERATION_MAX_GEMINI_USD`. These values are all USD estimates; convert a GBP balance before setting the Gemini cap. Omitting a provider cap leaves the combined limit in force; zero prevents a request to that provider. At each boundary, reserve every concurrent request and its full repair allowance against both limits before dispatch. Stop both teams and checkpoint when either provider cannot fund the next boundary. Reports expose `estimatedUsdByProvider`; cancelled or failed requests without usage retain their full reservation. [Decision 009](decisions/009-PROVIDER-BUDGETS.md) records this boundary.

1. Offline fixtures and mocks by default in tests.
2. One explicit smoke request per provider to check access and output.
3. At most 10 decision boundaries for the first model run: 20 base requests.
4. Measure input/output/reasoning usage, latency, validity and behaviour.
5. Progress through short possessions before full matches.

The runner enforces one retry per team decision, one generation job at a time, bounded input/history/memory, output-token limits, a decision cap and a conservative estimated dollar ceiling.

Reserve budget for both concurrent requests and retry allowance before dispatch. Count SDK retries or disable them in favour of one policy. Stop scheduling, checkpoint and mark incomplete when budget is insufficient. An application dollar estimate is not an absolute billing guarantee, especially with missing usage or changed prices; request/token caps remain enforceable. Fail closed for paid models lacking configured price estimates.

Do not silently upgrade models. Report failure and allow deliberate configuration changes. Save controller configuration in match provenance. Watching/replaying makes zero inference calls.

.env.example now describes the implemented local runner. Browser playback never reads it or calls a provider.
