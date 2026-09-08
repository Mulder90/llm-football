# Slice 23 — Complete one-minute match and keeper review

Date: 2026-09-08. The user funded Gemini, reported fresh balances of $3.17 OpenAI / £5.93 Gemini, and requested one complete minute before a conditional final run with two minutes per half. This slice generates and reviews the minute locally. No deployment or longer run has started.

## Result and invariant

**One minute, two models** is the new local default. GPT-5 mini's Coral loses **0–1** to Gemini 3.8 Flash's Cyan after two 30-second playing halves. Cyan #10 is dismissed early; the ten-player team continues to submit orders for its full active roster. The original result is preserved, including a keeper defect that affects the scoring sequence.

The complete `football-0.6` recording verifies to **`ac2a3856`**. Its 96 paired boundaries use 193 requests, one Coral repair and zero fallback turns. Both sides act from the same frozen observations. No simulation, prompt, provider setting, timing or repair policy changed during generation. The only catalogue-copy edits are its title and description; accepted actions, receipts, events and hash are identical to the original.

## Football assessment

| Measure                                                            |    Coral |    Cyan |
| ------------------------------------------------------------------ | -------: | ------: |
| Completed passes                                                   |        6 |       5 |
| Deliberate carrier-move boundaries                                 |       27 |      11 |
| Distance carried at feet                                           | 115.85 m | 57.95 m |
| Shots                                                              |        0 |       3 |
| Goals                                                              |        0 |       1 |
| Controlled playing seconds                                         |    25.38 |   10.37 |
| Playing ticks with two off-ball outfield teammates under 2 m apart |      503 |     163 |

The ball is loose for 24.25 playing seconds. Seven passes complete before halftime and four after. Both teams reverse their attack direction and keeper targets after changing ends. Cyan's second-half carry leads to a shot and Coral's catch. Coral's late carry stalls near the corner and ultimately runs over the goal line without a shot. There is one failed tackle, one red card and one yellow card.

Carrying is a real improvement over the previous full match's zero deliberate carrier moves. Distance is measured over canonical replay intervals with continuous foot possession, excluding restart placement; it is not all forward progress. Spacing counts an interval if any eligible pair is close, rather than claiming the whole formation is crowded. The red card affects the comparison. Eleven completed passes and active controllers do not establish reliable finishing or keeper buildup.

## Keeper defect and reproduction

At simulation tick **3245** (41.1333 playing seconds before the interval), Coral's keeper stands at **(104.6, 34)** and faces **(1, 0)**, following a guard target on its own x=105 goal line. The incoming shot contact is legal inside the area. `collectInHands` then attaches the ball using `handPosition`: player position plus facing times the **0.65 m** carrying offset. The result is **(105.25, 34, 1.2)**, beyond the goal line.

`resolvePlayerContact` immediately calls `updateHeldBall`. The area check fails and emits `save`, `keeper_violation` and `restart_awarded` on the **same tick**. The violation therefore arises from catch attachment, without a model decision to carry out. Cyan receives a free kick on the goal line and scores from its subsequent pass-and-shot sequence at tick 3427. The recorded goal remains valid under this engine; it is not clean evidence that the football is ready for a showcase.

The exact before/after state, computed hand position and three incident events are saved in ignored `artifacts/private/keeper-era-match-001/keeper-catch-evidence.json`. Replaying accepted actions to tick 3245 and advancing one tick reproduces it without provider calls. The 0.4 m player boundary inset is smaller than the 0.65 m possession offset. Catch eligibility uses the incoming contact position, while subsequent handling uses the attached position; that geometric mismatch escaped the short keeper test.

Next proposed slice: correct catch attachment near boundaries and test mirrored goals and area edges, while retaining genuine handling violations after subsequent movement. Document any physical execution assistance explicitly. Review the saved one-minute match before a ruleset change makes it incompatible; do not modify its historical outcome or add a legacy engine solely to keep it playable.

## Reliability and spending

Coral: **95/96** first attempts accepted, then one successful repair. Its rejected memory listed dismissed Cyan #10 as a threat, even though the text recognized the dismissal; active-opponent reference validation correctly rejected it. Cyan: **96/96** first attempts accepted. Every accepted boundary includes all active players. Maximum reported output tokens are 1,534 Coral / 1,020 Cyan, below the unchanged 4,096 cap.

The authorized ceiling was $3 combined / $1 OpenAI / $2 Gemini, 200 paired rounds / 800 requests including one repair per side, and 3,600 seconds. Actual estimates are **$1.1262515** combined: **$0.36848975 OpenAI / $0.75776175 Gemini**. Generation took **1,307.4842 seconds**, or **21m 47s**. The shared lock was released on completion. Private original recording, plan and review report are retained.

The previous full match used 133 paired rounds, 293 requests, 27 repairs and two fallbacks: $2.08662375 and 43m 43s. Its stored controller models, settings and price rates equal this run's. This match costs **46.0% less**, with 34.1% fewer requests and about half the generation time. Different match events, rules and prompts mean this is a measured run comparison, not a controlled attribution of savings to scheduling alone.

The estimates use [GPT-5 mini pricing](https://developers.openai.com/api/docs/models/gpt-5-mini) of $0.25 input / $2 output per million tokens and [Gemini 3.8 Flash introductory pricing](https://ai.google.dev/gemini-api/docs/latest-model?hl=en) of $0.75 / $3.75, verified on the run date. The [ECB reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) were USD 1.1614 and GBP 0.85740 per EUR. On that reference conversion, estimated remaining funds are **$2.80 OpenAI / £5.37 Gemini**; these are not confirmed balances or billing FX. The earlier short-trial spending is not subtracted from the user's fresh balances again.

A simple fourfold projection is **$4.51** ($1.47 OpenAI / $3.03 Gemini) and **87 minutes** for four playing minutes. It is not a dispatch cap or guaranteed price. The keeper defect prevents the user's quality condition from passing, so no further paid request has been made.

## Verification and viewing

- Preflight: TypeScript and **258 tests across 29 files** passed; the production build passed before generation.
- Strict recording validation, independent deterministic replay and canonical sequence measurement pass on the completed file; final playing time is exactly 3,600 ticks, hash `ac2a3856`.
- Local publication independently validates and replays the metadata-labelled copy. The raw catalogue recording is **15,094,447 bytes**, compressed to **1,418,949 bytes**. It contains recorded model data and no provider credentials.
- The catalogue differs from the original only in title and description; the built gzip matches the published local file byte for byte. The generation lock is absent after completion.
- The production build passes with the new catalogue: 171 modules, 437.80 kB JavaScript / 138.47 kB gzip. Browser playback reaches Full time at 0–1 with the complete-recording label. The inspector shows eleven Coral players, ten Cyan players and the keeper-review caveat. No browser warnings/errors were reported; the viewer is left at kickoff for review.
- Playing time is **60 seconds**; simulation time is **78.9 seconds** because restarts and halftime pause the playing clock. The viewer extends the recorded 1.85-second goal pause to nine seconds, making playback **86.05 seconds**, displayed as 01:26. Provider waiting time never extends play or keeper possession.

The current viewer and result remain local for review. The next paid match should follow the focused keeper fix and a fresh cost/size/deadline plan for the requested two-minute halves.
