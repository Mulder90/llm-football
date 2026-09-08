# 012 — Bounded sequences use the match scheduler

## Context and decision

After the keeper slice, the user directed work to continue locally until a final version is ready to publish. The next approved slice is the offline sustained-play harness. The previous evaluator applies one batch for two seconds against fixed opposition; extending that loop would not exercise repeated paired decisions or memory.

`runMatchFromState` now owns the existing match loop. `generateMatch` remains a thin model-match wrapper that creates the ordinary kickoff. A bounded sequence supplies a fresh tick-zero state and a positive integer playing-tick limit. Both paths use the same observation barrier, scheduler, memory updates, one-repair policy, fallbacks, provider reservations and checkpoints. No second scheduler or generic game runner is introduced.

The planned evaluation horizon is recorded in the execution limits and exposed to both controllers as planned/remaining playing ticks. The normal match clocks and one-second scheduled interval remain intact. The runner stops at the horizon before dispatching another paired decision. Restart setup and delivery consume simulation time, not the evaluation's playing allowance.

## Provenance and metrics

The common controller configuration adds an explicit `scripted` provider with zero prices. Two scripted controllers produce `kind: fixture`; two model controllers produce `kind: llm`. Mixed pairs are rejected in this slice. Import validation rejects contradictory labels, nonzero scripted pricing/usage and inconsistent horizon stops. Existing hand-authored fixtures without execution logs remain valid.

The recording's existing `generation` field stores the shared execution trace, including scripted controller calls, accepted/rejected JSON, repairs and elapsed wall time. It does not establish LLM provenance by its presence alone. A horizon-limited excerpt remains an incomplete **match** with `playing_time_limit`; the evaluation report separately marks whether the planned horizon was completed. The viewer identifies scripted calls and labels the excerpt accordingly.

Metrics replay accepted actions at 60 Hz and verify the final state hash. Carry distance counts same-owner, same-possession-mode movement during open play; it is physical path length, including body separation, rather than a claim about intent. Forward progress is reported separately. Reception follow-up includes the first subsequent decision while the receiver retains control and movement until control ends. Restarts do not contribute placement distance or manufactured turnovers. Supporting-spacing diagnostics exclude keepers and the carrier; distance under two metres is a reporting threshold, never an automatic movement rule.

The offline CLI fixes three eight-second scenarios, a seed, criteria and a maximum of 32 paired rounds per run. That allows at most 64 first attempts and 128 attempts including repairs. These are explicit ceilings, not a prediction from duration. Repetitions preserve the same starting states, and reports retain failed criteria and incomplete runs. Scripted control code exists only in `fixtures/`; neither simulation nor the runner chooses tactics.

## Alternative, consequences and revisit condition

A separate evaluation scheduler would be smaller initially but could validate behavior different from a real match. Reusing the real loop keeps the approval-relevant request and memory boundaries in one place. Fresh states avoid adding resume/rebasing support or changing recording tick semantics.

The offline harness proves infrastructure and deterministic scripted mechanics. It does not prove LLM teamwork or predict real latency, costs or scorelines. No keys are loaded and no provider adapter is constructed by `pnpm evaluate-sequences`. A paid entry point, fresh provider budgets and final publication are later work.

[Slice 19](../slices/19-SUSTAINED-PLAY-HARNESS.md) records the tests and measured offline results. Revisit the fixed criteria after reviewing bounded model outcomes; retain the original results when changing criteria or scenarios.
