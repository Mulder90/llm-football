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

## Fresh match

`positional-match-001` is generating with GPT-5 mini against Gemini 3.8 Flash, two 30-second playing halves, positional briefs, structured tactical memory and the clarified ownership instruction. The engine and match outcomes remain unchanged by presentation work.

The match has separate estimated ceilings of $1.23 OpenAI and $2.08 Gemini, plus a $3.31 combined limit, 400 decisions and one hour of wall time. Including the completed checks, maximum estimated spending stays below $1.25 OpenAI and $2.10 Gemini. Each paired boundary reserves both requests and possible repairs before dispatch; either provider limit can stop the match as incomplete.

Google estimates now use its verified introductory $0.75 input / $3.75 output per million tokens through 2026-12-31. Historical receipts retain their original prices. [Provider documentation](../07-PROVIDERS.md) records sources and the required expiry recheck. Account balances and conversion rates are not stored in the engine.

## Verification and next step

TypeScript, all 172 tests across 24 files, production build and Prettier checks pass. Coverage includes audio interruptions and delayed loading, final whistles, both teams' memory ownership, unchanged rejected input and worst-case escaped request size. Removing obsolete drum tests accounts for the lower total despite new checks. The production JavaScript is 418.44 kB, 132.50 kB compressed.

The browser preview exercised Play, pause, seek and mute/unmute, then reached the existing recording's exact full-time endpoint at 95.183 watch seconds. No browser errors were reported. Audio audition remains the user's listening check.

When generation finishes, verify the replay, publish the recording to the local viewer, and assess carrying, passing, spacing and defensive cover from actual engine outcomes. Stop on a provider or budget failure; do not silently launch another paid run. The short readiness tests do not predict the score or guarantee entertaining full-match play.
