# Slice 25 — Faithful ball geometry and a clearer football objective

The user approved keeper placement, goal/attacking awareness and a tackle review, using short paid tests where sufficient and one full minute when useful. They clarified that normal LLM mistakes are part of the fun, and set the eventual final match to one minute per half (two minutes total). The current review retains two 30-second development halves.

## What changed

- `football-0.8` retains the legal catch/pickup location in XY. A held ball moves by actual keeper displacement, so facing cannot create an instant outside-area offence. Real movement outside still incurs the same rule.
- Ordinary kicks/shots launch from the actual recorded ball, fixing a parallel shift caused by rotating the launch offset after calculating the chosen direction. Restart locations/heights remain explicit.
- Observations include distance/opening to the current opponent goal, signed ball-centre pitch clearances and the existing tackle foul test for a reachable opposing foot carrier. These are neutral facts, not chosen actions or success probabilities.
- The prompt starts with scoring more goals and winning. It encourages good shots, sensible carry/pass choices, cutbacks at narrow angles and factual plan reviews. Models still choose every target, pace, pass, shot and challenge.
- An empty catalogue in Vite development opens the existing labelled keeper practice, keeping local import accessible during a ruleset change. Production still requires a bundled recording.

No new football laws, automatic tactics, winner selection, provider/model upgrades or request-cadence changes were added. Main README remains evergreen. The existing Cloudflare release was not redeployed.

## The mechanism

A catch already has a swept contact position, calculated between the previous and next ball/player positions. Keep that contact XY and set hand height to 1.2 m. On later held ticks, calculate `keeper.position - previousKeeperPosition` and add that delta to the ball. Facing never enters the calculation. Using the actual delta also includes body separation; adding zero preserves an exact area-line ball without reconstructing a floating-point offset. Test legality at the completed 1/60-second position, keeping the existing possible sub-tick overshoot. The remaining fraction of a catch tick is discarded, as for other contacts. Put-down still transitions to the documented foot anchor.

For a kick, calculate its direction from `target - actualBallPosition`, keep that starting XY and assign the chosen velocity. The old engine calculated that direction but then rotated an independent 0.8 m launch offset around the player. Near the goal line this shifted an intended miss into a goal; retaining the origin fixes both shooting and pass-meeting geometry without selecting a better target.

Goal opening uses the two post vectors and `atan2(abs(cross), dot)`. It ignores blockers, height and tactical value. Distances/angles are computed before display rounding. Direct post offsets avoid cancellation at the degenerate post position; a goal-plane ball between posts yields 180 degrees, at a post 0. Neither is a scoring probability.

## Reproduced evidence

The saved pre-tick 3245 state from `keeper-era-match-001` now catches at (103.18770264030306, 33.24805840134152, 1.2) and stays in open play. The original 0.6 match, its goal and its private files remain unchanged. This is an offline diagnostic under the new engine, not a rewritten replay.

The first eight paid choices used internal `football-0.7`. In the narrow-angle case Mini aimed at (105, 30) from a ball at (102.65, 18), outside the post opening, but the old launch rotation produced a goal. Those original reports and the complete source snapshot are retained privately. Re-executing the same accepted choices offline under 0.8 keeps all four open-chance goals, makes the two narrow Mini shots hit the frame and go out, and delivers both Gemini cutbacks to Coral #6. These are re-executions, not fresh model decisions.

The pass-pressure fixture moves the defender to x=46.65, still in immediate tackle reach but outside initial passive collection overlap. Its old x=46.2 position depended on the launch jump to escape that overlap. The source snapshot retains the old fixture.

The tackle review retains the current 5/10 m/s relative closing thresholds. The previous red-card incident was two players approaching at 6.3 m/s each: 12.6 m/s closing. Those are declared game heuristics, not numerical IFAB rules. Exposing the existing foul calculation lets the model consider braking/containment without automatically changing a challenge.

## Short model tests and accounting

| Test                                              | Result                                                                    | Requests | Estimated OpenAI | Estimated Gemini | Estimated total |
| ------------------------------------------------- | ------------------------------------------------------------------------- | -------: | ---------------: | ---------------: | --------------: |
| Open shot and narrow angle, two repeats per model | 8/8 first replies accepted; diagnostic execution described above          |        8 |        $0.014466 |      $0.03172425 |     $0.04619025 |
| Keeper outlet, 8 seconds                          | Legal catch and throw, intercepted outlet; Cyan later completes a pass    |       20 |       $0.0376335 |      $0.08177625 |     $0.11940975 |
| Receive and follow up, 8 seconds                  | Coral #6 receives and carries 3.745 m; later turnover, Cyan pass and shot |       20 |       $0.0358675 |         $0.08214 |      $0.1180075 |
| Total                                             | 48 first-attempt accepted replies, full rosters, no repairs/fallbacks     |       48 |        $0.087967 |       $0.1956405 |      $0.2836075 |

