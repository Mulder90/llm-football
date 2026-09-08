# Next steps

Goalkeeper possession and the offline sustained-play harness are complete. The remaining sequence starts with reviewing the successful keeper-order check and testing sustained play, then a complete local match and the final publication pass. The local build is the readiness reference; leave the older live website alone until the new version is ready. [Current progress](PROGRESS.md) records measured results; [historical handoffs](slices/README.md) preserve earlier work.

The carrier-choice slice is complete: clearer carry/pass/shoot guidance, compact memory, stable schemas and fewer release-triggered rounds. Twenty short-case requests cost approximately $0.11 and all passed validation first try. Sustained teamwork remains unproven.

## 1. Goalkeeper possession — complete

The offline keeper slice is implemented in `football-0.6`: persistent hands, eligible guard catches, pickup, roll/throw/punt/put-down, handling restrictions, protected possession, the eight-second limit and its referee countdown. Model targets remain explicit; the engine chooses no outlet or run. [Decision 011](decisions/011-GOALKEEPER-HAND-POSSESSION.md) records the contract, timing and deliberate simplifications.

**Safe hands, open play** remains available as scripted practice; the local default now uses the unfinished model passing excerpt. It shows a pickup, movement in hands, roll and reception, an opponent return, catch, throw and another reception. Incompatible development LLM files/catalogue entries are removed; there is no legacy playback or relabelled outcome. Watching costs no inference. [Slice 18](slices/18-GOALKEEPER-POSSESSION.md) records verification and the mechanism.

The response schema remains stable across requests. Shared action shapes and compact rule wording keep bounded full-roster/memory requests within the existing 32 KiB limit; delivery-specific limits are also enforced by runtime and recording validation. No paid requests were needed.

## 2. Sustained football decisions — offline harness complete

The shared runner and scripted baseline are implemented. Three eight-second scenarios, each repeated twice, completed 54 paired rounds and 108 local controller calls with zero repairs/fallbacks/failures. All fixed criteria passed and repeated replay hashes matched. [Slice 19](slices/19-SUSTAINED-PLAY-HARNESS.md) records the evidence; this does not establish LLM performance.

The next evaluation uses model controllers in the same shared scheduler, frozen observations, memory, budgets and receipts already exercised offline. Keep the eight-second horizon and fixed states for comparison.

Retain the three focused situations: a carrier advancing into space before pressure arrives; a pass whose moving receiver must control it and choose a next action; and a keeper collecting then distributing while teammates offer outlets and opponents press. Both model teams can replan; keep starting states fixed for comparisons. Retain all outcomes, including failed buildups.

Measure controlled carrying across boundaries, pass reception and follow-up control, turnovers, supporting spacing, keeper distribution and illegal attempts. Record rounds, requests, repairs, latency and cost beside football results. Adjust one coherent prompt or execution issue at a time; do not hide failed decisions behind automatic tactics.

Exit: reproducible short sequences demonstrate whether carrying, receiving and keeper buildup survive repeated decisions. Dry-run the exact request allowance and set combined/per-provider spending caps against the remaining balances before dispatch. Do not assume old balances or promise a price from the previous two-second cases.

Implemented boundary: `runMatchFromState` now shares the match scheduler, memory, repairs and receipts with full generation. It takes a fresh tick-zero state and a playing-time horizon. The offline CLI exports explicit scripted provenance and preserves the outcomes. The old two-second evaluator remains available for isolated diagnostics.

The bounded paired-model entry point is implemented. Across the original approved $0.60 allowance ($0.20 OpenAI / $0.40 Gemini), the initial failure, six compatibility probes and two excerpts used 61 requests and an estimated $0.43614375. Removing only `batch.orders.maxItems` from the provider schema resolved the initial HTTP 400 while preserving strict local validation. The first clip shows three completed passes with both models active but reaches its twelve-round cap at 6.7 playing seconds. The keeper clip shows a catch, distribution and carry, but every Cyan round fell back after invalid Gemini output; it cannot establish competitive buildup. A keeper-ID schema experiment used for that clip was reverted to the schema that worked for both models. [Slice 21](slices/21-MODEL-SEQUENCES-AND-SCHEMA.md) retains all results.

The separate receiver sample was skipped because its starting state is identical to the carrying case apart from match ID. The first clip already records receptions and subsequent model decisions. The next keeper-order slice now passes a three-round first-attempt check: six valid full-roster replies, no fallback or execution failures, and an engine-resolved catch, roll and reception with both teams active. It costs $0.03487 within the original allowance. Clearer role instructions and specific field errors preserve the working schema and strict acceptance rules. [Slice 22](slices/22-KEEPER-ORDER-RELIABILITY.md) records the evidence. Review this new 2.45-second clip, then check a sustained keeper sequence before a full run. The older inactive-opposition clip remains labelled and cannot support full-match claims.

A paired round requires two initial requests and permits up to four with one repair per team. Reception and phase changes can add rounds, so derive request ceilings from explicit maximum rounds, not only the nominal one-second interval. Preserve every recording, metric and stop reason, including failed criteria. Select states, seeds and success criteria before future runs.

## 3. A fresh complete match

The user has explicitly deferred the full run until they like the football and add credit. Once the short sequences are satisfactory, generate a new match with the current models and two 30-second playing halves. Keep duration fixed for comparison. Review explicit provider budgets and stop limits first; no automatic full run is scheduled by this plan.

Watch every phase, retain the actual result, verify replay and publish it to the local catalogue. Assess whether there is sustained buildup, useful width, credible keeper play, chances for both sides and readable changes of possession. A quiet draw is evidence, not a reason to manufacture goals or silently discard the match. Compare football and generation cost with the previous baseline while acknowledging the changed rules and prompts.

Exit: a verified, honestly labelled LLM match plus a short assessment that identifies the next concrete football issue. Extend match duration only after this review.

## 4. Polish the moments that matter

Use the new match to select a small presentation pass: anticipation during real attacks, different reactions to catches/parries/misses, readable keeper distribution, and clearer robot responses to successful or failed combinations. Preserve the whole-pitch default, comic style, quiet ambience and hidden-until-needed controls. Camera and sound support actual events; they never affect outcomes.

For the X/LinkedIn announcement, capture a short clip from the actual current model match, add social preview metadata/image, and prepare the posts. Verify the complete local version, then publish it as the final release. Match pages and further highlights can follow. Hosting is separate from pushing source or publishing the local catalogue. Accounts, live generation, tournaments and new stadium themes remain later possibilities.

## Working rhythm

Implement only the next approved slice. Each handoff includes the code change, invariant, focused checks, a mechanism explained clearly, limitations and one proposed next slice. Keep work on main, preserve user edits, and update current docs as behavior changes.
