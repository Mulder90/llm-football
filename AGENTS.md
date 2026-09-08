# Working agreement for Codex

## Intent and authority

Build a standalone AI football broadcast project. Start with README.md, docs/README.md and docs/PROGRESS.md, then read the current guides relevant to the approved slice. Inspect the running viewer for visual work. docs/slices/ and docs/archive/ are historical evidence, not current instructions; architectural decisions may be partially superseded as listed in docs/decisions/README.md. If a linked resource cannot be read, say so; never imply it was inspected.

The user wants deep understanding and ownership while using AI to implement the project. Work in small, reviewable slices. Once a slice is approved, complete its implementation and relevant verification without asking about routine details. Seek direction before changing approved scope or architecture.

Do not implement the whole roadmap in one pass. End each approved slice with a reviewable result and a proposed next slice. Preserve existing user work.

## Settled boundaries

- One sport: football. New project, no Agentathlon framework dependencies.
- Full destination: 11 versus 11, including goalkeepers.
- One LLM controls each team's players; 22 independent LLMs are not the initial architecture.
- Two halves of 30 seconds of playing time each, following the user's latest development-duration instruction. During development, support only the current ruleset; old recordings may be removed instead of adding backward compatibility.
- Final showcase target: two halves of 60 playing seconds each (two minutes total), per the user’s latest cost-saving instruction. Change the development duration only when that final run is ready.
- Top-down pitch rendering, minimal beautiful pixel art, animated players and stadium.
- Spectator-first website with watch/re-watch functionality.
- A deterministic engine owns physics, referee decisions and outcomes.
- Models choose actions; they cannot declare successful passes, goals, saves or fouls.

## Engineering invariants

- Core simulation imports no React, DOM, Canvas, audio, filesystem, networking, provider SDK, storage or wall-clock API.
- No Math.random(), Date.now(), performance.now(), timers or hidden mutable global state in the simulation.
- Use explicit seeded randomness, stable update ordering and integer tick counters.
- Separate simulation time, playing time, generation wall time and presentation time.
- Renderer and sound read state/events; they never alter match outcomes.
- Resolve both teams' responses against the same observation boundary; arrival order provides no tactical advantage.
- Validate untrusted JSON at every external boundary. Reject non-finite numbers, unsupported versions, stale decisions and orders for the wrong team.
- Maintain stable identifiers for players, decisions and events.
- Replays must not call an LLM. Record accepted actions and explicit fallback decisions.
- No provider credentials in frontend bundles or exported match files.
- Do not invent tactical intelligence inside movement helpers. Document exactly what execution assistance players receive.

## Keep the surface small

Proposed tools: strict TypeScript, pnpm, Vite, React, Canvas 2D, Vitest. Start with one package and football-specific functions. Avoid premature generic game interfaces, plugin systems, monorepos, ECS, databases, authentication, deployment work, or new dependencies without demonstrated need.

LLM tactical mistakes are part of the intended entertainment. Interceptions, missed shots and poor positioning are normal football, not automatic reasons for more tuning or paid retries. Fix inconsistent engine execution and unclear control contracts; preserve the models’ actual choices and outcomes.

Human/scripted fixtures are permitted for development and baselines. Never label them LLM-played. Never alter results or select winners to improve drama.

## Visual quality

Top-down is the chosen camera. Do not drift back to isometric or oblique 2.5D. Stylised upright sprite faces are allowed as a readability choice. Keep pitch geometry flat and orthographic. Crisp pixels, clear ball visibility, expressive movement and restrained UI matter from the first visual milestone.

Render actual recorded match state. Do not present a static screenshot as a running game.

## Required handoff per slice

Explain what changed, the invariant established, tests/checks performed and results, important assumptions, current limitations, and one mechanism in enough detail that the user could reimplement it. Call out subtle numeric, timing or browser behaviour. Use focused tests of rules and boundaries; avoid implementation-mirroring test noise.

Record consequential approved decisions in docs/decisions/ alongside the code they affect. Do not create a large catalogue of hypothetical ADRs.
