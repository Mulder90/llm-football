# Slice 22 — Keeper-order reliability

Date: 2026-09-08. Approved next slice: address keeper-order reliability before more sustained play. Work stayed local; the full run remains deferred until the user likes the football and adds credit.

## Result

The first live check passes: **six of six first replies accepted**, three paired boundaries, eleven orders for each team at every boundary, no repairs, fallbacks, execution failures or handling violations. Both teams actively choose movement. Coral's keeper catches the incoming ball, rolls it out, and Coral #7 receives it.

The recording is **Keeper orders · first-attempt check**, locally selectable through Inside the match → Matches. It contains **2.45 playing/simulation seconds**, stops at the planned three-round cap, and verifies to `86c27e6f`. Its incomplete status is correct: this is a short diagnostic, not a complete match or the planned eight-second sustained scenario. The earlier passing excerpt remains the default and the failed keeper experiment remains separately labelled.

## What changed

- Observations expose `teamContext.keeperId`, derived from the active own-team keeper; dismissal makes it null. This is a mechanical role fact, with no suggested position or tactical choice.
- The coordination instructions explicitly reserve guard/pickup/distribute/put_down for that keeper. Outfield defending uses move/hold. Guard already moves, requires a target, has no pace and cannot be combined with another order for the same player. The restart-setup wording no longer offers guard to every player.
- Invalid recognized actions report their own field error, such as `batch.orders.1.pace`, instead of a generic union error. Runtime role errors identify the attempted action and outfielder and explain legal positioning forms.

The successful provider JSON schema is unchanged. There are no keeper-ID enums, relaxed validators, automatic action conversions, selected targets or inserted pace values. Models, settings, output limits, normal repair policy, decision timing and football rules remain unchanged. The engine version remains `football-0.6`; the simulation change is diagnostic error wording only.

This follows the official OpenAI guidance to keep constraints direct and specific, while retaining GPT-5 mini and its existing adapter settings. See [reasoning prompting guidance](https://developers.openai.com/api/docs/guides/reasoning-best-practices) and [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini). The live sample, rather than the guidance alone, is the evidence for this implementation.

## How the feedback works

Zod validates each proposed order against an action union. When a move is missing pace, most branches complain that the action type is wrong; the move branch instead identifies pace. Previously the parser surfaced only the outer union's “Invalid input.”

On a rejected order, inspect the union's existing branch errors. Keep branches without an error on their `type` field. If exactly one branch matches, combine the outer order path with that branch's first field path and report its message. Thus order index 1 plus the move branch's `pace` becomes `batch.orders.1.pace`. If the type is unknown or the branch cannot be identified uniquely, preserve the generic rejection. Do not retry parsing with a weaker schema or edit the proposal.

The scheduler sends this bounded feedback only to the rejected side, using the same observation bytes and one normal repair allowance. An already accepted opponent reply stays locked. The repair test confirms the state never advances while waiting. These changes improve the information available for a model to correct itself; they do not ensure every future response will succeed.

## Verification

- `pnpm check`: TypeScript and **258 tests across 29 files** pass. Tests cover keeper identity across halves and dismissal, precise field errors, excess/missing pace, non-finite targets, unknown actions, input immutability and the same-snapshot repair boundary. Existing full UTF-8 memory/request-size cases still fit the 32 KiB limit.
- Reconstructed the exact boundaries for all **52 saved replies** in the previous passing/keeper trials. All **31 accepted and 21 rejected** replies retain their result. The old outfield-guard and missing-pace cases now provide specific feedback. Final provider schema equals the successful passing recording's schema exactly.
- `pnpm build`: passed, 171 modules, 437.80 kB JavaScript / 138.47 kB gzip. No dependency or frontend component change.
- New recording passes strict import validation and independent replay, including the catch, hand release and reception. Compressed catalogue file: **61,987 bytes**.
- Local browser selection and animated playback reach End of recording with the incomplete label. Both teams' orders are visible; viewing makes no provider calls.

## Bounded live check and accounting

The check used the unchanged keeper-outlet starting state and seed, with a new match ID. The ignored local driver is `artifacts/private/keeper-reliability-tools/check.ts`; without `--run` it only prints the plan and does not load credentials. Plan, recording and report are retained under `artifacts/private/keeper-reliability-01/`. A shared generation lock prevents overlap.

The preselected limits were three paired rounds, six requests, **zero retries**, 4096 output tokens, 32 KiB input and 120 seconds. Zero retries makes this a first-attempt check and reduces the reservation to one request per provider; it does not change production defaults. The driver stops at the first fallback or incomplete roster, preserving that boundary instead of paying through repeated inactive opposition. No such stop occurred. Initial requests measured 23,522 and 23,524 bytes.

The check was capped at **$0.10 combined / $0.04 OpenAI / $0.06 Gemini**, entirely inside the remaining original allowance. Actual reported-token estimate: **$0.03487**, split **$0.01097875 OpenAI / $0.02389125 Gemini**, over **42.4329 wall seconds**. The normal budget checks still reserve each whole pair before dispatch; no cap was bypassed or reset.

Across the original approved trial and all diagnostics, totals are now **67 requests, 435.5078 generation seconds, $0.47101375 estimated**: $0.11885875 OpenAI / $0.352155 Gemini. Remaining original allowance: **$0.12898625 combined / $0.08114125 OpenAI / $0.047845 Gemini**, 77 attempts and about 464.49 generation seconds. Earlier failures without usage retain conservative reservations; these totals are not confirmed billing or an account balance. No generation is running.

## Football limits and next slice

Catch occurs at tick 40, roll at 41, reception at 146; the recording ends at tick 147. With a 60 Hz engine, only 1/60 second separates catch and roll, so the release can look immediate. The model chose that release at the post-catch decision boundary; provider waiting time never lengthens hand possession or playback. This check stops before the receiver's next decision.

Cyan still crowds in places: minimum friendly spacing reaches the 0.8 m body separation, with 45 crowded playing ticks. No turnover occurs in this short sample. Six successful replies cannot establish sustained defending, carrying after reception, all restart phases, or full-match cost savings. Comparisons with the failed keeper-ID schema experiment are not a controlled prompt-only benchmark.

Next proposed slice: review this clip, then complete an eight-second keeper sequence with both teams active and inspect reception follow-up and defensive spacing. Review an explicit additional allowance before a normal paired trial if needed; the remaining Gemini allowance cannot fund its $0.079872 boundary reservation with repairs. A full two-half match and final X/LinkedIn publication remain later steps.
