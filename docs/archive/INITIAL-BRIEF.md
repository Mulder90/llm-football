# Original project brief — historical

This is the initial planning request, preserved as project history. Its proposal-only instructions, three-minute halves and concept image are superseded. Use the [current documentation](../README.md) and [working agreement](../../AGENTS.md) for development. The obsolete concept image mentioned below was removed at the user’s request.

---

We are starting a new standalone project from scratch: a beautiful website where people watch and re-watch short football matches entirely played by LLM-controlled teams.

Read README.md, AGENTS.md, all documents under docs/, and visually inspect docs/references/top-down-football.png before proposing work. These files capture the product intent, agreed constraints and proposed implementation choices. Treat them critically: identify contradictions, missing semantics and premature abstractions. This message supersedes any older Agentathlon or Olympics handoff.

The product we are building:

- Eleven players per team, including goalkeepers.
- One model controls all players on one team; another controls the opposition.
- Both models receive the same rulebook and control capabilities, successive observations from the same simulation boundary, and their own memory.
- Models return structured instructions for movement, passing, shooting, tackling and team positioning. The engine resolves what actually happens.
- Two three-minute halves of playing time.
- Full destination includes referee decisions, fouls, offside, corners, throw-ins, free kicks, goal kicks, penalties and kickoffs, implemented in sensible stages.
- Top-down pixel-art pitch and stadium: minimal, colourful, beautiful, with animated players, ball and crowd details.
- Restrained sound: ambience, ball contacts, whistles, saves, goals and crowd reactions.
- Match generation can pause for model responses. Recorded playback must be smooth and independent of model latency.
- The website is a spectator experience with score, time, playback, replay and optional decision inspection.

For this first task, do not create or modify files, install dependencies, or implement code. Produce a concrete proposal for the first small vertical slice, together with a brief map of the subsequent phases.

Recommended first slice: a top-down pitch and stadium foundation with all 22 identifiable players, a ball, one useful animation cycle, and a deterministic pass-and-move sequence driven by explicit fixture orders. The same sequence must run without a browser and replay without calling a model. Fixtures are a development tool; the full product remains LLM-controlled football.

In your proposal, cover:

1. Confirmed requirements, proposed defaults, and consequential open questions. Challenge weak assumptions without shrinking the intended product to a penalty game or another sport.
2. The minimal file tree and dependency boundaries for a single TypeScript package.
3. Concrete football state and action types: players, ball, active orders, simulation tick, match clock, phase, score and events. Use discriminated unions where they clarify valid states.
4. Precise first-slice semantics for movement, a ball kick/pass, interception or receiving, action expiry, omitted orders and impossible actions. Define which behaviour is mechanical execution and which requires an LLM decision.
5. Fixed-step scheduling, PRNG choice, stable collision/update ordering, and the limits of numerical reproducibility across runtimes. Do not claim a fixed timestep alone guarantees bit-identical results everywhere.
6. A minimal recording format that supports deterministic verification and smooth playback. Explain how future seeking and version compatibility can be added without implementing a large replay framework today.
7. Top-down rendering, logical resolution, pitch-to-screen mapping, pixel scaling, sprite anchors, direction and animation state. Explain how to translate the reference into actual assets instead of using it as a screenshot background.
8. A focused test plan for determinism, action validation, frame-rate independence, and first-slice football mechanics, plus a visual acceptance check.
9. Future boundaries for simultaneous LLM requests, shared rules, observations, private memory, malformed output, bounded retries and cost controls. Keep provider integration out of the first slice.
   The user already has OPENAI_API_KEY and GEMINI_API_KEY locally. Plan cheap configurable defaults from docs/07-PROVIDERS.md, bounded short test runs and a local generation process. Never request key values in chat, call paid APIs during this planning task or put keys in the frontend.
10. A staged route to complete games, restarts, referee rules, LLM control, audio and the spectator website. Give exit criteria rather than optimistic calendar promises.
11. A small sequence of proposed commits for the first slice and the most important ADRs. For each ADR, give the decision, principal alternative, consequence and revisit condition; do not write the ADR files yet.

Proposed stack: strict TypeScript, pnpm, Vite, React for UI, Canvas 2D for the game and Vitest for core tests. Start in one package. Do not add a generic game framework, monorepo, ECS, server, database, authentication, provider SDK, WebGL or deployment infrastructure to the first slice.

Treat me as the engineer responsible for understanding and defending this system. Explain the subtle parts and distinguish tested facts from proposals. Once implementation is approved, every slice should end with what changed, why it works, what was verified, known limitations and a short learning checkpoint.

End with your recommended first-slice plan and only the focused questions that genuinely block it. Then wait for my approval before implementation.
