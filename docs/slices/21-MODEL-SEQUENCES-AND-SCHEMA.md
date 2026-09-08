# Slice 21 — Model excerpts and provider schema compatibility

Date: 2026-09-08. Work stayed local; no deployment or new full match ran. The user wants to judge the football before adding credit for a full run.

## Result and scope

The local catalogue now includes two replay-verified, incomplete excerpts under `football-0.6`. **Carry before pressure · model evaluation** is the default. **Keeper buildup · Cyan fallback** is separately selectable through Inside the match → Matches, alongside scripted practice. Playback makes no provider calls.

The retained code change removes only `batch.orders.maxItems` from the common provider JSON schema. Local Zod validation still limits a batch to eleven orders; engine validation still checks identity, ownership, roles, duplicate players, phase legality and finite parameters. Both providers receive the same stable schema. No simulation, rules, prompts, cadence, model choices or movement assistance changed.

## Compatibility evidence

The original `sustained-model-01` failed on Gemini HTTP 400 before either team's orders could be committed. Six bounded probes used the same model/settings and football input. A minimal object worked. Grouping action alternatives, replacing constants with enums and removing unrelated schema keywords still returned HTTP 400. Removing array maxima worked; removing **only** the orders-array maximum also returned a valid eleven-order response. Memory array maxima remain on the wire.

