# Decision 007 — A separate watch timeline for celebrations

Status: accepted under the user's 8 September feedback that celebrations were too short and the site should feel like watching a full-screen football broadcast.

## Decision

Keep the canonical recording, simulation ticks and playing clock unchanged. Build a pure presentation timeline once per recording. Each eligible 1.85-second goal vignette occupies six seconds of watch time at 1×. Ordinary play advances at its existing rate. The viewer's slider, duration, five-second rewind and keyboard seeking use watch seconds; the pitch, scoreboard, inspector, referee and audio-event cursor receive the mapped recording time.

The timeline stores the recording and watch start/end of each celebration. Before a window, subtract the accumulated added time. Inside one, interpolate between its recording endpoints. After it, include its extra duration in the accumulated offset. The inverse mapping supports verification and deliberate seeking. Clamp the final watch endpoint directly to the final recording time to avoid a floating-point round trip falling one tick short.

Goal gatherings and returns still use presentation copies of player poses inside the existing stopped-clock setup. Most of the longer sequence is a settled huddle. Decorative jumps, blinks and waving flags follow watch time so the party does not turn into a slow-motion blink. Player steps still follow distance travelled. Reduced motion removes decorative motion and retains canonical player positions, while the readable goal banner has the same duration.

Only a goal followed by its recorded kickoff setup is extended. A truncated excerpt receives only the available fraction of that window. A goal on the final playing tick that immediately reaches full time still uses the end-of-match presentation; it does not invent a restart or extend football time.

## Alternative and consequences

Lengthening restart setup inside the engine would change match generation, model opportunities and replay hashes merely to improve a celebration. Pausing with a mutable timer would make seeking and playback speed harder to reproduce. The explicit mapping keeps the engine and record untouched, makes the duration honest, and gives every viewer the same sequence.

The current two-goal match grows from 80.883 recording seconds to 89.183 watch seconds. Playing time remains exactly 60 seconds, score remains 0–2 and the canonical hash remains `31ab92f4`. At 2×, a six-second celebration takes three wall seconds, consistent with the speed control. Pausing and hidden tabs stop watch time as before.

## Verification

Focused tests cover six-second windows, a settled huddle with an unchanged playing clock, forward/inverse mapping, arbitrary seeks, exact endpoints, isolation from later goals and unchanged independent replay. Clock events such as restart readiness, halftime and full time are emitted after the engine increments its tick; physical incidents such as goals and shots are visible on the following frame. Sound and referee signals preserve that distinction, including the final whistle at the exact endpoint.

Revisit this mapping when introducing replays or other broadcast segments. Do not stretch open football play or change outcomes for spectacle.
