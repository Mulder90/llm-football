# Slice 14 — Comic matchday, corner celebrations and cleanup

The user approved one focused cleanup and broadcast-polish pass before another model match. Live feedback extended the comic treatment to the scoreboard, kept opponents visible and disappointed, put the airborne scorer above nearby robots, lengthened “BACK TO IT!”, and identified stepped goal lettering/transitions as the animation problem. No model generation is part of this slice.

## The goal sequence

Each eligible goal occupies nine watch seconds. The confirmed ball visibly crosses into the net during the first 0.45 seconds. A short covered edit reveals the final approach to the nearest corner of the attacked end. The scorer and four teammates arrive from 3.25 seconds, staggered by 0.14 seconds. The group fans inward, keeping the flag and the scorer readable. Visible approaches are capped at sixteen metres; the montage deliberately omits a distant scorer's earlier travel instead of showing an impossible cross-field sprint.

All other active players remain in view. Losing players hold disappointed expressions and occasional hands-to-head poses throughout the goal. Grounded players draw first, airborne participants above them, and the scorer last. Cyan retains its turning leap and wide landing; Coral retains its two-hop celebration. Their previously liked pacing is unchanged.

“BACK TO IT!” occupies the 7.1–8.9-second transition, including a 600-millisecond fully covered hold. At its midpoint the renderer switches to exact current recorded kickoff poses. The opening edit has a 240-millisecond covered hold. These are authored broadcast edits inside the existing stopped playing clock. No additional physics, tactical orders or future footage are simulated. Reduced motion keeps canonical player positions and omits the edits.

The existing two-goal recording now lasts 95.183 watch seconds, while its 80.883 recording seconds, 60 playing seconds, 0–2 result and replay hash remain unchanged. A truncated goal window extends only its available fraction. Goals that immediately reach full time retain the end-of-match presentation.

## Comic UI and an expressive stadium

Cream paper, ink outlines, offset shadows and Coral/Cyan score tiles unify the scoreboard, goal burst, kickoff, interval, referee and final-result cards. The large “GOAAAAL!” lasts 1.1 watch seconds before becoming a compact scorer/score strip. Own goals credit the actual last touch explicitly. The scoreboard says Goal during the celebration; model labels and the Whole pitch default remain.

Animated announcements update with the render frames rather than inheriting the scoreboard/inspector's 100-millisecond cadence. Their transforms and opacity remain sampled from the playhead, so pause and seeking reproduce the same pose. This addresses the user's specific feedback about laggy goal lettering and restart transitions without raising the entire inspector's refresh rate.

Supporter sections now make larger three-pixel jumps in staggered waves, with more energetic flags. Scoring supporters erupt while conceded supporters slump. Cached seat restoration covers both the old seated footprint and the enlarged gestures; stand borders remain intact. All reactions are derived from visible recorded outcomes.

The studio applause clip is replaced with an edited 7.1-second football-stadium goal recording by paulw2k, licensed CC BY 4.0. The natural eruption, normalized level, fading tail and subtle supporter-side stereo placement give the goal a stadium source. A short percussion response follows the scorer's visible landing. Faster replay shortens the roar without pitch-shifting it. Pause, seek, mute, hidden tabs and speed changes cancel it. Source, processing and attribution are in [sound credits](../SOUND-CREDITS.md), with credit also available under Rules. Source selection and audio checks do not constitute an agent listening assessment.

## Cleanup and the mechanism

`Pitch` computes one `CelebrationFrame`, including displayed poses, participant IDs, corner, gesture ages and transition opacity. Players, camera, effects and landing audio consume that same result. Canonical sampled footage still drives match state and decisions. This removes repeated player copying/sorting and makes the presentation boundary explicit.

Canvas schedules continuous animation only during visible playback. Pause, seek and settings changes draw once. Visibility changes cancel pending callbacks before scheduling a new one, preventing duplicate draw chains after loading in a hidden tab. Audio volume changes apply directly, so the final whistle remains adjustable after rendering stops. Automatic end cancels nonterminal voices, including a roar from a goal on the final tick, while retaining the terminal whistles.

The accumulated CSS overrides are merged into their component sections. The pass adds no dependency, rendering framework or generic animation system. Pixel-art rectangle coordinates remain local drawing data rather than becoming a large configuration catalogue.

To reimplement the stopped-clock montage: map a fixed recorded goal window onto nine watch seconds; derive its age from that mapping; sample pre-goal poses; choose the awarded team's attacked corner; interpolate only participant display copies during the approach; switch to current recorded poses while the transition is opaque. Rendering and seeking use the same pure calculation. Never write those poses back to the recording.

## Provider budget boundary

Generation and fixed-situation evaluation now accept `--openai-usd` and `--gemini-usd` in addition to the combined `--usd` cap. Before any paired requests, group the full request/repair reservation by provider and check every ceiling. If one provider cannot fund its share, checkpoint and stop both sides. Cancelled or failed requests without usage retain their conservative reservation. Progress/final reports expose provider totals and provenance retains the caps.

All caps are USD estimates. Exchange rates, current prices and available balances are checked before a future launch; none is hardcoded as an account balance. No prices, models, credentials, football rules or recorded prompts changed. [Decision 009](../decisions/009-PROVIDER-BUDGETS.md) explains the boundary and limits.

## Verification and limits

Strict TypeScript, all 174 tests across 24 files, the production build, Prettier and whitespace checks pass. JavaScript is 419.50 kB (133.09 kB gzip); CSS is 19.04 kB (5.06 kB gzip). No dependencies were added. Both public recordings independently replay to their original hashes: `31ab92f4` and `36dbd671`.

Focused checks cover both clubs and halves, own goals, corner/flag bounds, full player visibility, scorer layering, long-range montage cuts, causal announcements, exact seeking/endpoints, reduced motion, audio interruption and terminal whistles, and asymmetric provider/repair/cancellation budgets. Ninety-one sampled goal frames have finite, nonnegative drawing geometry; a visual contact sheet shows approach, poses and crowd reactions.

Browser checks cover the 1280×720 desktop and 375×812 phone layouts, goal composition, paused seeking, disappearing controls, and playback to the exact endpoint. A temporary diagnostic observed roughly 60 rendered frames per second, with median frame gaps of 16.7 milliseconds and sampled 95th-percentile draw costs around 1.3–2 milliseconds on this machine. The announcement fix moves its updates from 10 Hz to that frame cadence; these measurements are not a promise about every device. Profiling code was removed before the final build. Phone checks use a desktop viewport override, not a physical touchscreen.

The encoded stereo roar is 131,583 bytes and decodes to exactly 7.1 seconds. Decoded peak is 0.9002 with zero clipped PCM samples. Audio quality still benefits from the user's listening feedback; the source description and numerical checks cannot establish subjective sound quality.

## Next slice

Stop adding visual features and evaluate the positional briefs on a small set of fixed defensive-recovery and receiver-arrival situations. Use measured usage, current official prices and explicit provider ceilings to choose a longer match duration. Assess carrying, passing, spacing and defensive cover from actual engine outcomes. No further paid generation is running or scheduled by this slice.
