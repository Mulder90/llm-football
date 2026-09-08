# Slice 19 — Offline sustained-play harness

## Result and invariant

Three eight-second football sequences now run through the actual paired match scheduler. Both sides receive frozen observations, replace their own accepted memory, and can replan after receptions, turnovers and phase changes. The evaluation stops on playing ticks without fabricating halftime or full time. Simulation rules and physical execution assistance are unchanged.

All work stays local. The existing live website is an older release and is excluded from readiness assessment. No provider calls, publication or deployment occurred in this slice.

## Measured scripted baseline

Command: `pnpm evaluate-sequences --name sustained-local-01 --repetitions 2`.

All six runs reached 480 playing ticks and passed the fixed criteria. They produced 54 paired rounds and 108 local scripted calls, with zero repairs, fallbacks, engine order failures, keeper violations or paid usage. Each repeated starting state reproduced the same final hash.

| Sequence                   | Rounds / calls per run | Actual outcome                                                                                                                             | Replay hash |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Carry before pressure      | 8 / 16                 | Coral retained control across eight carry decisions and travelled 27.31 m with the ball, with 25.73 m maximum controlled forward progress. | `791b60d1`  |
| Receive and choose again   | 9 / 18                 | Coral #6 received #7's pass, chose a move at the next decision and carried 15.43 m.                                                        | `b908e5af`  |
| Collect and find an outlet | 10 / 20                | Coral #1 caught the incoming ball and threw to #3, who controlled it and carried 13.42 m.                                                  | `c0ca8cc7`  |

These are explicit scripted baselines, not evidence of model intelligence. Both sides submit orders, but the opposing script is intentionally limited: it begins pressing after three seconds and uses exact action readiness for a named tackle. Holds, runs, receiver targets and keeper throws are authored in `fixtures/sustained-play.ts`. The runner does not supply them to future model controllers.

The ignored output folder is `artifacts/private/sustained-local-01/`. `report.json` preserves metrics, criteria, stop reasons, timings, costs and file/hash references; each scenario/repetition has its own importable recording containing exact observations, replies and accepted decisions. An incomplete or failed result remains in the report. A new run name prevents accidental replacement of prior results.

## Mechanism to reimplement

Keep the original scheduler state: last decision tick, last observed ball owner and phase identity. Serialize both team observations before dispatching either controller. Wait for both accepted replies or explicit fallbacks, apply them together, then advance the engine one tick. Regular decisions occur every 60 ticks; gaining possession may interrupt once 15 ticks have elapsed. A release into flight does not itself interrupt.

Before starting another iteration, compare playing ticks with the requested horizon. Stop immediately at equality, so no decision is recorded at the end without a physical step to consume it. A checkpoint after a decision is written only after its first step. This makes every saved boundary independently replayable, including budget stops and cancellation before the next pair.

The pass case demonstrates the timing: release is at tick 0; the ordinary next decision is tick 60. Reception occurs during interval 71 and becomes visible at frame 72. The minimum spacing since tick 60 delays the next paired decision to tick 75. The receiver then moves under a newly accepted order. Keeper collection similarly interrupts both teams, making that case use ten rounds instead of eight. Request ceilings therefore come from the explicit round cap, not eight seconds times two teams.

Metrics perform a separate canonical replay. They count every playing interval, continuous foot/hand carry, controlled forward progress, turnovers, uninterrupted pass reception/follow-up, keeper events, failures and supporting spacing. They do not estimate distances from interpolated viewer frames. A restart resets continuous-control tracking so referee placement is not counted as a carry or turnover.

## Verification

- `pnpm check`: TypeScript and **242 tests across 28 files passed**. New coverage includes canonical replay, both-team memory isolation, response-order independence, real reception scheduling, explicit negative football outcomes, repairs/fallbacks, cancellation and request/input/provider-budget stops.
- Playing-time tests cover paused restart intervals, no dispatch at the horizon, replayable intermediate checkpoints, invalid limits, tick-zero starts, keeper failure/holding sanctions and rejection of contradictory imported labels or horizon claims.
- The existing worst-case UTF-8/control-character memory check still fits the unchanged 32 KiB input limit with the new evaluation context. Initial offline requests measured 23,287–23,313 bytes.
- `pnpm build`: passed. The viewer bundle is 437.35 kB / 138.31 kB gzipped, with no new dependency or paid adapter added to browser imports.
- Six exported CLI recordings independently verified; repeated scenarios have identical hashes. Reusing an existing run name and an unknown scenario both fail without changing the prior report; the generation lock is released.
- Local browser import, scripted/excerpt labels, call counts, replay and inspection were checked. The keeper excerpt correctly shows 10 shared boundaries, 20 scripted calls and zero usage. The excerpt played to its 8-second endpoint, then seeking to 4.5 seconds showed the receiver in control. Its displayed boundary at tick 227 had 253 evaluation ticks remaining and the previous private plan; the recorded scripted reply was accepted. Captured console warning/error logs were empty.
- Changed-file formatting, whitespace and local documentation links were checked.

## Limits and next slice

This is a fresh-state harness, not generation resume or replay rebasing. Only two scripted or two model controllers are accepted; mixed provenance is deliberately unsupported. The current CLI exposes scripted runs only and neither reads `.env` nor constructs a paid adapter. The callable evaluation path retains the model budget barrier, verified using mocks.

A report marked complete means the planned sequence ended; it does not mean all football criteria passed. A recording remains an evaluation excerpt, not a completed two-half match. No feedback rewrites an invalid action or selects a better outlet. Physical body separation can add small path movement, so path length and forward progress are separate metrics.

The proposed next slice is a bounded paired-model evaluation on these same scenarios, with reviewed configurations, an explicit round/request allowance and fresh combined/per-provider budgets. Retain all outcomes, review the football, then generate a current complete match locally. Publish the final version after it is ready, following the user's instruction.
