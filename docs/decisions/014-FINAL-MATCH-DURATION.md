# 014 — Final match duration

Status: accepted, 2026-09-08.

The user requested one final two-minute match: one minute of playing time per half. `football-0.9` sets `MATCH_TIMING.halfPlayingTicks` to `60 * TICK_RATE`, or 3,600 ticks. This supersedes decision 006's 30-second development halves. Short evaluations use the existing playing-horizon limit instead of introducing multiple supported match rulesets.

The referee, observations and shared rulebook read the same constant. Restart setup/delivery and halftime pause playing time; the end of each half still resolves tick incidents before advancing phase. Full time is exactly 7,200 playing ticks, while simulation and presentation are longer. Players still swap ends once. Provider latency cannot change football time.

The user raised slow-feeling players but preferred avoiding more tuning cost/time, then authorized additional spending for the final run if needed. Keep speed at 7 m/s and acceleration at 18 m/s². Open-play move orders in the previous match averaged 0.8056 Coral / 0.8054 Cyan pace; top speed is already reached in approximately 0.39 seconds on an unobstructed full-pace run. Those commanded paces are not measured average player velocity. No new automatic runs, forced shots, movement targets, tactical rules or paid comparison were added.

Changing the duration affects legality at halftime/full time and what time remains in each observation, so old recordings keep their original engine tag and private source snapshot. Do not relabel a previous match or run it under the new duration. The deployed 0.8 review is unchanged during local generation. Only the final recording will be bundled locally when complete.

Verification covers 60-second half clocks, 120-second full completion, halftime end swaps, observation/prompt timing, the maximum permitted excerpt horizon, replay and goal-presentation seeking. The unchanged short passing fixture retains all its football state and events; setting only its diagnostic state version back to 0.8 reproduces the prior checksum. No backward-compatibility layer or extra dependencies are needed. Revisit duration only on explicit user direction.
