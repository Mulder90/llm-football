# 013 — Catch placement and goal awareness

Status: accepted for local implementation and bounded testing, 2026-09-08.

## Evidence and decision

The full-minute `keeper-era-match-001` exposed a legal catch at tick 3245 which was moved to x=105.25 by an outward-facing keeper's 0.65 m anchor. That generated a same-tick outside-area free kick; the subsequent sequence produced the match's only goal. The user approved the proposed catch fix, goal/attacking awareness and tackle review, with short paid tests where sufficient and a full minute when necessary.

`football-0.8` preserves the catch/pickup contact XY and raises the ball to hand height. On subsequent ticks the held ball translates by actual keeper displacement, including collision separation. Facing does not alter its location. This requires no additional state fields: previous player positions already exist within `step`, and the recorded ball position is the anchor. The catch discards the remaining fraction of that contact tick, as existing contacts do. Translating zero leaves an exact area-line ball unchanged; moving outside still incurs the existing sanction. No artificial inward clamp or defensive run is added. Put-down retains the declared foot attachment mechanism.

Using the exact saved pre-incident state under the new engine gives a catch at (103.18770264030306, 33.24805840134152, 1.2), with no free kick. This is a diagnostic using historical starting state, not a rewritten replay. Original actions, outcome and private files remain intact. Recording format stays 2; the current viewer rejects the old ruleset instead of adding backward compatibility. The existing Cloudflare release is unchanged.

## Kick origin discovered by the short test

The first eight paid decisions used internal `football-0.7`. In the narrow-angle scenario, Mini aimed at (105, 30), outside the posts, yet scored: the direction was computed from the actual ball at (102.65, 18), then the engine moved the launch point to the player's newly rotated 0.8 m offset. This parallel shift was enough to turn the miss into a goal. It also displaced intended passes. The original report, patch and complete source snapshot are retained privately.

`football-0.8` also launches ordinary kicks/shots from the actual recorded ball XY. Aiming changes velocity and facing, not the origin. Restarts retain their explicit restart point and release height. No accuracy bonus or automatic target correction is added. The four open chances still score when the original accepted actions are re-executed offline; the two narrow Mini shots hit the frame and go out, and both Gemini cutbacks now reach the receiver. These are diagnostic re-executions under a new engine, not new model decisions or changes to the original report.

The pass-pressure fixture moves its defender from x=46.2 to 46.65: still within immediate tackle reach, but initially outside the 0.9 m passive collection circle around the ball. The old fixture depended on the teleport to escape that existing overlap. The original fixture/report remains in the source snapshot. The foundation fixture now hashes to `0614dee1`: nine kicks, eight same-team receptions and one Cyan interception with no order failures.

## Model inputs and objective

The prompt explicitly makes winning by scoring more goals the objective. It encourages taking a good chance, improving position only when useful, cutbacks/central passes/recycling at narrow angles, and reviewing actual progress rather than repeating a claim. No forced shot, possession timer, automatic pass or selected winner is introduced.

`teamContext.ballToOpponentGoal` gives exact-geometry distance and opening angle from the ball, rounded for observation. Angle is `atan2(abs(cross(post vectors)), dot(post vectors))`; a smaller goal-line distance outside the posts can reduce it. It is not xG and ignores blockers. Signed ball-centre clearances to four pitch edges expose the existing 0.65 m foot-offset hazard. Neither summary chooses a target or reads opponent orders.

The tackle review retains current 5/10 m/s relative closing thresholds. At the recorded red card both players approach at 6.3 m/s, producing 12.6 m/s closing. Ball-first challenges still incur the documented speed test. Observations now expose `tackleFoul` only as the existing calculation for a reachable opposing foot carrier; null does not promise success, and a release commits before a tackle. The model may brake or contain. This is a game heuristic, not an official numerical rule.

The response schema, models (GPT-5 mini / Gemini 3.8 Flash), reasoning settings, one-second cadence, repair bounds and two 30-second halves remain unchanged. Prompt wording is compressed to retain the 32 KiB input ceiling even with maximally escaped memory. Guidance follows [OpenAI prompting](https://developers.openai.com/api/docs/guides/prompting); the football priorities come from observed project failures, not a generic model migration.

## Verification and limits

Mirrored regression tests cover both goals, all penalty-area edges, stationary exact-line catches, just-outside contacts, turning and real movement violations. Observation tests cover end swaps, public-state symmetry, shrinking angles, degenerate post geometry and exact card thresholds. A new two-second narrow-angle scenario complements the open shot case; both use fixed opposition and are diagnostics, not full matches.

The user clarified that normal LLM mistakes are intended entertainment. An intercepted keeper outlet is not a bug or a reason to withhold a full review; fixed scenario criteria are measurements, not universal gates. Preserve those outcomes and distinguish them from the reproduced ball-position defects.

The first eight requests cost $0.04619025 estimated ($0.014466 OpenAI / $0.03172425 Gemini), all first-attempt accepted. [Slice 25](../slices/25-CATCH-AND-KICK-GEOMETRY.md) records the paired excerpts and completed 3–1 full-minute review, independently verified to `8eed7d0a`. All 210 full-match replies were accepted first try; normal execution failures and one omitted player order remain preserved. No further football laws or longer halves are part of this slice. The latest final-showcase target is one minute per half (two minutes total); current development tests retain 30-second halves. One match cannot establish sustained tactical quality.
