# Top-down visual and audio direction

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

Canvas 2D renders the world at a logical 960×660 resolution, with HTML/React controls. The broadcast occupies 100dvh; the canvas contains the full pitch at every size, using nearest-neighbour pixel rendering and letterboxing where needed. The desktop inspector sits beside the pitch and overlays on narrow screens. It is closed by default.

World metres are independent of pixels. Round at drawing boundaries, not in physics. Stable foot anchors and layered drawing prevent sliding and overlap errors. An aerial ball separates from its ground shadow. Keep it visible near players. Tactical overlays are opt-in.

The static pitch/stadium is cached on a canvas. Actors and selected crowd details animate from recorded samples. React receives control updates at roughly 10 Hz; each sprite frame is drawn independently. Selecting an order adds a team-coloured player ring, number and target line without affecting the match.

## Animation

Priority set: idle, run, decelerate/turn, pass/kick, receive, tackle, fall/recover, keeper ready/dive/catch, celebrate and referee signal. Add states as mechanics require them. Prefer a few strong consistent frames over many inconsistent generated poses.

Use one base player with palette/equipment variants. Head size, anchors and lighting stay stable. Run cadence follows movement speed; stationary feet stop cycling. Kick anticipation, contact and recovery align with actual simulation action phases.

The earlier running GIF was a rough experiment with shape drift and is intentionally not included as a production reference. The selected overhead viewpoint needs its own aligned assets.

## Audio

Low crowd ambience, ball kick, tackle/contact, keeper save, whistle, goal cheer, halftime/fulltime signal. Use synthetic or properly licensed assets. No inference is needed for playback audio.

Trigger effects from stable events crossed by the forward playhead. Scrubbing must not replay all historical goals/whistles; reset event handling on seek. Pause ambience appropriately, define non-1x behaviour, limit overlapping effects and provide mute/volume. Start browser audio after user interaction; muted viewing remains complete. Crowd reactions cannot reveal future outcomes.

## Acceptance

Full roster and keepers distinguishable; ball trackable at normal speed; passes/misses/goals visible; crisp pixels; stable anchors; correct pitch; narrow-screen controls usable; animation, clock, score and sound agree with the same replay events.
