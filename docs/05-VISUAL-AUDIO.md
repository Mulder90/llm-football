# Top-down visual and audio direction

The current broadcast uses comic paper/ink score tiles and short sampled announcements. Goals occupy nine watch seconds: impact, an edited approach to the attacked corner flag, signature celebration and a readable restart transition. All other active players remain visible, with losing-side disappointment; the airborne scorer draws above the group. Supporter sections erupt in staggered waves. The sound is now an edited, credited football-stadium goal recording with a shaped tail; the approved whistle remains. See [slice 14](slices/14-COMIC-MATCHDAY.md) and [sound credits](SOUND-CREDITS.md).

![Selected reference](references/top-down-football.png)

## Camera

Top-down, flat pitch geometry without perspective foreshortening. Goals left/right, long touchlines horizontal, consistent scale everywhere. The previous oblique 2.5D mockups are not the chosen direction.

Upright robot faces in the reference are an acceptable stylistic cheat. Keep one consistent sprite viewpoint and coherent directional movement while pitch geometry stays flat. Start with a fixed whole-pitch view. Test closer top-down tracking later if players and ball are too small. Avoid constant cuts or effects that obscure tactics.

## Look

- Emerald grass, restrained mowing stripes and cream-white markings.
- Coral/cyan teams; distinct yellow/mint keepers with visible team association.
- Navy stadium, crowd colour clusters, aisles, flags, benches and a little greenery.
- Crisp pixel clusters, readable silhouettes, limited palette, restrained texture.
- Model/team names, score, half and clock; slim replay controls and optional inspection.
- No JSON sidebar by default, unrelated sports branding or forced product name.

The generated reference is not authoritative for player count, pitch dimensions, clock values or assets. Rebuild these from the rules. Never paste the screenshot behind a fake running game.

## Current rendering

Canvas 2D renders the world at a logical 960×660 resolution, with HTML/React controls. The stadium occupies the complete 100dvh watch area; the canvas contains the full pitch at every size, using nearest-neighbour pixel rendering and letterboxing where needed. A compact score overlay, Inside the match entry and floating playback controls replace the former header/footer bands. The desktop inspector sits beside the pitch and overlays on narrow screens. It is closed by default; raw instructions and observation data sit beneath readable explanations.

World metres are independent of pixels. Round at drawing boundaries, not in physics. Stable foot anchors and layered drawing prevent sliding and overlap errors. An aerial ball separates from its ground shadow. Keep it visible near players. Tactical overlays are opt-in.

The static pitch/stadium is cached on a canvas: supporter sections, scarves, banners, rails and aisles. A minority of spectators animate at rest; participation rises during attacks. End stands lead jumping, the north favours scarves and the south follows later. Actual goals, saves, nearby shot exits and completed passes produce different responses from the two clubs' supporters. Flag cloth is drawn separately from the cache to avoid ghosting and becomes static under reduced motion. Actors and crowd details animate from recorded samples. React receives control updates at roughly 10 Hz; each sprite frame is drawn independently. Selecting an order adds a team-coloured player ring, number and target line without affecting the match.

## Animation

Priority set: idle, run, decelerate/turn, pass/kick, receive, tackle, fall/recover, keeper ready/dive/catch, celebrate and referee signal. Add states as mechanics require them. Prefer a few strong consistent frames over many inconsistent generated poses.

Use one base player with palette/equipment variants. Head size, anchors and lighting stay stable. Run cadence follows movement speed; stationary feet stop cycling. Kick anticipation, contact and recovery align with actual simulation action phases.

Robots now have directional footwork and body lean, rear helmet panels, deterministic blinks, kick/tackle recovery, keeper gloves and celebratory faces/arms. Jumping leaves shadows fixed on the ground. Two faint past positions help track a fast loose ball without tracing across possession changes or restarts.

The referee has its own cream-shell/lime-kit sprite, movement-driven run cycle, whistle-to-point gestures and raised cards. A cached route follows earlier recorded play with bounded speed and acceleration. Arbitrary seeking samples that same route; signals never anticipate their recorded incident. Reduced motion retains readable signals while removing decorative steps, bobbing, blinking and card-rise animation.

Goal presentation uses the first frame containing the updated score. A compact banner leaves the huddle visible, with a local net ripple and team-coloured confetti outside the pitch. Five scoring-side players gather, celebrate and return during the existing stopped-clock setup. A presentation timeline extends that vignette to six watch seconds at 1×, with a longer settled huddle and an accurately extended slider duration. The canonical frames and outcome never change; reduced motion retains their original positions. See [decision 007](decisions/007-BROADCAST-TIME.md).

Cyan scorers keep the turning leap and wide landing; Coral scorers make two smaller fist-raised hops. Actual saves, nearby shot exits and completed passes trigger short keeper, shooter and teammate gestures. Possession and phase checks cancel stale reactions; no invented thoughts are displayed. The same precomputed moment list synchronizes sound and crowd responses.

Robot helmets now have stronger toy-like silhouettes and expressive visors, with comic punctuation tied to actual saves, passes and nearby shot exits. Coaches, bench crews and drummers animate in fixed touchline pockets. Opening-half setup displays the taker and a nearby teammate at the centre while applying existing referee placement to copied poses; live positions stay canonical. The bottom transport disappears after 2.8 seconds of idle playback and remains reachable by pointer, tap or keyboard.

The ball's drawn altitude uses 12 pixels per metre for legibility while its ground shadow remains at the physical x/y. The shadow broadens/fades with height and the ball rolls during a carry. This deliberate visual exaggeration never changes contact or flight physics.

The earlier running GIF was a rough experiment with shape drift and is intentionally not included as a production reference. The selected overhead viewpoint needs its own aligned assets.

## Audio

Use stadium percussion, ball/contact sounds, restrained crowd reactions and recognizable referee signals. The user rejected continuous filtered-noise ambience and harmonic synthetic crowd voices; neither belongs in the mix. They approved the revised whistle and asked for deeper, more epic drums. Use original synthesis or properly licensed assets. No inference is needed for playback audio.

Trigger effects from stable events crossed by the forward playhead. Scrubbing must not replay all historical goals/whistles; reset event handling on seek. Pause percussion during stoppages, define non-1x behaviour, limit overlapping effects and provide mute/volume. Sound defaults to enabled and starts with the user's play gesture; a prior mute choice is respected. Clock-transition whistles align with their recorded frame, including the full-time endpoint; physical incident cues follow the completed step. The final whistle may finish after automatic playback completion, while explicit pause/seek/hidden-tab actions silence audio. Crowd reactions cannot reveal future outcomes.

Attacking buildup uses current/public recent play to add tom subdivisions and small accents to the existing 130 BPM rhythm. Save, near-miss and goal percussion responses interrupt the bed briefly. Subtle stereo placement follows the fixed Coral/Cyan supporter sides. The approved whistle and licensed goal cheer remain unchanged.

## Acceptance

Full roster and keepers distinguishable; ball trackable at normal speed; passes/misses/goals visible; crisp pixels; stable anchors; correct pitch; narrow-screen controls usable; animation, clock, score and sound agree with the same replay events.
