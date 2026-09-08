# Slice 20 — Bounded paired-model trial

The local sustained-play CLI now has an explicit model mode using the previously reviewed GPT-5 mini / Gemini 3.8 Flash pair. Implementation and offline verification are complete. The user approved the fresh allowance. The local `sustained-model-01` trial stopped at its first boundary on Gemini HTTP 400, with no paired decision applied. The live website, public catalogue, engine rules and tactical prompt are unchanged.

## Approved run configuration

```sh
pnpm evaluate-sequences --dry-run --mode models --usd .60 --openai-usd .20 --gemini-usd .40
```

The actual command removed `--dry-run` and used `--name sustained-model-01`. That name now contains the retained failure and must not be reused.

- Coral: `gpt-5-mini`, low reasoning and verbosity; $0.25 input / $2 output per million tokens.
- Cyan: `gemini-3.8-flash`, LOW thinking and temperature 1; $0.75 input / $3.75 output per million tokens.
- Fixed seed 34891, `carry-pressure`, `receive-follow-up`, `keeper-outlet`, one repetition each, eight playing seconds per scenario.
- At most 12 paired rounds per scenario: 24 initial requests, plus at most 24 repairs. At most 144 requests across the trial.
- One job allowance: $0.60 combined, $0.20 OpenAI, $0.40 Gemini; 900 wall-clock seconds. These limits may stop the trial before all horizons complete.
- Each request: 32 KiB bounded input estimate, at most 4096 output tokens, one repair per team boundary.

