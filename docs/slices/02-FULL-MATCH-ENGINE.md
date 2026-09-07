# Slice 2 — Full-match engine and replay

Implemented on `main`, per the user's request to stop using feature branches.

## Result

The default viewer now plays an entire scripted 11-a-side match: two three-minute playing halves, goal detection, physical shots and blocks, keeper guarding, tackling, throws, corners, goal kicks and bounded restarts. A selector retains the original passing fixture. Keeper arms and tackle legs communicate their recorded actions. Scores, clocks and direction changes come from the recording.

The canonical full fixture ends at simulation tick 26,542, with 21,600 playing ticks: 360 playing seconds and 442.3667 seconds of presentation. Its diagnostic hash is `ade3665c`. It happens to end 19–19, with 40 shots and 40 tackles. This is a deliberately transparent scripted development baseline, not LLM footage or evidence of strong tactics. No result was assigned or selected to improve drama.

## Invariant and mechanism

A renderer cannot turn a shot into a goal. To reimplement incident handling, first integrate the ball's proposed segment for one 1/60-second step. Find the segment fraction at each expanded post/bar contact, eligible player contact, and whole-ball boundary plane. Sort by fraction and apply the earliest result once. For a goal, check lateral clearance including the ball radius and height below the bar. Otherwise use last touch to award the restart. Resolve this before incrementing the playing clock so a legitimate final-tick goal counts. End-of-half then freezes interactions. Stable tie rules and the discarded remaining fraction are documented in decision 002.

The two clocks explain why the replay exceeds six minutes: playing ticks advance only during open play; simulation ticks also include setup, delivery waiting and halftime. Browser animation timing never enters either clock. Keyboard End seeks to the final integer tick, avoiding HTML range-step rounding.

## Verification

- 29 focused tests pass: deterministic replay, untrusted team batches, swept collisions, whole-ball boundaries, all boundary/last-touch combinations, guarding reach, restart legality, deadline abandonment, direct throw-in and second-touch restrictions, physical tackles, both half boundaries and full-match replay.
- Strict TypeScript and production build pass. Prettier formats code and docs.
- The passing fixture retains its reviewed nine-kick event sequence; the new engine/state schema changes its checksum from `dc3e4d38` to `55a34a81`.
- Browser inspection confirms the full fixture is labelled scripted and can reach full time. The exact-end slider issue found during this check was corrected to integer ticks. Existing pause, speed, seek, player-number and decision controls remain available.

## Limitations and next slice

The rules are a simplified model with the omissions listed in [decision 002](../decisions/002-MATCH-RULES.md), including fouls, cards, penalties and offside. The fixture's tactical quality is poor; it is a lifecycle baseline. No API calls have been made and imported replay JSON is not yet supported. The next slice adds common model observations, provider adapters, bounded simultaneous decisions, provenance and a short paid smoke run before scaling to a complete game.