Both paired excerpts reach exactly eight playing seconds. They contain no failed orders or handling violations. Their hashes are `501a5790` (keeper) and `30851565` (receiving). The paired trial took 251.73 generation seconds and stayed within $0.60 / $0.20 OpenAI / $0.40 Gemini, 128 attempts and 15 minutes. The shot trial stayed within its separate $0.24 / $0.08 / $0.16 caps and 16 attempts. These are usage-based estimates, not confirmed billing.

The keeper drill's specific `catchesThenDistributes` criterion is false because it requires a completed keeper pass. That is retained honestly, but an ordinary interception is not a match-readiness blocker. The user explicitly corrected the tendency to demand flawless LLM tactics. The receiving criterion is true. No paid rerun was made to select a nicer outcome.

## Full-minute review

**Playing to win** (`goal-aware-match-001`) completes both 30-second halves: **Coral 1–3 Cyan**. Independent replay verifies **`8eed7d0a`**, 60 playing seconds and 78.9 simulation seconds. Goal celebrations extend presentation to about 1m 47s at normal speed; this does not add playing time or model requests.

Generation takes **1,359.41 seconds (22m 39s)**, with **105 paired rounds / 210 requests**, all accepted first try, no repairs or fallbacks. Estimated cost is **$1.26326275** ($0.39642025 OpenAI / $0.8668425 Gemini), within $1.50 combined / $0.50 / $1, 150 rounds / 600 attempts and 30 minutes. Together with this slice's short tests: **258 requests, $1.54687025 estimated** ($0.48438725 OpenAI / $1.062483 Gemini). No final two-minute run or further paid retry was dispatched.

The match has nine shots (Coral three, Cyan six), sixteen completed passes, 25 deliberate carrier-move choices, two Coral keeper catches and two throws. One throw reaches Coral #3, whose next pass is intercepted. There are no handling violations or cards. Coral takes the lead, Cyan equalizes before halftime and scores twice after the break. Outcomes are preserved exactly.

209/210 team batches cover the full active roster; Coral omits #2 at tick 2782. Missing orders retain the normal continuation/expiry behavior. Six tackles fail to reach the carrier, and a kick immediately following a restart release fails without foot possession. Accepted JSON is not a promise of tactical success. These remain actual model actions and engine feedback, with no outcome editing or retry to improve the football.

The exact dispatched source and stored observations/rulebook are retained privately. An observation-only refinement made direct post offsets exact at the degenerate post point after dispatch; replay comparison confirms **all 210 actual rounded goal-geometry observations are identical** under the final formula. It changes neither this match's inputs nor simulation outcomes.

Only title and description change in a separate catalogue copy; the original generation file stays intact. The compressed public file round-trips exactly to that copy, which independently replays to the same hash. The local catalogue contains this one complete match; the older public file/catalogue remains archived privately. The Cloudflare release is unchanged.

## Checks and limits

TypeScript and all 287 tests pass. New regressions cover mirrored goal/area edges, exact-line turning, just-outside contacts, real held exits, unchanged kick origin, goal/end symmetry and exact tackle thresholds. Existing request-size tests still fit maximum UTF-8/JSON-escaped memory and bounded repair feedback within 32 KiB. The production build and focused formatting pass.

Independent fixture replays pass: passing `0614dee1` (nine kicks, eight same-team receives, one Cyan interception, no order failures), keeper `ff421356` (nine events) and full scripted practice `cad63724` (60 playing seconds). Scripted practice and the real keeper excerpt were imported/played locally; the catch frame retains visible ball placement. These are not evidence that every future model decision will be good.

The completed local catalogue match loads with the correct title and provider labels, plays through both halves and goal celebrations, reaches 3–1/full time at exactly 01:00 playing time, and restarts at 0–0 using Watch again. The Matches inspector shows the new title/description and only this bundled recording alongside development-only practices. Browser logs contain no warnings or errors. README and analytics HTML are unchanged; final diff whitespace checks pass.

No new dataset is a guarantee of overall match quality. Interceptions, misses, cards and flawed plans remain ordinary outcomes. The next step is to watch the complete review; the final two-minute match follows the user's assessment, not a requirement to make every action succeed.
