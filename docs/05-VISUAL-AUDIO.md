# Visuals and audio

The running game uses a comic pixel-art stadium: expressive robots, paper-and-ink score tiles, animated supporters and short event announcements. This is implemented Canvas rendering, not a concept image.

![Actual in-game corner celebration](images/celebration.jpg)

## View and controls

The 960×660 logical canvas sits inside a full-viewport watch area, preserving the complete pitch with nearest-neighbour scaling and letterboxing where needed. Pitch geometry is flat and top-down; upright robot faces improve readability. Whole pitch is the default, with an optional closer tracking view.

A compact scoreboard identifies teams and models. Playback controls disappear after 2.8 seconds of idle play, with pointer, touch and keyboard access. **Inside the match** is closed by default and sits beside the pitch on desktop or overlays it on narrow screens. Raw data is available beneath readable explanations.

## Movement and atmosphere

World metres stay separate from drawing pixels. Foot anchors, directional steps, leaning, kick/tackle recovery and keeper gloves make actions readable. Ball height is exaggerated to 12 pixels per metre above a ground shadow; this never changes flight physics.

Static stadium geometry is cached. Trees, flags, spectators, coaches and bench crews animate separately. Attack buildup and actual saves, nearby misses, completed passes and goals drive different supporter and robot reactions. Decorative sideline drummers still move, but produce no percussion. The referee follows a deterministic route through recorded play and signals actual incidents.

React updates controls at roughly 10 Hz; Canvas draws independently with requestAnimationFrame. Reduced motion removes decorative movement while retaining event and score readability.

## Goals

A goal starts when the sampled frame contains the updated score. A nine-second watch sequence shows the comic announcement, an edited approach to the attacked corner, a signature celebration and a readable restart transition. Cyan uses a turning leap; Coral uses two fist-raised hops. Opponents remain visible and disappointed, and the airborne scorer draws above the group. Supporter waves, net ripples and confetti follow the same event.

The watch timeline extends the stopped-clock vignette, never the football result. Seeking, inspection, score and event audio all use mapped recording time. See [the presentation-time decision](decisions/007-BROADCAST-TIME.md).

## Sound

A locally bundled 30-second stadium recording supplies very quiet ambience at normal playback speed. A separate goal roar and synthesized ball contacts, post sounds and approved referee whistles follow recorded incidents. Synthetic drums, claps and crowd voices are removed. [Sound credits](SOUND-CREDITS.md) document licenses, edits and measured levels.

Sound is enabled by default and starts on a play gesture; a saved mute choice is respected. Pause, seek, mute, speed changes, hiding the page and full time stop the ambience. Loading alone cannot start it. Seeking resets event handling instead of replaying old sounds. The final whistle may finish after playback stops automatically.

## Acceptance

Check that the ball and both keepers remain readable, player movement matches the recording, announcements leave football visible, narrow-screen controls work, and score, clock and sounds agree at kickoff, halftime, goals and full time. Use the current viewer for visual review; numerical audio checks do not replace listening.
