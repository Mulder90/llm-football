# Slice 27 — Final two-minute match

The user requested one final match with one minute per half. They raised slow-feeling players but preferred avoiding extra experiments, and subsequently authorized additional spending if needed. The decision was to retain movement physics and generate the actual match once.

## Change and mechanism

`football-0.9` changes `MATCH_TIMING.halfPlayingTicks` from 1,800 to 3,600 ticks at 60 Hz. The simulation clock, observation fields and rulebook interpolation all consume the same constant. Restarts and halftime pause the playing clock; the referee processes incidents on the final eligible tick before stopping the half. There are exactly 7,200 playing ticks across two halves, with one end swap. Simulation time includes stoppages; presentation adds existing goal celebrations. Neither provider latency nor playback speed changes the outcome.

No speed, acceleration, ball, referee, action-schema, model or cadence changes were made. The maximum running speed is 7 m/s (25.2 km/h), with 18 m/s² acceleration, approximately 0.39 seconds to reach the cap on an unobstructed full-pace run. In the preceding real match, move orders during open play averaged 0.805602 Coral / 0.805422 Cyan pace. These are commanded paces, not measured average velocity; arrivals, turns, collisions and holds also affect movement. No paid speed comparison was run.

## Verification before dispatch

TypeScript and all 287 tests pass. Existing duration assertions now require 60-second half observations and 120-second match completion; excerpt-limit rejection follows the new full horizon. Full-match replay and presentation tests check halftime, full time, celebrations and arbitrary seeking. The request-size tests still fit both halves and maximally escaped memory within 32 KiB.

The scripted full fixture finishes 7–7 at exactly 120 playing seconds / 154.7667 simulation seconds, hash `867a2e97`. This is labelled scripted and is not the requested model match. The keeper fixture remains a 16-second excerpt, hash `aa037ccb`. The passing fixture's new hash is `78ff5e8a`; replacing only its diagnostic state version with 0.8 reproduces `0614dee1`, establishing unchanged football state/events for that short fixture (nine kicks, eight receives, one interception). Build, formatting and diff checks pass.

While model generation runs, the scripted fixture also verifies local UI seeking: halftime shows 01:00 and full time shows 02:00, with the preserved 7–7 scripted score. Its fourteen goal celebrations extend viewing to 04:14 without adding playing time. Browser logs contain no warnings or errors. The model recording will receive a separate playback check on completion.

The previous 0.8 source, public catalogue and match are preserved under ignored `artifacts/private/final-match-preparation/`. A separate archive preserves the exact 0.9 source at dispatch. The current viewer supports only 0.9; the old recording is not relabelled or replayed under new timing. After generation the local catalogue contains the final match alone, while the current Cloudflare review remains unchanged.

## Model run

`final-match-001` completed with GPT-5 mini (low reasoning/verbosity) controlling Coral and Gemini 3.8 Flash (LOW thinking, temperature 1) controlling Cyan. Same configured prices as the preceding run: OpenAI $0.25 input / $2 output and Gemini $0.75 input / $3.75 output per million tokens. These dated rates and settings were already checked on 8 September; no provider configuration changed.

The single job permitted up to $4 estimated ($1.50 OpenAI / $2.50 Gemini), 300 paired rounds / 1,200 attempts including at most one repair per team decision, and 3,600 generation seconds. Both providers and full repair allowances were reserved before each shared boundary. It finished in **3,215.15 seconds (53m 35s)**, using **247 paired rounds / 501 requests** at **$3.022239 estimated** ($0.96770625 OpenAI / $2.05453275 Gemini). Estimates are usage-based, not confirmed billing. No further model calls were made.

All **494 accepted team batches cover the full active roster**. First replies passed 487/494 times; Mini repaired seven replies (four wrong-team memory references, one outfield keeper action and two oversized order arrays). Flash accepted all 247 first replies. No fallback was used. Actual rejected replies and repair feedback remain in the provenance.

## Actual result and final checks

**Two minutes, two models** is **Coral 0–5 Cyan**, all five goals by Cyan #10. Halftime is 0–3 at 60 playing seconds; full time is exactly 120 playing seconds. Independent replay verifies **`fae9b050`**. The match has 156.75 simulation seconds and a 192.5-second viewing timeline (3m 12.5s with stoppages and five celebrations).

Coral completes 24 passes and Cyan 14; shots are 2–21. Deliberate carrier-move choices are 7–23, with measured foot carrying of 22.72 m and 142.88 m respectively. There are six catches, five distributions, no handling violations and no cards. Fifty-five interceptions and 41 failed actions remain: 37 tackles fail to reach the carrier, one tackle is still recovering, one kick lacks foot possession, and two keeper actions lack the required possession. The one-sided football is not presented as proof of consistently good tactics. No failed action or score triggered a replacement run.

Only title/description change in a separate compact catalogue copy. The original generation file is untouched; structural comparison verifies all other content is identical. The gzip round trip, actual bounded stream-import reader and independent replay pass. The public catalogue contains exactly one file: 3,152,195 compressed bytes / 32,942,616 decoded bytes, under the unchanged 83,886,080-byte import limit. The final production build passes. Source implementation remains the two-line version/duration change; no mid-run physics or prompt edits were made.

Local browser playback runs through to 0–5/full time at 02:00 playing time. The inspector shows the correct title, model labels and final match entry. Watch again restarts at 0–0; pause and seeking to the exact halftime boundary show 0–3 at 01:00. No browser warnings or errors appear. The main README, analytics HTML and live Cloudflare deployment remain unchanged. Final formatting and diff checks pass; the generation lock is released.

Next: watch the completed local final match, then deploy the final version when the user requests it. No automatic tuning loop or additional paid match is planned.
