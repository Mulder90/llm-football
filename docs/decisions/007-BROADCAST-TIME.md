# Decision 007 — A separate watch timeline for celebrations

Status: accepted under the user's 8 September feedback that celebrations were too short and the site should feel like watching a full-screen football broadcast.

## Decision

Keep the canonical recording, simulation ticks and playing clock unchanged. Build a pure presentation timeline once per recording. Each eligible 1.85-second goal vignette occupies nine seconds of watch time at 1×. Ordinary play advances at its existing rate. The viewer's slider, duration, five-second rewind and keyboard seeking use watch seconds; the pitch, scoreboard, inspector, referee and audio-event cursor receive the mapped recording time.

The timeline stores the recording and watch start/end of each celebration. Before a window, subtract the accumulated added time. Inside one, interpolate between its recording endpoints. After it, include its extra duration in the accumulated offset. The inverse mapping supports verification and deliberate seeking. Clamp the final watch endpoint directly to the final recording time to avoid a floating-point round trip falling one tick short.

Goal gatherings and returns still use presentation copies of player poses inside the existing stopped-clock setup. Most of the longer sequence is a settled huddle. Decorative jumps, blinks and waving flags follow watch time so the party does not turn into a slow-motion blink. Player steps still follow distance travelled. Reduced motion removes decorative motion and retains canonical player positions, while the readable goal banner has the same duration.

Only a goal followed by its recorded kickoff setup is extended. A truncated excerpt receives only the available fraction of that window. A goal on the final playing tick that immediately reaches full time still uses the end-of-match presentation; it does not invent a restart or extend football time.

## Alternative and consequences

Lengthening restart setup inside the engine would change match generation, model opportunities and replay hashes merely to improve a celebration. Pausing with a mutable timer would make seeking and playback speed harder to reproduce. The explicit mapping keeps the engine and record untouched, makes the duration honest, and gives every viewer the same sequence.

The current two-goal match grows from 80.883 recording seconds to 95.183 watch seconds. Playing time remains exactly 60 seconds, score remains 0–2 and the canonical hash remains `31ab92f4`. At 2×, a nine-second celebration takes 4.5 wall seconds, consistent with the speed control. Pausing and hidden tabs stop watch time as before.

## Verification

Focused tests cover nine-second windows, a settled huddle with an unchanged playing clock, forward/inverse mapping, arbitrary seeks, exact endpoints, isolation from later goals and unchanged independent replay. Clock events such as restart readiness, halftime and full time are emitted after the engine increments its tick; physical incidents such as goals and shots are visible on the following frame. Sound and referee signals preserve that distinction, including the final whistle at the exact endpoint.

Revisit this mapping when introducing replays or other broadcast segments. Do not stretch open football play or change outcomes for spectacle.

## Character and camera experiment

The user approved expressive robots and a CR7-inspired scorer celebration, then explicitly preferred Whole pitch on by default. Keep that static top-down view as the initial camera. Turning Whole pitch off enables a small action-following camera, derived from the current frame and a sample 0.35 recorded seconds earlier. A short ball lead and bounded zoom frame the pitch during play and the scorer/net during goals. One Canvas transform covers every scene element; HTML score/controls stay fixed. Reduced motion always selects the static view. Seeking directly to any moment yields the same camera as playing there.

The scorer's plant, jump/turn, broad landing and held salute occupy the goal window. Teammates stand behind the scorer and respond after the landing. Helmet markings, antennas and gait variants are decorative identities, not player abilities or claims about model personality. Receiver gestures need a declared pass plus a matching accepted move/hold order; completed receives, failed actions and conceded goals can produce reactions. Do not invent hidden model thoughts or show a later command early. A real kick executes within one tick, so its preparation pose is correspondingly brief.

## Shared anticipation and event personality

The user approved attack buildup, contrasting supporter sections, team celebrations and brief robot gestures tied to football outcomes. A single precomputed moment list now derives goals, saves, nearby shot exits and completed passes from chronological recorded events. Canvas and sound consume the same visible boundary, `event.tick + 1`, without reading future outcomes. A nearby shot exit is deliberately conservative: a real shot must reach the target goal line within six seconds, with the preceding recorded ball position within two metres of that line, three metres of the posts and 1.5 metres of the crossbar. A pass acknowledgement requires a different teammate's actual receive after an uninterrupted kick travelling at least six metres. These are presentation classifications, not changes to football rules or official statistical definitions.

