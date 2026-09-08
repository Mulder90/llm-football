# Next steps

The project already generates and replays real two-model football. The user wants the football to be entertaining, including ordinary LLM mistakes. Interceptions, missed shots, weak passes and poor positioning are expected; they are not requirements for another tuning cycle. The deterministic engine must faithfully execute model choices and apply the same rules to both sides.

## 1. Completed review

`football-0.8` fixes legal catches being moved outside the area and kicks being launched from a different position after aiming. Models now see neutral goal-opening/distance and boundary facts, and the prompt states the objective to score more than the opponent and win. Current tackle/card thresholds remain; no new football laws or automatic tactics were added. [Decision 013](decisions/013-CATCH-PLACEMENT-AND-GOAL-AWARENESS.md) records the mechanisms and evidence.

The short tests made 48 requests at an estimated $0.2836075, with no repairs or fallbacks. The paired clips show catches, distribution, receptions, carrying and a shot. A keeper pass is intercepted; that is a model outcome, not an engine defect. The specific drill criteria remain recorded without treating them as universal match-readiness gates.

The complete review is **Playing to win**: Cyan wins 3–1 across **two 30-second playing halves**, with nine shots, sixteen completed passes and two keeper catches. All 210 replies were accepted first try, with no repairs/fallbacks; one reply omitted a player order. Independent replay verifies `8eed7d0a`. Generation took 22m 39s and cost $1.26326275 estimated, within the $1.50 combined / $0.50 OpenAI / $1 Gemini caps and 30-minute deadline. At the user's request, this verified version is now live on Cloudflare with this match alone. Watch the actual football and preserve every result.

## 2. Final match complete: one minute per half

The user has requested the final showcase: **one minute per half, two playing minutes total**. `football-0.9` now uses that duration. Speed, acceleration, ball physics, tactical guidance, models and request cadence remain unchanged. Short development tests use bounded excerpts. [Decision 014](decisions/014-FINAL-MATCH-DURATION.md) records the new timing boundary.

**Two minutes, two models** (`final-match-001`) is ready locally: Coral 0–5 Cyan, exactly 120 playing seconds, hash `fae9b050`. It took 53m 35s and an estimated $3.022239 ($0.96770625 OpenAI / $2.05453275 Gemini), within the $4 allowance and one-hour deadline. Its 247 paired rounds used 501 requests, seven repaired replies and no fallbacks; all accepted batches cover the full roster. All 287 tests, TypeScript, build and replay checks pass. Watch the actual result. No extra paid speed test or replacement match is planned.

## 3. Publish and share the actual result

After the final recording is ready and reviewed, bundle the latest game alone, verify its replay and production playback, and deploy to Cloudflare under the user's release direction. Keep the main README evergreen. Use recorded moments and accurate model/rules descriptions for X and LinkedIn; do not invent success, select a winner or present scripted footage as model play. Posting needs explicit authorization for the actual message.

## Deferred work

Only take another focused rules, prompt or presentation slice when an observed problem merits it and the user wants it. No automatic retry cycle to make every pass succeed. Live token streaming, generation resume, longer matches, tournaments, accounts, substitutions and broader football laws remain deferred. Current architecture and execution assistance are described in the [guides](README.md); prior slices remain [historical evidence](slices/README.md).
