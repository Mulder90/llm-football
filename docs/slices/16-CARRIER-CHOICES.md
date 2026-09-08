# Slice 16 — Carrier choices, leaner requests and current docs

## Changes

The carrier now chooses between carrying, passing and shooting before arranging a receiver. Open-space carrying and pressure-dependent passing are explicit; restart delivery remains mandatory. Memory asks for three important off-ball jobs rather than repeating the entire formation. All active players still need orders. A pass note is only for a pass ordered now, which avoids promoting its receiver to ball player while retaining the same pass.

The provider response schema is stable across teams and decisions. Changing identities stay in observations and remain strictly checked in code. A release into flight no longer triggers an extra early decision; acquisition and phase changes still can. Neither physics nor tactical execution assistance changed. [Decision 010](../decisions/010-CARRIER-CHOICES-AND-REQUESTS.md) records the tradeoffs.

The evaluation CLI can select models and authored situations, inspect request sizes without paid calls, and replay exact possession boundaries from a recording. It now includes an open shooting chance. Recorded counterfactual cases use the actual initial state, accepted earlier decisions, prior own memory and opponent batch at that boundary. Both teams are supported. After that batch, the opposition follows its existing orders without further replanning; these cases are not new model-versus-model games.

The obsolete concept image was removed. The initial proposal brief is archived, working instructions point to current guides, and historical handoffs are labelled. Current product, architecture, presentation and roadmap docs were corrected; the documentation index and decision index explain what is authoritative. The user-approved browser title is LLM Football.

## Bounded model evaluation

`carrier-choices-001` ran two repetitions of five cases with GPT-5 mini and Gemini 3.8 Flash. It made 20 requests, all accepted on the first attempt. Every batch ordered all eleven players, every memory contained three assignments, and the engine recorded no own-order failures.

| Situation                           | GPT-5 mini, two repetitions                                | Gemini 3.8 Flash, two repetitions         |
| ----------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Open carrying space                 | 5.10 m carry; completed pass to #6                         | Two 10.97 m carries                       |
| Immediate tackle pressure           | Two completed outlet passes, no turnovers                  | Two completed outlet passes, no turnovers |
| Open shooting chance                | Two shots: one goal, one miss aimed outside the posts      | Two shots, two goals                      |
| Recorded Coral possession, tick 196 | 5.53 m carry; completed pass to #10                        | 5.51 m and 6.37 m carries                 |
| Recorded Cyan possession, tick 2783 | Two passes: one still loose after 2 s, one completed to #6 | Two completed passes to #6                |

Six responses chose a deliberate carrier move and kept possession for the full two seconds. Carry distance counts movement while the same player owns the ball before and after a playing tick. Passes are assessed from actual receptions; a ball still loose at the horizon is unresolved, not automatically a failed pass. Shooting cases end when the engine leaves open play, so those samples are shorter than two seconds.

The recorded positions were selected from the prior match because the carrier had space: nearest opponent 13.71 m for Coral and 16.18 m for Cyan. Both original model decisions were kicks. The new choices are useful evidence, but snapshots have only a two-second horizon and fixed opposition. There is no new full-match result, no claim that every open possession should become a dribble, and no causal attribution to an individual prompt or caching change.

| Measured per-request mean          | GPT-5 mini | Gemini 3.8 Flash |
| ---------------------------------- | ---------- | ---------------- |
| Latency                            | 11.31 s    | 8.62 s           |
| Input tokens                       | 6,064      | 5,652            |
| Output tokens, including reasoning | 1,050      | 824              |
| Reported cached share of input     | 60.8%      | 20.1%            |

These are ten requests per model, not a matched latency benchmark against the prior match. Provider load, context and output differ. Output is smaller than the prior match average, but Gemini latency did not improve in this sample. The fixed-situation evaluation does not run the new multi-turn cadence; that change is covered offline and still needs sustained-play evaluation.

Estimated spending was **$0.036166 OpenAI + $0.07327275 Gemini = $0.10943875**. The enforced caps were $0.12 / $0.22, $0.34 combined. Cache discounts are not applied. The job completed, released its lock and made no further requests. Full observations, decisions and receipts remain in ignored `artifacts/private/carrier-choices-001/report.json`.

Reproduce deliberately with a new name; omit `--dry-run` only when intending to spend:

```sh
pnpm evaluate-controllers --dry-run --name carrier-choices-002 \
  --models gpt-5-mini,gemini-3.8-flash \
  --scenarios carry-space,pass-pressure,shooting-chance \
  --recording public/matches/positional-match-001.json.gz \
  --possessions coral:5,cyan:82 --repetitions 2 \
  --usd .34 --openai-usd .12 --gemini-usd .22
```

Possession selectors are team plus zero-based decision index, not playing seconds. Replay reconstructs the boundary before applying that decision, then uses the recorded opponent batch and a newly requested own batch. No future opponent decisions are supplied.

## Verification and next step

TypeScript and 176 tests pass. The tests cover existing physics and replay, schema/identity rejection, release/reception scheduling, input-size bounds, shooting outcomes and exact recorded snapshot extraction for both sides. The production build and Prettier check pass; all 135 local links across 42 Markdown files resolve. Each published recording validates and independently replays to its original hash: positional `cd60f48a`, character `36dbd671`, tactical-memory `31ab92f4`. The documented dry run lists 20 base requests and inputs from 24,771 to 28,261 bytes, below the unchanged 32,768-byte limit, without making provider requests.

The next useful slice is sustained short possessions: retain a carry across decisions, release when pressure arrives, and have the receiver control the pass. That should establish whether these better individual choices survive repeated replanning before another complete paid match.