Attack intensity comes from current ownership (or a recent visible touch while loose), proximity to the attacked goal and centrality, averaged over seven samples in the preceding 0.6 seconds. It resets on a change of attacking side or a stoppage. The same sampled playhead reproduces the same buildup after seeking. It is a public-footage heuristic, not a claim about a model's tactical intent.

More supporters join as tension rises. End stands lead the jumping, the north stand favours scarves and the south stand responds later. Club allegiance stays fixed when teams swap ends. Save reactions belong to the keeper's supporters; a near miss disappoints the shooter's supporters. Losing supporters slump below the cheering silhouette. Existing 130 BPM percussion gains extra tom subdivisions and small accents. Saves produce a short double-hit response, near misses a low release, and goals a brief fanfare with the existing recorded cheer. Subtle left/right percussion placement follows Coral/Cyan supporter sides; the approved whistle and recorded cheer are unchanged. Seeking, pausing, muting and hiding the tab silence pending cues; no synthetic clap or crowd voice returns.

Cyan keeps the jump/turn/wide landing. Coral gets two smaller fist-raised hops. Live keeper, shooter and passing gestures use visible classified events and stop after a short lifetime, later phase or incompatible possession/action change. They do not reveal invented model thoughts. Reduced motion removes decorative crowd movement and player hand motion. The separate watch mapping, whole-pitch default and canonical recordings stay unchanged.

## Playful character and opening tableau

The user approved a less serious comic style and a clearer kickoff opening. Larger helmet silhouettes and event-driven faces keep stable live foot/ball anchors. Decorative coaches, bench crews and drummers occupy fixed off-pitch pockets, while one comic punctuation mark may use empty space around an actual event's actor. None is a simulation participant or hidden model thought. Their poses and particles remain functions of recording/watch time.

Opening-half `restart_setup` frames now project player poses through the existing referee placement function on a copied state. A stable central teammate starts five metres behind the spot, with an added smoothstep offset fading away before delivery. Only player presentation poses are returned; the real ball, ownership, phase, orders and events are never replaced. Goal setups are excluded, and `restart_ready`/live frames are returned unchanged. Reduced motion disables the extra support interpolation. This deliberately improves the stopped-clock opening picture without changing the saved match or supplying tactics to the controllers. Existing sample spacing may still produce a small placement transition at the exact ready boundary.

## Corner montage and comic announcements

The next approved polish pass increases goals to nine watch seconds. The confirmed ball crosses into the net before a brief covered cut reveals the final approach to the nearest corner of the attacked end. The scorer and four teammates arrive in staggered order, with visible paths limited to sixteen metres. Other players remain in their pre-goal poses and losing players retain disappointed gestures. Airborne participants draw above grounded robots, with the scorer last. A longer covered transition changes to exact current recorded kickoff poses; there is no invented rapid run back across the field. This is an edited stopped-clock broadcast, not additional football execution.

The opening cut is fully covered for 240 milliseconds. The restart transition holds for 600 milliseconds and fades over the rest of its 1.8-second interval. Canvas and HTML derive both cuts from the same pure timing function. Reduced motion leaves recorded poses and omits cuts. Large comic goal lettering lasts 1.1 watch seconds before becoming a compact strip, and the scoreboard says Goal during the vignette. Kickoff and referee messages remain causal recorded-event announcements.

`Pitch` prepares the kickoff/celebration result once, sharing it with players, camera, effects and landing audio. Animated announcements follow render frames independently of the scoreboard and inspector's slower updates; this avoids ten-step-per-second lettering and fades. Paused scenes redraw only for a seek or presentation-setting change. Visibility handling cancels pending frame callbacks and never catches up hidden time. Only terminal whistles survive automatic playback end; volume changes apply directly even when Canvas is idle. The actual recorded stadium roar is credited in [sound sources](../SOUND-CREDITS.md).

## Quiet crowd replaces percussion

The user's subsequent listening feedback rejected the drum sound and requested stadium ambience at very low volume. All continuous and event percussion is removed. One locally bundled CC0 stadium recording loops quietly at 1×; an edited overlap smooths its boundary. It starts only through enabled playback and stops on pause, seek, speed changes, mute, hidden tabs and full time. The approved whistles, contact/post samples and existing goal roar remain unchanged. Saves, misses and landing gestures retain their visual reactions without an added drum. Audio no longer needs the renderer's tactical-atmosphere or celebration objects. Source and numerical verification are recorded in [sound sources](../SOUND-CREDITS.md).
