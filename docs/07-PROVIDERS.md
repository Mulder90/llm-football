# Initial providers and low-cost testing

The user has OpenAI and Gemini API keys and wants cheap models first. Keep real keys in an ignored local .env file or the runner environment. .env.example has empty placeholders. Never paste keys into prompts, commit them, use VITE_ prefixes or expose them to the spectator browser.

## Current tested configuration

The original Gemini 2.5 Flash-Lite suggestion returned HTTP 404 on this account in the integration smoke test: unavailable to new users. The runner now deliberately defaults to Gemini 3.1 Flash-Lite (minimal thinking, temperature 0.4), $0.25 input / $1.50 output per million tokens. GPT-5 nano uses low reasoning, after the minimal setting failed to deliver a kickoff. See [decision 003](decisions/003-MODEL-CONTROL-AND-INSPECTION.md) and the [measured test](slices/03-FIRST-MODEL-POSSESSION.md). Prices were rechecked against the official pages linked below on 2026-09-07. No automatic upgrade is permitted.

## Supported model pair

| Provider | Model ID              | Standard text input / 1M tokens | Output / 1M tokens |
| -------- | --------------------- | ------------------------------- | ------------------ |
| OpenAI   | gpt-5-nano            | $0.05                           | $0.40              |
| Gemini   | gemini-3.1-flash-lite | $0.25                           | $1.50              |

These are the only currently configured adapters/prices. The unused Gemini 2.5 branch was removed during the simplification slice. Model availability and the rates above were checked during integration on 7 September 2026 against [OpenAI's model documentation](https://developers.openai.com/api/docs/models/gpt-5-nano) and [Google's pricing](https://ai.google.dev/gemini-api/docs/pricing). Recheck them before changing models or prices. Both providers have completed real requests in this project; football ability still needs evaluation.

Output billing can include reasoning/thinking tokens. Count the rules and retained context as input. Use actual reported usage where available and never promise a per-match cost before measuring representative requests.

## Adapters

One thin adapter per provider returns structured JSON for common validation. The implementation uses the verified structured-output schema subset and validates each provider envelope. Handle refusals, truncated output and empty responses explicitly. Do not assume matching sampling/temperature/reasoning controls across providers; use supported low-cost settings and record them.

No tools, browsing, images or audio required in team requests. Complete JSON must validate before commitment even if transport streams tokens.

## Bounded progression

1. Offline fixtures and mocks by default in tests.
2. One explicit smoke request per provider to check access and output.
3. At most 10 decision boundaries for the first model run: 20 base requests.
4. Measure input/output/reasoning usage, latency, validity and behaviour.
5. Progress through short possessions before full matches.

The runner enforces one retry per team decision, one generation job at a time, bounded input/history/memory, output-token limits, a decision cap and a conservative estimated dollar ceiling.

Reserve budget for both concurrent requests and retry allowance before dispatch. Count SDK retries or disable them in favour of one policy. Stop scheduling, checkpoint and mark incomplete when budget is insufficient. An application dollar estimate is not an absolute billing guarantee, especially with missing usage or changed prices; request/token caps remain enforceable. Fail closed for paid models lacking configured price estimates.

Do not silently upgrade models. Report failure and allow deliberate configuration changes. Save controller configuration in match provenance. Watching/replaying makes zero inference calls.

.env.example now describes the implemented local runner. Browser playback never reads it or calls a provider.
