# Slice 15 — Quiet stadium ambience and a fresh football run

The user asked to replace the disliked drums with very low stadium ambience and start a new model match alongside that work.

## Sound

All synthesized percussion is removed, including the continuous rhythm and save, miss and celebration-landing accents. A locally bundled, edited CC0 football-stadium recording supplies a quiet 30-second loop. The approved whistle, contact/post samples and separate goal roar remain unchanged. Supporter and player animations still react to the recorded football events.

The ambience uses gain 0.045 before the user's volume control, with a gentle exponential entrance. It runs only at normal playback speed. Pause, seek, mute, hiding the page, changing speed, full time and disposal stop its source. A late asset download cannot start playback. Sound starts only on a subsequent eligible playback frame; the loop offset follows recording time at a seek.

To reproduce the loop, blend the last two seconds of a 32-second excerpt into its first two seconds, then keep the resulting 30-second cycle. One looping audio source plays that asset through a separate quiet gain into the master volume. Store it with the other active voices so every interruption uses the same cleanup path. Only terminal whistles survive automatic playback completion.

The encoded asset is 473,431 bytes. Its decoded peak is 0.6962 with no clipped samples; the measured join stays below ordinary adjacent-sample variation. At default volume the average ambience is approximately −59 dBFS. These checks establish level and continuity, not subjective sound quality. Source, license and processing are documented in [sound credits](../SOUND-CREDITS.md).

## Football readiness

Two short authored situations exercised the new positional briefs with GPT-5 mini and Gemini 3.8 Flash. Each model controlled Coral against explicit scripted Cyan orders. These are diagnostics, not model-versus-model matches.

| Situation                     | GPT-5 mini                                                              | Gemini 3.8 Flash                                      |
| ----------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Screened central passing lane | Carried 7.11 m and retained possession                                  | Completed the wide pass to #6 at about 1.68 s         |
| Defensive recovery            | Initially rejected twice for naming the opponent as its own ball player | Kept both centre-backs covering centrally for all 2 s |

The defensive snapshot gives Cyan #10 the ball at (40, 34), moving towards (27, 34) at pace 0.65. Coral centre-backs start at (30, 28) and (34, 40), with the holding midfielder at (46, 34). Central cover counts those three defenders when they are goal-side of the current ball and within 12 m laterally. Holding every Coral player preserved two covering defenders for 1.30 of the two seconds; Flash preserved both for the full interval. Its midfielder recovered ground but still fell 3.07 m farther behind the advancing carrier. This geometric diagnostic does not establish overall defensive quality.

Mini's rejected responses revealed ambiguous `ballPlayerId` wording. The shared prompt now explicitly requires an own active carrier, presser or collector, even when defending. The actual opposing carrier is already in `ball.owner` and belongs in tactical threats. Validation returns a precise field-specific repair message instead of a generic roster error. It never replaces a model's chosen player or relaxes ownership checks.

A targeted Mini recheck returned a valid own presser on its first attempt. It preserved two covering defenders for 1.75 seconds and one for the whole interval. Its midfielder still fell 4.57 m farther behind the carrier. These are single observations, not proof that the wording permanently fixes model behavior. The clarified wording was shortened to keep worst-case escaped observations inside the existing 32,768-byte request limit.

The checks used six requests, estimated at $0.0168385 OpenAI and $0.016842 Gemini: $0.0336805 combined. Private reports are `roles-readiness-001` and `roles-readiness-002`; the targeted runner is in ignored `artifacts/qa/roles-readiness.mjs`.

## Completed match

`positional-match-001` completed both 30-second playing halves, finishing 0–0. It is published in the local viewer as **Finding their shape**, with GPT-5 mini controlling Coral and Gemini 3.8 Flash controlling Cyan. This is a real model-versus-model match using positional briefs, structured tactical memory and the clarified ownership instruction. Presentation changes do not alter its recorded football.

Generation took 43m 43.3466s for 60 playing seconds and 80.8833 recording/watch seconds. The run used 133 paired decision rounds: 266 base requests plus 27 repairs, 293 requests altogether. Two Coral rounds exhausted their repair and recorded explicit empty-order fallbacks at ticks 3509 and 4622; existing orders could only continue until expiry. The canonical replay reproduces hash `cd60f48a`, all 1,739 saved frames and 145 events.

| Estimated spending | OpenAI      | Gemini      | Combined    |
| ------------------ | ----------- | ----------- | ----------- |
| Readiness checks   | $0.01683850 | $0.01684200 | $0.03368050 |
| Completed match    | $0.68721075 | $1.39941300 | $2.08662375 |
| Whole slice        | $0.70404925 | $1.41625500 | $2.12030425 |

The enforced match ceilings were $1.23 OpenAI, $2.08 Gemini and $3.31 combined, plus 400 decisions and one hour of wall time. Both requests and their possible repairs were reserved before each shared boundary. The completed run stayed within these limits; no further paid generation starts automatically.

