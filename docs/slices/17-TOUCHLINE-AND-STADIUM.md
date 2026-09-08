# Slice 17 — Touchline and stadium rendering

Approved scope: clearer dugouts, a consistent sideline robot style, more natural staff/supporter composition and a quieter stadium frame. Portrait layout was deferred. The user then flagged oversized sideline robots; the final drawing reduces them to 58% of the shared player artwork and narrows the shelters. A possible 10% pitch-player reduction was discussed, not implemented in this slice.

## Result

- Two north-facing dugouts have an open approach, seat cushions and backs, a shallow cutaway rear canopy and fixed ground shadows. The south stand now has three rows, behind the rail at logical y=612.
- Three decorative substitutes and one empty seat occupy each dugout. Rear-facing helmets, occasional side glances, bent legs and different reactions replace the row of front-facing figures. One coach per team stands beside a shared apron with a clipboard/headset; bottle crates and folded towels sit near the entrances.
- Players, substitutes and coaches share helmet shapes and team palettes. Pitch-player drawing, foot anchors and ball scale are unchanged. Smaller sideline drawing uses integer-snapped rectangle edges; minimum one-pixel details retain antennas and helmet outlines.
- Two small supporter drummers replace the isolated touchline drummers. They animate inside the south stand with no percussion sound.
- Paving seams, advertising boards, rails and supporter palettes are quieter. Coordinate-seeded groups vary seat occupancy without consuming simulation randomness. Turf texture is subtler. Field lines use pixel rectangles and raster arcs.

## Invariant and assumptions

Only rendering and presentation tests changed. Simulation, recorded positions, rules, decisions, timings, outcomes, catalogue and audio are untouched. Bench occupants and coaches are decorative characters, not a substitute roster, tactical agents or an implemented substitution system. Pitch players remain deliberately exaggerated relative to the crowd for legibility; the stadium uses flat geometry with stylised upright sprites rather than physical perspective scaling.

## Mechanism: layering without remembered animation

The cached stadium paints the apron, dugout floor, empty cushions and fixed shadows. Each frame restores that painting, then draws people from the current recorded incident and watch time. Each occupied seat gets its back painted over the lower torso; posts and the shallow rear roof strip are drawn last. A cheering robot can rise while its seat stays on the ground, and seeking cannot leave a previous silhouette behind.

Recorded incidents select allegiance and reaction. Small per-person delays stagger responses; sparse watch-time windows select glances and gestures. Neither requires mutable animation history. Reduced motion uses static poses. The shared helmet rectangles are scaled by rounding each edge separately and keeping thin details at least one logical pixel wide.

Canvas `imageSmoothingEnabled = false` affects scaled images, not the antialiasing of path strokes. The field therefore draws straight markings as opaque rectangles and circles/arcs as an opaque annulus: a pixel centre is included when its radial distance differs from the metre-derived radius by at most 0.85 pixels and its angle lies in the selected arc. This is cached, not recomputed during every animation frame. Signed rectangle widths support both goal-line directions.

## Verification

- `pnpm check`: strict TypeScript and 177 tests pass across 25 files.
- `pnpm build`: production build passes.
- Focused rendering checks cover recorded-event allegiance, no future/stale reactions, seek repeatability, unchanged inputs, static reduced motion and every sideline pose staying clear of the pitch, tunnel, banners, tree and lower rail.
- Pixel-marking checks cover negative-width rectangles and mirrored penalty arcs spanning angle zero.
- The current viewer was inspected at whole-pitch scale during ordinary recorded play and a recorded goal, with pause and seeking. The lower-contrast scene and reduced sideline scale were assessed in context rather than through an isolated sprite sheet.

## Limitations and next slice

Portrait viewing still shrinks the full stadium into a short horizontal strip. Controls can cover the lower sideline while visible. The cutaway canopy is an intentional visibility convention, and tiny details simplify under browser downscaling. A separate small comparison could assess pitch players at roughly 90% of their current size, keeping the ball fixed; the user has asked about that scale but has not approved the change yet. The existing goalkeeper and sustained-football plan remains separate.
