# Initial providers and low-cost testing

The user has OpenAI and Gemini API keys and wants cheap models first. Keep real keys in an ignored local .env file or the runner environment. .env.example has empty placeholders. Never paste keys into prompts, commit them, use VITE_ prefixes or expose them to the spectator browser.

## Suggested first model pair

| Provider | Configurable model ID | Standard text input / 1M tokens | Output / 1M tokens |
| --- | --- | --- | --- |
| OpenAI | gpt-5-nano | $0.05 | $0.40 |
| Gemini | gemini-2.5-flash-lite | $0.10 | $0.40 |

These are inexpensive development candidates, not a claim of good football ability. Rates were checked for this handoff against [OpenAI GPT-5 nano documentation](https://developers.openai.com/api/docs/models/gpt-5-nano) and [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). Recheck availability, deprecation and pricing when implementing. Account access and quotas have not been tested. [Google model catalogue](https://ai.google.dev/gemini-api/docs/models) lists the Gemini model ID.

Output billing can include reasoning/thinking tokens. Count the rules and retained context as input. Use actual reported usage where available and never promise a per-match cost before measuring representative requests.

## Adapters

One thin adapter per provider returning unknown JSON for common validation. Verify current structured-output APIs and supported schema subsets before integration. Handle refusals, truncated output and empty responses explicitly. Do not assume matching sampling/temperature/reasoning controls across providers; use supported low-cost settings and record them.

No tools, browsing, images or audio required in team requests. Complete JSON must validate before commitment even if transport streams tokens.

## Bounded progression

1. Offline fixtures and mocks by default in tests.
2. One explicit smoke request per provider to check access and output.
3. At most 10 decision boundaries for the first model run: 20 base requests.
4. Measure input/output/reasoning usage, latency, validity and behaviour.
5. Progress through short possessions before full matches.

Proposed development limits: one retry per team decision, one generation job at a time, bounded input/history/memory, output-token limits, decision cap and a conservative estimated dollar ceiling. Implement actual runner checks; environment names alone do not enforce anything.

Reserve budget for both concurrent requests and retry allowance before dispatch. Count SDK retries or disable them in favour of one policy. Stop scheduling, checkpoint and mark incomplete when budget is insufficient. An application dollar estimate is not an absolute billing guarantee, especially with missing usage or changed prices; request/token caps remain enforceable. Fail closed for paid models lacking configured price estimates.

Do not silently upgrade models. Report failure and allow deliberate configuration changes. Save controller configuration in match provenance. Watching/replaying makes zero inference calls.

.env.example is a proposed configuration contract for the later local runner. The initial provider-free slice neither reads it nor calls APIs.
