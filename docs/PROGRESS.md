# Current progress

LLM Football is a local, replay-first spectator game with 22 robot players, a deterministic football engine, two team controllers and a full-screen comic stadium. Development matches have two 30-second playing halves. Watching the included recordings makes no API calls.

## Latest work

The carrier now chooses whether to dribble, pass or shoot before arranging a receiver. Tactical memory requests three important off-ball jobs while actual orders still cover all eleven players. The response schema stays stable across requests; runtime identity and ownership checks remain strict. Releasing a ball into flight no longer triggers an extra early replan, while reception and phase changes still can.

A bounded five-situation evaluation made 20 requests, all accepted first try with full-roster orders and no own-order execution failures. It produced six deliberate carries of 5–11 m, four successful pressure escapes and three goals from four shooting attempts. Passing remained preferred in one recorded low-pressure possession. This is short-case evidence, not a new full match or proof of sustained teamwork.

Estimated evaluation spending: **$0.10943875** ($0.036166 OpenAI / $0.07327275 Gemini), below the $0.12 / $0.22 provider caps. No generation is running. [Slice 16](slices/16-CARRIER-CHOICES.md) records the setup, measurements, caveats and verification.

The obsolete concept image is removed, the original planning brief is archived, and current guides are separated from historical handoffs. Start at the [documentation index](README.md).

## Latest complete match

**Finding their shape** (`positional-match-001`) is the default recording: GPT-5 mini versus Gemini 3.8 Flash, 0–0 after 60 playing seconds. Its 133 paired rounds used 293 requests, including 27 repairs and two explicit Coral fallbacks. Generation took 43m 43s and an estimated $2.08662375; independent replay matches hash `cd60f48a`.

That match predates the latest carrier and scheduling changes. Coral completed more passes than the earlier nano/Flash-Lite baseline, but neither side deliberately selected a carrier move, crowding was broadly unchanged, and all ten shots belonged to Cyan in the first half. [Slice 15](slices/15-QUIET-STADIUM-AND-FOOTBALL.md) retains the full comparison and accounting.

## Implemented boundaries

- Seeded 60 Hz simulation, ground/aerial ball physics, carrying, passing, shooting, guarding, tackles, restarts, halftime and full time.
- Fouls, cards, dismissals, penalties and explicit offside rules with documented simplifications.
- Simultaneous team observations, positional briefs, private tactical memory, bounded repairs and per-provider budgets.
- Validated recordings, deterministic replay verification, import/export and local catalogue publication.
- Whole-pitch default, optional closer camera, team/model labels, replay controls and optional plans/observations/prompts inspector.
- Animated robots, referee, crowd, trees and flags; nine-second corner celebrations with visible opponents; quiet recorded ambience and event sounds.

## Next step and limitations

The proposed next slice is proper goalkeeper hand possession, legal handling and visible distribution, verified offline. Then test sustained short possessions across several paired decisions before another complete two-half match. [The next-steps plan](06-BUILD-PLAN.md) describes the sequence and the required replacement of incompatible development recordings. No automatic new run is scheduled.

The engine never chooses tactics or repairs a model's chosen target. The two-second evaluations cannot establish longer buildup, defensive coordination or full-match cost savings. A model's written review may be wrong.

The viewer currently runs locally. Public hosting, live model-token streaming, generation resume, accounts and tournaments are not implemented. The inspector replays recorded observations; browser audio needs a play gesture. See [football rules](04-FOOTBALL-RULES.md) for omitted laws and [providers](07-PROVIDERS.md) for dated pricing assumptions.

## Working agreement and history

Use descriptive names, explicit units, focused modules and Prettier. Work directly on `main` and push approved changes. Keep keys in ignored local configuration. [AGENTS.md](../AGENTS.md) is the current working agreement.

[Historical slice handoffs](slices/README.md) preserve earlier implementation stages and their test counts, prices and results. [Architectural decisions](decisions/README.md) identify choices and superseding amendments. Historical descriptions of drums, longer halves, older prompts or default matches are not current specifications.
