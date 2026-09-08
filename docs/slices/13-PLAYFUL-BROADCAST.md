# Slice 13 — A more playful broadcast

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

The user approved continuing the rendering and personality work before another paid generation, then requested disappearing playback controls and a clearer starting formation. This slice uses existing recordings and scripted checks only.

## Character and sideline life

Robots have a larger head-to-body ratio, round, square-ear and twin-antenna helmets, clearer smiling/focused/frustrated visors, springier upper bodies and occasional idle tilts. Stable player IDs choose their visual variant. Actual possession, accepted actions and recorded reactions determine expressions; they are not claims about hidden model thoughts. Cyan's turning leap and Coral's two-hop celebration keep their existing timing. The larger helmets leave room for cards beside the head and player numbers below the feet.

Coral has a cap-and-clipboard coach; Cyan has a headset and long coat. Four decorative bench robots per club, sun/wave pennants and tiny drummers make the south touchline feel inhabited. These are spectators and staff, not additional simulated players. Coaches and benches react to the same visible outcomes as the stands. Their fixed pockets leave the field, tunnel and rail unobstructed. Drummer sticks use recording ticks at the existing 130 BPM; stoppages rest them except for a goal's raised-stick pose. Ambient glances use watch time. No sound assets or audio synthesis changed.

One small comic mark can accompany a save, completed pass or nearby shot exit. The renderer tries empty space above or beside the relevant robot, skips crowded positions, and cancels marks after possession/action changes. Fast carriers leave brief grass puffs at their own preceding recorded foot positions. Goals add star-shaped confetti, stepped streamers and stronger landing accents. The ball stays visible; no match outcome or movement target changes.

All ambient animation is sampled from the playhead rather than accumulated particle state. Restoring a cached painting of empty seats and architecture before drawing moving staff avoids ghost silhouettes. Pause and seeking reproduce the same scene. Reduced motion removes idle/sideline motion, carry puffs and animated punctuation; static expressions remain readable.

## Playback controls

The bottom transport fades out after 2.8 seconds of inactivity during play. Pointer activity, taps and keyboard use reveal it. Pause, inspector use, control hover/drag, keyboard focus and open Viewing options keep it visible. The score, model names and inspector entry stay visible. Removed the previous hover-opacity rules so they cannot override the hidden state.

The idle timer renews on activity but only notifies React when visibility changes. Before hiding, a pointer-clicked control can release its retained focus; genuine keyboard focus pins the controls. Hidden controls use `inert`, `aria-hidden` and disabled pointer hit testing. A capturing keyboard listener reveals the subtree synchronously before the browser chooses the next Tab target. The first touch on a hidden transport only reveals it; later pointer or keyboard actions clear any pending compatibility-click suppression. Actual pointer entry/exit state survives effect restarts, avoiding sticky CSS hover on hybrid devices. Reduced motion disables the fade.

The timer is a presentation wall-time concern, separate from playing/generation time. Cleanup cancels old timers and listeners. Returning from a hidden browser tab may find an already-hidden transport after inactivity; any input reveals it. No football time or audio event is advanced by the controls timer.

## Opening kickoffs

The saved matches begin in `restart_setup`. The real referee places the taker and enforces centre-circle clearance at `restart_ready`, two recording seconds later. That previously let the opening picture show an opponent close to the centre spot and no nearby taking-side partner.

`kickoffFrame` now shows a legal opening tableau during each half's setup. It clones the current player poses into a presentation state and runs the existing `prepareRestartDelivery` placement function on that copy; it never calls the simulation step. Only displayed player poses are returned. The actual ball, ownership, phase, orders, events and recording remain untouched.

A central outfield teammate from the phase-start formation begins five metres behind the spot. The added offset fades with smoothstep, `t²(3−2t)`, over setup. Its derivative supplies cosmetic movement so the robot's body follows the displayed path. The support identity stays stable unless the designated taker changes. Referee circle/half restrictions apply to the displayed poses, and ready/live frames return to the exact recorded state. Goal celebrations and other restarts are excluded. Reduced motion uses the legal projection of current recorded poses without the extra support tween.

This is explicitly a stopped-clock presentation adjustment, like the goal gathering. It does not give models a new kickoff tactic or rewrite their observations. The existing three-tick recording samples can still leave approximately two pixels of ordinary setup movement at the ready boundary. Avoiding that would require future-pose interpolation or changing recording sampling, so this slice keeps the causal boundary.

## Verification

Strict TypeScript, all 156 tests, the production build and Prettier pass. JavaScript is 415.19 kB (131.60 kB gzip); CSS is 16.78 kB (4.74 kB gzip). No dependencies were added.

Focused checks cover event visibility, possession and phase cancellation, empty-space placement, carry eligibility, immutable records, reproducible drawing, reduced motion, idle timer renewal/pinning/cleanup, both halves' kickoff geometry, changed takers, future-data isolation and exact ready/live identity. Sprite comparisons found unchanged boot/ball drawing in 190 samples before the deliberate opening-tableau integration; live anchors and existing goal timing remain unchanged. Contact sheets were visually inspected for helmets, expressions, comic marks, benches and kickoff positions.

Browser checks verify the corrected centre-circle opening, hidden controls at opacity zero with an inert subtree, keyboard reveal and retained keyboard access, open options, pause, and complete 1× playback. Touch behavior is implemented and reviewed; this desktop browser check does not establish physical touchscreen behavior.

Existing matches retain their original results and exact prompts. The positional briefs from slice 12 apply to future generations. No model calls, new match generation or engine changes were made.

## Proposed next slice

Review this broadcast while watching the existing footage, then agree a small evaluation budget and match length for testing positional discipline, passing and defensive recovery before a more complete model run.
