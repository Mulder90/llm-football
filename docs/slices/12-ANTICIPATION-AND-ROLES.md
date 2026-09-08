# Slice 12 — Anticipation, personality and positional briefs

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

The user approved three parallel changes: build tension around attacks and distinct crowd reactions, give robots event-driven personality, and give each position a short football brief. The latest paid generation remains stopped. All work and verification in this slice use existing recordings and scripted situations.

## Watching the match

Attacks now increase supporter participation and percussion density as the ball approaches the attacked goal. End stands lead the jumping, the north stand raises more scarves and the south follows with a short delay. Coral and Cyan supporters keep their club allegiance when teams swap ends. A save brings relief to the defending support and slumped disappointment to the attacking support; a near miss reverses that response. Goals lift the scoring end into a larger celebration.

The existing 130 BPM drum pattern gains quiet tom subdivisions and modest accents. A save gets a short double hit and bass response, a near miss a low release, and a goal a four-hit fanfare alongside the existing licensed cheer. Percussion has subtle team stereo placement. The approved whistle and licensed cheer are unchanged, and no synthetic clap or crowd voice has been added. A short break in the drum bed lets each reaction read clearly. Sound still unlocks on Play and pauses/mutes/seeks/hidden tabs silence pending cues.

Cyan retains the turning leap and wide-arm landing; Coral gets two compact fist-raised hops with supporting teammates. Keepers pump a fist after an actual save, shooters react after a genuine nearby shot exit, and both passer and receiver briefly acknowledge a completed pass. These are presentation gestures, not invented model thoughts or changes to player ability. Live gestures expire quickly and cancel after incompatible possession, a later action or a new phase. Goal celebrations still occupy six watch seconds at 1×. Whole pitch remains the default, and reduced motion removes decorative movement.

## How synchronization works

`createFootballMoments` walks the event stream once when a recording loads. It remembers the most recent uninterrupted kick or shot. A same-team receive by a different player, at least six metres away, yields a pass acknowledgement. A shot becomes a near miss only after a recorded goal-line exit close to its target goal. Saves and goals come directly from engine events. An intervening touch, block or restart clears the pending attribution. It never decides in advance whether a shot will succeed.

Each physical event is first visible at `event.tick + 1`, after the engine completes that step. Crowd, robots and audio receive this same timestamp. The crowd chooses the strongest recent moment; audio additionally requires that its timestamp crossed the forward playback cursor, so a paused frame or seek cannot replay the reaction sound. A goalkeeper gesture also requires that the keeper still owns the ball. These separate checks establish both correct timing and a sensible current pose.

Attack intensity is a visual heuristic based on ownership or a recent visible touch, distance to the attacked goal and centrality. Seven samples from the preceding 0.6 seconds smooth the buildup. A possession change or stoppage resets it. It uses the recording playhead, while flags and ambient spectator rhythm use watch time; this preserves lively wind during the longer goal window. Every seek is reproducible, and none of this writes to the simulation or recording. The accepted design is recorded in [decision 007](../decisions/007-BROADCAST-TIME.md).

## Football guidance

Future observations attach a stable starting role and side to each owned player in the existing 4–3–3. Seven shared briefs cover goalkeeper, fullback, centre back, holding midfielder, central midfielder, winger and striker, with possession, defensive and recovery responsibilities. Goal and flank coordinates follow the current half. Temporary memory jobs remain flexible, with explicit cover needed when roles interchange.

The prompt emphasizes centre-back and holding-midfield cover, staggered fullback advances, one coordinated press and goal-side recovery. It also explains that matching pass and run targets does not synchronize arrival: the model must consider the receiver's travel time, ball speed and a suitable meeting point. The keeper can distribute when owning the ball rather than being told to guard on every turn. Copied current-order targets now share the existing centimetre observation precision; accepted orders, pace and private memory retain their exact values. Redundant prompt/schema prose was condensed. A busy boundary with precise orders, full feedback, a 100-character match ID and maximum-length memory fits at 31,488 bytes with CJK text or 32,688 with JSON-escaped NUL text, including the response schema and 1,024 bytes of overhead. The runtime 32 KiB guard still governs larger combinations. No automatic tactical positioning, receiver selection or passing assistance was added. [Decision 008](../decisions/008-POSITIONAL-BRIEFS.md) explains the role mapping and input boundaries.

## Verification and limits

Focused tests exercise actual simulated near misses, saves and goals, interrupted pass attribution, exact first-visible ticks, halftime direction, possession resets, future-event isolation and arbitrary seeks. Robot and sound tests cover gesture cancellation, distinct team celebrations, stereo cues, deduplication, seeking and the 18-voice cap. Role checks cover all players, both teams/halves, private observation isolation and request size. Strict TypeScript and all 140 tests pass, as do Prettier, the production build and whitespace checks. The production JavaScript bundle is 403.15 kB (127.47 kB gzip); CSS remains 16.87 kB (4.78 kB gzip). No dependencies were added. Browser verification completed the existing match at 1× through the exact 89.183-second watch endpoint (60 playing seconds, 0–2), checked direct seeking into the goal huddle, and confirmed contrasting supporter poses with Whole pitch still on.

The existing complete match independently replays to `31ab92f4`, and the stopped preview to `36dbd671`; the full scripted fixture remains `57cd43fa`. The classifier finds 17 saves, eight meaningful pass acknowledgements and two goals in the complete recording; the newer prefix has one save and six such passes. The current public recordings contain no shot exit qualifying for the conservative near-miss cue; that path is exercised with an actual simulated shot in tests and visual QA. No footage, scores, winners or recorded prompts were changed.

Visual sheets cover both team celebrations and live gestures. Across 888 robot pose combinations and 228 stadium samples, drawing remains finite, seat footprints bounded, ground anchors preserved and recordings unchanged. Audio QA produces a separate stereo percussion preview with no clipped samples; this check excludes the licensed cheer and is not a listening assessment.

Near-miss proximity uses the last recorded flight position before a restart resets the ball, so it is a conservative approximate presentation category. Tiny spectator gestures are deliberately restrained at whole-pitch scale. The briefs have only been checked offline: their effect on model decisions and sustained football is still unmeasured. There were no paid model calls in this slice.

## Proposed next slice

Once an evaluation budget is agreed, compare the briefs on frozen defensive-recovery and receiver-arrival situations, then consider a short new match. Measure maintained cover, completed receptions, appropriate carrying and cost rather than relying on the model's description of its plan.