Google documents `maxItems` as supported but also notes that complex schemas can be rejected. This result concerns this particular action-union array, not a claim that Gemini rejects every array maximum. See [structured-output limitations](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) and [generation API schema support](https://ai.google.dev/api/generate-content). Private probe inputs, replies, errors and usage remain under `artifacts/private/gemini-compat-01/` without credential headers.

The paired passing run then worked with both providers. Seven Mini replies incorrectly used outfield `guard`; one repair per affected boundary succeeded. A further experiment constrained keeper-only actions to the fixed keeper IDs in the wire schema. Mini accepted all seven first attempts in its keeper sample, but Gemini returned malformed repeated keeper moves without required `pace` on all fourteen attempts. Cyan therefore used seven explicit empty fallback batches. This is not a controlled cost comparison because the scenario changed, and the provider's internal failure cause is unknown.

The keeper-ID experiment was reverted. An offline comparison proves the final schema exactly equals the one stored in the successful paired passing recording. Keeper-role restrictions remain strict at runtime; expensive guard repairs still need attention before a full run. Original recordings retain the exact schemas used to generate them.

## Football evidence

| Excerpt | Playing / simulation seconds | Rounds / requests / repairs / fallbacks | Replay hash |
| ------- | ---------------------------- | --------------------------------------- | ----------- |
| Passing | 6.7 / 8.6833                 | 12 / 31 / 7 / 0                         | `def08e93`  |
| Keeper  | 5.55 / 5.55                  | 7 / 21 / 7 / 7                          | `51cf5d78`  |

Passing: Coral completes #7 → #6 → #8 → #6, then loses possession once. Receivers choose subsequent kicks; controlled foot travel is only 0.785 m for Coral and 0.604 m for Cyan. One Coral tackle fails to reach the carrier and ball. The fixed sustained-carry criterion fails. Restarts add decision boundaries; the twelve-round cap stops the run before its eight-playing-second horizon. This is observable passing with both teams active, not a completed match or sustained carrying success.

Keeper: Coral catches at tick 40, throws at 41 and completes reception at 143. Three further passes complete, and #8 carries 3.710 m across one decision boundary before passing. There are no failed execution orders, handling violations or turnovers. The catch/distribution criterion passes, but the no-fallback and horizon criteria fail. **Cyan never receives an accepted model batch and stays inactive throughout.** These attacking actions do not establish competitive keeper buildup. The recording title and description expose that limitation; the original unedited evaluation file is retained privately. Only descriptive metadata differs in the catalogue copy, and its replay hash is unchanged.

The separate `receive-follow-up` sample was skipped to avoid another paid sample of the same starting state: its initial state equals `carry-pressure` after normalizing match ID. Their scripted controllers differ, which explains their different offline baseline behavior. Fixture states and criteria were not altered; actual reception and follow-up decisions are already measured in the first clip. All attempted outcomes remain saved.

## One original allowance

The user approved $0.60 combined, $0.20 OpenAI, $0.40 Gemini, at most 144 attempts and 900 seconds of generation. Each continuation debited the earlier attempts and conservative estimates; a new CLI invocation did not reset authorization.

| Stage                      | Attempts | OpenAI estimate | Gemini estimate | Combined estimate | Wall seconds |
| -------------------------- | -------: | --------------: | --------------: | ----------------: | -----------: |
| Original failed paired run |        3 |       $0.007718 |       $0.039936 |         $0.047654 |      32.7003 |
| Six compatibility probes   |        6 |              $0 |      $0.1152075 |        $0.1152075 |      16.3710 |
| Passing continuation       |       31 |       $0.072592 |     $0.09627225 |       $0.16886425 |     242.1133 |
| Keeper experiment          |       21 |        $0.02757 |       $0.076848 |         $0.104418 |     101.8903 |
| **Total**                  |   **61** |    **$0.10788** | **$0.32826375** |   **$0.43614375** | **393.0750** |

The remaining estimates are $0.16385625 combined, $0.09212 OpenAI and $0.07173625 Gemini. The keeper run stopped at `gemini_estimated_cost_limit`: the next paired boundary requires a $0.079872 Gemini reservation, including repair capacity, even though typical requests cost much less. It did not exhaust the user's account balance. The passing stop reason is `decision_limit`.

Usage-based estimates include output/thinking tokens. Failed requests without usage retain conservative maximum reservations; these figures are not confirmed billing. Both clip estimates together are $0.27328225; the rest is the initial failure and compatibility diagnosis. No generation remains running. The separate full-match proposal is deferred until the user reviews the football and adds credit.

The earlier compact memory and removal of release-only replans should reduce tokens and unnecessary requests. This slice fixes compatibility; it does not establish full-match savings. The failed keeper experiment cannot be counted as an efficiency win.

## Mechanism to reimplement

Keep one strict Zod instance for the orders array: `z.array(modelOrderSchema).max(11)`. Reference that exact instance inside the response schema. During JSON Schema export, inspect each visited Zod node; when it is that array instance, delete only the exported `maxItems` property. Do not delete the local Zod maximum or recursively remove every array limit. Send this exported schema to both providers and record it in provenance.

On receipt, parse JSON through the original strict response schema, then validate the batch against the frozen match state. Eleven legal orders pass; twelve orders fail locally even though the provider decoder was allowed to generate them. Missing `pace`, outfield handling and duplicate keeper orders also fail. The existing bounded repair/fallback policy handles rejected proposals; it never invents a tactical replacement.

At 60 Hz, simulation ticks advance through restart pauses while playing ticks do not. The passing recording therefore lasts about 8.68 seconds on the replay timeline but shows only 6.7 playing seconds on the scoreboard. A planned eight-second diagnostic is not necessarily an eight-second video or eight paired rounds. The viewer correctly shows End of recording and Unfinished match rather than Full time.

## Verification and next slice

- `pnpm check`: TypeScript and 253 tests across 29 files passed. New boundary tests cover the sole wire-schema difference, the retained eleven-order cap and the observed malformed keeper responses.
- `pnpm build`: passed, 171 modules, 437.42 kB JavaScript / 138.34 kB gzip.
- Both catalogue exports pass strict recording validation and independent deterministic replay with their original hashes. Compressed files are 207,022 bytes for passing and 74,502 bytes for the labelled keeper clip.
- Local browser checks cover selection, animated playback, end-of-recording status, recorded plans and the keeper fallback label. Watching used the saved state, not new generation.

Next proposed slice: review these clips with the user, then address keeper-order reliability before another bounded paid test. A successful result must have both teams accepting meaningful legal decisions; attractive unopposed buildup is insufficient. A full two-half run and X/LinkedIn publication remain later steps.
