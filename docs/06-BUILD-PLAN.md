# Next steps

Proposed sequence following the carrier-choice evaluation and the user's request to plan goalkeeper handling. This is a plan, not a statement that the features below are implemented. [Current progress](PROGRESS.md) records measured results; [historical handoffs](slices/README.md) preserve earlier work.

The carrier-choice slice is complete: clearer carry/pass/shoot guidance, compact memory, stable schemas and fewer release-triggered rounds. Twenty short-case requests cost approximately $0.11 and all passed validation first try. Sustained teamwork remains unproven.

## 1. Proper goalkeeper possession

Deliver one reviewable keeper sequence: collect a legal ball, hold it visibly, then distribute to a model-chosen target.

Represent hands separately from foot possession in canonical state, observations and replay samples. Guarding retains its documented automatic catch reach; an explicit pickup can lift an eligible ball already controlled at the keeper's feet. Neither action chooses a position or chases a ball automatically. A catch must persist as hand possession until a release, restart or half ending; changing a movement order must not silently put the ball down.

Give the controller compact release choices: roll, throw, punt or put down to play with the feet. Reuse existing target, speed and loft concepts where appropriate, with clear physical bounds per delivery. The model selects delivery and teammates' runs; the engine resolves flight and reception. Expose handling eligibility, possession mode and remaining hold time without prescribing tactics.

Cover own-area handling, protected possession, deliberate teammate kicks/direct teammate throws, and handling again after release before another player touches the ball. Track relevant touches explicitly; a deflection must not silently erase a restriction. Define handling at the penalty-area boundary using the ball's position, including when the keeper moves while holding it. Document deliberate simplifications and unsupported cases rather than claiming complete Laws compliance.

Use the current eight-second holding limit and corner sanction, with the referee's final-five-second signal. Count simulation playing ticks, never provider latency or presentation time. Holding does not pause the match clock. Use [IFAB Law 12](https://theifab.com/laws/latest/fouls-and-misconduct/) as the rule reference and verify boundary/sanction details during implementation.

Render a ground scoop, a catch into gloves, held-ball movement and readable releases, with restrained catch audio and the existing save reaction. Animation reads the real possession state; it cannot make a failed save appear caught. Include pause, seek and playback-speed checks.

Exit: deterministic offline cases prove legal catches, foot-only back-pass control, protected possession, each release, handling restrictions, area and timer boundaries, end swaps, half endings and exact replay. Show the sequence in a clearly labelled scripted fixture. No paid model calls are needed for this slice.

This changes the engine/recording contract. Bump the ruleset, update validators, prompts, fixtures and current docs together. Remove incompatible public development recordings and catalogue entries instead of adding legacy playback or relabelling old outcomes. Provide a current scripted demo so the viewer remains usable until a new LLM recording exists. Record the accepted choice alongside implementation, not as a speculative ADR now.

## 2. Sustained football decisions

Extend evaluation from one batch over two seconds to several paired decisions over roughly 6–10 playing seconds. Reuse the real scheduler, frozen observations, memory, budgets and receipts. First validate the evaluation path offline with scripted controllers.

Use three focused situations: a carrier advancing into space before pressure arrives; a pass whose moving receiver must control it and choose a next action; and a keeper collecting then distributing while teammates offer outlets and opponents press. Both model teams can replan; keep starting states fixed for comparisons. Retain all outcomes, including failed buildups.

Measure controlled carrying across boundaries, pass reception and follow-up control, turnovers, supporting spacing, keeper distribution and illegal attempts. Record rounds, requests, repairs, latency and cost beside football results. Adjust one coherent prompt or execution issue at a time; do not hide failed decisions behind automatic tactics.

Exit: reproducible short sequences demonstrate whether carrying, receiving and keeper buildup survive repeated decisions. Dry-run the exact request allowance and set combined/per-provider spending caps against the remaining balances before dispatch. Do not assume old balances or promise a price from the previous two-second cases.

## 3. A fresh complete match

Once the short sequences are satisfactory, generate a new match with the current models and two 30-second playing halves. Keep duration fixed for comparison. Review explicit provider budgets and stop limits first; no automatic full run is scheduled by this plan.

Watch every phase, retain the actual result, verify replay and publish it to the local catalogue. Assess whether there is sustained buildup, useful width, credible keeper play, chances for both sides and readable changes of possession. A quiet draw is evidence, not a reason to manufacture goals or silently discard the match. Compare football and generation cost with the previous baseline while acknowledging the changed rules and prompts.

Exit: a verified, honestly labelled LLM match plus a short assessment that identifies the next concrete football issue. Extend match duration only after this review.

## 4. Polish the moments that matter

Use the new match to select a small presentation pass: anticipation during real attacks, different reactions to catches/parries/misses, readable keeper distribution, and clearer robot responses to successful or failed combinations. Preserve the whole-pitch default, comic style, quiet ambience and hidden-until-needed controls. Camera and sound support actual events; they never affect outcomes.

Then plan the shareable public site: fast arrival on the pitch, match pages and useful highlights. Hosting is separate from pushing source or publishing the local catalogue. Accounts, live generation, tournaments and new stadium themes remain later possibilities.

## Working rhythm

Implement only the next approved slice. Each handoff includes the code change, invariant, focused checks, a mechanism explained clearly, limitations and one proposed next slice. Keep work on main, preserve user edits, and update current docs as behavior changes.
