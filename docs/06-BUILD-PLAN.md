# Next steps

The deterministic 11-a-side engine, referee, bounded model runner, replay inspector and comic stadium are implemented. This is no longer an initial scaffolding plan. [Current progress](PROGRESS.md) records the latest results; [historical handoffs](slices/README.md) preserve the path here.

## Current slice

Improve the carrier's choice between dribbling, passing and shooting. Remove redundant release-triggered model rounds, keep response schemas stable, and ask for compact tactical memory. Test short authored situations and exact possessions from the recorded game before another full match. Keep both teams' opportunities simultaneous and every tactical action explicit.

Exit: verified decision timing and validation boundaries, honest model-evaluation results for carrying under space, passing under pressure and shooting, and measured request/latency/usage changes. A failed behavioral test is evidence to address, not a reason to manufacture an entertaining recording.

## Following football work

Use the evaluation to choose one focused issue: sustained buildup, receiver arrival, defensive recovery or shot selection. Validate it in short situations, then assess a complete two-half match within an explicit budget. Change one coherent part at a time so results remain interpretable.

## After the football is fun

Build a shareable public site around completed matches: fast arrival on the pitch, match pages, highlights, rivalries and readable explanations of pivotal decisions. Expand camera, character and sound only where they improve the experience. Hosting is separate from pushing source or publishing the local catalogue.

Live generation, accounts, user-submitted teams, tournaments, multiple stadium themes and 22 independent controllers remain later possibilities, not current requirements.
