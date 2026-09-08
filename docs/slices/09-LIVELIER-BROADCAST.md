# Slice 9 — A livelier stadium and expressive football

> Historical handoff: implementation, costs and checks as of this slice. Later slices may supersede it. See [current progress](../PROGRESS.md) and the [current guides](../README.md).

The user approved presentation work while the one-minute tactical-memory match generated, then explicitly added the referee. This slice keeps the top-down pitch and builds on its original pixel art. No new dependency, image background, simulation rule or model instruction is involved.

## What changed

Coral and Cyan have visible supporter sections with varied skin tones, shirts, scarves, banners, rails and aisles. A minority of the crowd waves and bobs at different rhythms. Recorded goals, saves and shots trigger team-aware reactions. Flags ripple continuously, with stronger movement for the scoring side. Static artwork remains cached, while moving cloth is drawn onto a fresh background each frame.

Robots turn their visors and show rear helmet panels when running away. Feet and arms follow travel distance, with small body lean, blinking and antenna movement. Kicks have a follow-through, tackles crouch then recover, and keepers show distinct gloves and save poses. Celebrations lift arms and change expressions; jumping shadows stay on the ground. A bright outlined ball is drawn last, with two faint past-position samples while it is loose and moving.

The goal sequence combines a local net ripple, a restrained burst beside the goal, a compact team-coloured banner and a five-player celebration. The banner leaves the group visible. Players gather, celebrate and ease back to their recorded setup positions before the existing two-second restart setup ends. Last-touch attribution is labelled honestly; an own-goal defender never leads the opposing celebration.

The referee has a cream robot shell, lime kit, black shorts, chest badge and whistle cord. Its movement-driven stride includes counter-swinging arms, turning and blinking. Recorded incidents produce a whistle-to-point gesture or a rising yellow/red card. Its route follows play and approaches incidents smoothly, with speed capped at 6 m/s and acceleration at 10 m/s², instead of jumping with the ball.

## The invariant

Rendering cannot move the football simulation, change a score or invent a referee decision. All decorative activity derives from replay ticks, recorded events and fixed coordinate hashes. There is no call to the simulation's random generator and no wall-clock animation state to reconstruct after a seek. The exact same playhead produces the same visual state.

Reduced motion stops decorative crowd/flag activity, blinks, bobs, trails and jumps. It also preserves canonical player positions through a goal instead of playing the gathering vignette. The score, event labels and match remain readable.

## Learning checkpoint

Treat a goal event as an incident inside an engine tick. Its updated score is visible in the next frame, so do not draw the banner or react before that frame. Derive goal age from the replay tick, then use the same age for banner opacity, net ripple, confetti and player poses. The banner uses tick-derived CSS variables instead of a free-running CSS animation.

The huddle is a copy of presentation poses. Interpolate from the last pre-goal positions to a scoring-side group, then back to the actual restart positions. Supply derivative velocity and travelled distance along those visual paths so running feet match the motion. Never write these poses back to a recording. When the vignette ends, use the original frame directly.

The referee route is computed once per recording, one integer tick at a time, using only earlier recorded positions and incidents. Each step approaches a target near the ball or the current incident under the speed and acceleration limits. Playback interpolates between route samples, while discrete signals come from the earlier sample. Seeking therefore reconstructs the same pose without letting a future incident influence earlier movement. This animated official has no collision or rules authority; the deterministic engine remains the referee.

## Verification and limits

Strict TypeScript and all 80 tests across ten files pass. The production build succeeds (384.56 kB JavaScript, 120.91 kB gzipped), and Prettier and whitespace checks pass. Focused goal tests cover contact timing, own goals, gathering/return, reduced motion, final-tick goals and recording immutability. Referee tests cover future-event isolation at fractional playheads, bounded speed/acceleration, repeatable seeking and unchanged recordings. Decorative draw-command checks cover repeatability, future-event isolation, static reduced-motion flags and keeping stadium decoration outside the playing field.

Browser review at 737×813 confirms the full pitch and usable controls, closed-by-default inspector, visible scoring-side huddle below the goal banner, and the new stadium, robots and referee. The complete model recording plays at 1× through to tick 4,853, FULL TIME 01:00 and 0–2. Goal seeking and the exact prompt panel were inspected. Both team-plan disclosures, their collapsed defaults and model-assessment labels were also checked against the real recording. A scan of nine public/build files, including decompressed match exports, found neither configured provider credential. Publishing had already validated and independently replayed the complete match.

These changes improve presentation; they do not fix intercepted passes or defensive decisions. The soundtrack remains the existing synthetic audio, and no human listening assessment is claimed. Public deployment, highlight editing and generated commentary remain separate work.