Google estimates use its verified introductory $0.75 input / $3.75 output per million tokens through 2026-12-31. Historical receipts retain their original prices. No cached-input discounts are applied in these estimates. [Provider documentation](../07-PROVIDERS.md) records sources and the required expiry recheck. Account balances and conversion rates are not stored in the engine.

## What the football shows

The offline audit re-simulated every tick of this match and the earlier `tactical-memory-match-001` baseline (hash `31ab92f4`). Both use football-0.5 and 60 playing seconds. The earlier controllers were GPT-5 nano and Gemini 3.1 Flash-Lite; models, prompts and trajectories changed together. These are descriptive comparisons of one match each, not evidence that positional briefs alone caused a change.

| Measure                                             | Coral, earlier → new | Cyan, earlier → new |
| --------------------------------------------------- | -------------------- | ------------------- |
| Kicks ending in clean teammate control              | 1/16 → 17/28         | 8/10 → 9/13         |
| Outfield player-time within 3 m of a teammate       | 15.53% → 16.22%      | 5.80% → 6.12%       |
| Open-play batches containing identical move targets | 4/111 → 6/106        | 11/111 → 0/106      |

Coral delivers more balls to teammates, and Cyan no longer issues identical destinations to multiple moving teammates in a single batch. Actual close crowding is essentially unchanged. The kick metric includes restart deliveries and clearances, excludes shots, and follows the ball to its first controlled touch before another release or stoppage. Six of Coral’s 17 clean completions happen in the kick’s engine tick, so this count does not establish sustained passing play. The declared receiver was reached on 14 of Coral’s 28 kicks and nine of Cyan’s 13.

Carrying still needs work. The teams travelled 8.28 m Coral / 6.28 m Cyan while retaining the same owner across a playing tick, but neither had a continuous carrying episode of at least two metres. Neither model issued a `move` order to its carrier at a controlled-ball open-play decision. The measured movement can come from existing orders, inertia and physical separation; it is not proof of a deliberate dribble. Loose-ball time at playing-tick starts increased from 41.0 to 49.92 seconds out of 60.

Cyan took all ten shots, all in the first half; Coral took none. Five Coral keeper saves followed actual shots. The earlier match had two Coral shots, 30 Cyan shots and a 0–2 score. Neither the lower shot count nor this goalless draw alone establishes better defending or a more entertaining match.

During the short periods of opponent control, Cyan kept at least two central-role players goal-side and within 12 m laterally of the ball for 6.30 of 6.72 seconds; Coral did so for 0.80 of 3.22 seconds. This counts starting centre-backs and the holding midfielder as a geometric cover proxy. It does not measure marking quality, and wide-ball or keeper-possession situations can make it misleading. Full definitions and exact audit results are retained in ignored `artifacts/qa/positional-match-analysis.json`.

## Decision timing and the next experiment

Classifying consecutive frozen observations with phase changes first, then the ordinary 60-tick interval, leaves 27 initial/phase rounds, 46 ordinary interval rounds and 60 early ownership rounds. The early rounds comprise 19 controlled-to-loose releases, 23 loose-to-controlled acquisitions, eight teammate owner changes and ten team turnovers. Release-only boundaries therefore account for 19 of 133 rounds, or 14.3%. This sizes an opportunity; it does not predict savings or football after changing the schedule.

The proposed next slice is to avoid an immediate replan solely because a controlled ball becomes loose, keep provider schemas stable where possible to support caching, and make tactical memory shorter and clearer. These changes are not implemented. Test them on short recorded or authored situations covering possession, carrier choices, receiver arrival and defensive recovery before another paid match. The existing prompt already explains that moving with possession carries the ball; repeating that instruction alone is not a demonstrated fix. Any cadence change alters controller opportunities and needs football validation alongside request/cost measurements.

## Verification

TypeScript, all 172 tests across 24 files, production build and Prettier checks pass. Coverage includes audio interruptions and delayed loading, final whistles, both teams' memory ownership, unchanged rejected input and worst-case escaped request size. Removing obsolete drum tests accounts for the lower total despite new checks. The production JavaScript is 418.44 kB, 132.50 kB compressed.

Before generation completed, browser checks exercised Play, pause, seek and mute/unmute on the earlier default recording. After publication, Finding their shape loaded by default with the correct controller labels and two disclosed fallbacks. Natural 1× playback from kickoff reached Full Time at 01:00 playing time, score 0–0, with the exact slider endpoint 4853 and watch time 4853/60 = 80.883333 seconds (displayed as 01:20). The browser error log was empty, and the new production build passed. Audio audition remains the user’s listening check.

The completed recording passed independent canonical replay verification and is the default complete entry in the local catalogue. Its two explicit Coral fallbacks remain disclosed in the viewer. The model run establishes a complete, inspectable result; it does not establish that the football is consistently entertaining or ready for a longer paid match.