Prices were rechecked on 2026-09-08 against [OpenAI's model page](https://developers.openai.com/api/docs/models/gpt-5-mini) and [Google's pricing](https://ai.google.dev/gemini-api/docs/pricing). Gemini's introductory prices run through 2026-12-31; the adapter's dated guidance remains relevant. Configured keys are present, but no current provider balances were inspected. Dollar ceilings are conservative application estimates; they do not guarantee actual billing or completion.

## Real attempt outcome

The runner stopped after **32.700 seconds**, three requests and zero applied paired decisions. Only `carry-pressure` was attempted. `receive-follow-up` and `keeper-outlet` did not start. The request receipts are:

| Team / attempt | Result                                                                      | Usage / conservative estimate              |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| Coral, initial | Rejected: `guard` assigned to outfielders Coral #3 and #4                   | 5408 input / 1292 output tokens; $0.003936 |
| Cyan, initial  | HTTP 400: “Request contains an invalid argument.” No response text or usage | Full request reservation, $0.039936        |
| Coral, repair  | Accepted, 11 player orders; `gpt-5-mini-2025-08-07`                         | 5432 input / 1212 output tokens; $0.003782 |

The total estimate is **$0.047654** ($0.007718 OpenAI / $0.039936 Gemini). OpenAI output includes 1280 reasoning tokens across the two requests. The repair reported 5248 cached input tokens, but the existing conservative accounting applies full input prices. Gemini's reservation is not evidence of an actual charge. No current billing balances were inspected.

The accepted OpenAI reply still cannot affect football alone: the shared boundary is not committed when the other provider has a permanent error. Consequently the report has zero playing seconds, no completed passes or carries and no applied fallbacks. The `noFallbacks` and `noExecutionFailures` booleans are vacuously true at tick zero and establish no football quality. The recording independently replays to initial-state hash `1ad6ad38`.

Artifacts are retained under ignored `artifacts/private/sustained-model-01/`: `report.json` and `carry-pressure-1.json`, including the rulebook, response schema and all three redacted receipts. The current schema is 4979 bytes with eight order alternatives. Google's [structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) says complex or deeply nested schemas may be rejected, but this generic response does not prove that complexity caused the error. No speculative adapter or prompt fix and no additional paid probe was made. The generation lock was released and no job remains running.

## What changed and the invariant

`src/generation/sequence-trial.ts` validates the trial options, builds a credential-free plan and runs scenarios serially. Explicit model mode requires all three spending caps. It fixes the reviewed model pair without environment model overrides. Default scripted mode and all dry runs skip `.env` and provider credentials.

The invariant is **one allowance across the complete trial**. Each scenario uses only the remaining dollars, requests and wall time. The existing scheduler still freezes both observations, dispatches the teams concurrently, allows one repair per side and preserves fallbacks. No football policy or timing changed.

`report.json` version 2 adds cumulative totals, the exact plan and the active recording filename. Each checkpoint first saves the replayable active recording, then the report, using atomic file rename. A failed save stops further dispatch; the last saved state and active filename identify the recovery boundary. There is no resume support. A fresh directory and shared generation lock preserve prior work and prevent overlapping jobs.

An incomplete scenario stops the job and keeps its stop reason. A completed horizon with failed football criteria remains in the report and subsequent planned scenarios run. The CLI returns a nonzero exit code for either incompletion or failed criteria; it does not retry a scenario to obtain a preferable result.

## Mechanism: carrying the allowance forward

Before a scenario starts, copy the totals from all completed scenarios into `spent`. Give its scheduler `job cap − spent` for combined dollars, each provider and requests. For each checkpoint, replace job totals with `spent + current scenario receipts`; never add the entire current scenario again on each write. That distinction prevents double counting checkpoints while ensuring cancelled or uncommitted attempts remain charged.

Before dispatching any pair, the scheduler reserves two attempts for each provider. Treating maximum input bytes conservatively as tokens gives a mini request estimate of `(32768 × .25 + 4096 × 2) / 1,000,000 = $0.016384`. Flash's corresponding estimate is `$0.039936`. Including one repair each reserves `$0.032768 + $0.079872 = $0.11264` per paired boundary. A successful reply with usage uses its measured token estimate; missing usage keeps the request reservation. Unused repair reservations do not become charges.

The wall-clock deadline is shared using a monotonic timer and abort signal. Check elapsed time again between scenarios because synchronous work or checkpoint writes can delay delivery of a browser/Node timer callback. Wall time never advances the football engine; the scenario still measures exactly 480 playing ticks when complete.

## Verification

- `pnpm check`: TypeScript and **251 tests across 29 files** passed.
- `pnpm build`: passed; viewer output remains 437.35 kB / 138.31 kB gzip.
- Nine new tests exercise explicit financial options, combined/provider spending across scenarios, missing-usage charges, cumulative repair/request counts, retained failed criteria, permanent failure before pair commitment, a shared deadline including checkpoint time, and checkpoint-save failure accounting.
- CLI dry runs succeeded with traps that throw on environment loading or network calls. Model mode without explicit allowances was rejected before either access.
- `pnpm evaluate-sequences --name sustained-trial-cli-01 --repetitions 2`: all six horizons and original football criteria passed, 54 paired rounds / 108 scripted calls, zero paid calls or cost. Repeated hashes exactly match slice 19: carry `791b60d1`, reception `b908e5af`, keeper `c0ca8cc7`.
- Reusing that name was rejected, the prior report's SHA-256 remained unchanged and the lock was released.
- The stopped real recording passed import and independent replay verification. The local viewer shows both configured model names, incomplete status, zero shared boundaries, three requests, 32 seconds of generation time and approximately $0.048 estimated usage. No UI code changed.

## Limitations and next action

This verifies the entry point with offline mocks and its real permanent-error path, not sustained model teamwork. Original diagnostic criteria remain fixed. In particular, the receiver check requires Coral #7 to pass to Coral #6 and that receiver to choose movement and carry at least 3 m; other legal model choices can fail that criterion. Review the actual metrics and recording alongside every boolean. This first trial has one sample per scenario with a fixed team assignment and is not a general model ranking.

Next slice: isolate the Gemini HTTP 400 with a minimal request comparison, fix only the demonstrated request-compatibility issue while preserving strict local validation, and then continue the bounded scenarios. Keep this failed attempt and count its three requests and conservative estimate against the approved allowance when planning continued troubleshooting; do not reset the full $0.60 as though nothing had been attempted. Model choice, tactics and full-match generation remain review decisions after actual sequence evidence. No publication or social posting is scheduled by this slice.
