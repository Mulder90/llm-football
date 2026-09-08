# Next steps

Goalkeeper possession is complete. The remaining sequence starts with sustained short decisions; later paid evaluations and a complete match still need their own bounded review. [Current progress](PROGRESS.md) records measured results; [historical handoffs](slices/README.md) preserve earlier work.

The carrier-choice slice is complete: clearer carry/pass/shoot guidance, compact memory, stable schemas and fewer release-triggered rounds. Twenty short-case requests cost approximately $0.11 and all passed validation first try. Sustained teamwork remains unproven.

## 1. Goalkeeper possession — complete

The offline keeper slice is implemented in `football-0.6`: persistent hands, eligible guard catches, pickup, roll/throw/punt/put-down, handling restrictions, protected possession, the eight-second limit and its referee countdown. Model targets remain explicit; the engine chooses no outlet or run. [Decision 011](decisions/011-GOALKEEPER-HAND-POSSESSION.md) records the contract, timing and deliberate simplifications.

**Safe hands, open play** is the current scripted default. It shows a pickup, movement in hands, roll and reception, an opponent return, catch, throw and another reception. Incompatible development LLM files/catalogue entries are removed; there is no legacy playback or relabelled outcome. Watching costs no inference. [Slice 18](slices/18-GOALKEEPER-POSSESSION.md) records verification and the mechanism.

The response schema remains stable across requests. Shared action shapes and compact rule wording keep bounded full-roster/memory requests within the existing 32 KiB limit; delivery-specific limits are also enforced by runtime and recording validation. No paid requests were needed.

## 2. Sustained football decisions

Extend evaluation from one batch over two seconds to several paired decisions over roughly 6–10 playing seconds. Reuse the real scheduler, frozen observations, memory, budgets and receipts. First validate the evaluation path offline with scripted controllers.

Use three focused situations: a carrier advancing into space before pressure arrives; a pass whose moving receiver must control it and choose a next action; and a keeper collecting then distributing while teammates offer outlets and opponents press. Both model teams can replan; keep starting states fixed for comparisons. Retain all outcomes, including failed buildups.

Measure controlled carrying across boundaries, pass reception and follow-up control, turnovers, supporting spacing, keeper distribution and illegal attempts. Record rounds, requests, repairs, latency and cost beside football results. Adjust one coherent prompt or execution issue at a time; do not hide failed decisions behind automatic tactics.

Exit: reproducible short sequences demonstrate whether carrying, receiving and keeper buildup survive repeated decisions. Dry-run the exact request allowance and set combined/per-provider spending caps against the remaining balances before dispatch. Do not assume old balances or promise a price from the previous two-second cases.

Implementation dependency: `evaluateControllerScenario` currently applies one accepted batch against fixed opposition and advances two simulation seconds. Increasing its duration alone would not test repeated decisions. First make the existing match runner usable from an explicit scenario state with a bounded playing-time stop, reusing its paired scheduler, memory, repairs and receipts. Keep this football-specific; do not introduce a second scheduler or a generic runner framework. Scripted runs must retain fixture provenance rather than inheriting the runner's current `kind: 'llm'` label.

Review the offline evaluation harness before paid execution. A paired round requires two initial requests and permits up to four total with one repair per team. Reception and phase changes can add rounds, so derive request ceilings from explicit maximum rounds, not just the nominal one-second interval. Preserve every run's recording, metrics and stop reason. Choose fixed seeds, repetitions and football success criteria before dispatch; decide whether the observed sequences justify a complete match after reviewing all outcomes.

## 3. A fresh complete match

Once the short sequences are satisfactory, generate a new match with the current models and two 30-second playing halves. Keep duration fixed for comparison. Review explicit provider budgets and stop limits first; no automatic full run is scheduled by this plan.

Watch every phase, retain the actual result, verify replay and publish it to the local catalogue. Assess whether there is sustained buildup, useful width, credible keeper play, chances for both sides and readable changes of possession. A quiet draw is evidence, not a reason to manufacture goals or silently discard the match. Compare football and generation cost with the previous baseline while acknowledging the changed rules and prompts.

Exit: a verified, honestly labelled LLM match plus a short assessment that identifies the next concrete football issue. Extend match duration only after this review.

## 4. Polish the moments that matter

Use the new match to select a small presentation pass: anticipation during real attacks, different reactions to catches/parries/misses, readable keeper distribution, and clearer robot responses to successful or failed combinations. Preserve the whole-pitch default, comic style, quiet ambience and hidden-until-needed controls. Camera and sound support actual events; they never affect outcomes.

Then plan the shareable public site: fast arrival on the pitch, match pages and useful highlights. Hosting is separate from pushing source or publishing the local catalogue. Accounts, live generation, tournaments and new stadium themes remain later possibilities.

## Working rhythm

Implement only the next approved slice. Each handoff includes the code change, invariant, focused checks, a mechanism explained clearly, limitations and one proposed next slice. Keep work on main, preserve user edits, and update current docs as behavior changes.
