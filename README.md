# AI Football — project foundation

> Watch two AI teams play a short, complete football match. Replay every moment and inspect the decisions behind it.

This is a new standalone project, starting from scratch. It is not an extension of Agentathlon and not a multi-sport framework. “AI Football” is a working title, not an approved product name.

The destination is eleven players per team, one LLM controller per team, two three-minute halves, a deterministic football simulation, and a beautiful top-down pixel-art broadcast website.

The broadcast fills the viewport with a top-down pixel-art stadium. A real **incomplete LLM excerpt** is available: GPT-5 nano versus Gemini 3.1 Flash-Lite, alongside a complete scripted baseline. The goal is still a full, six-minute LLM match.

Open **Behind the match** for team/player decisions, the exact observation stream, rules/prompt and recording import/export. The panel follows replay time. Goal celebrations and synthetic stadium sound are available; click the sound control to unmute. Playback never calls an LLM.

## Run locally

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Click **Watch the match**. Space toggles playback; left/right arrows seek five seconds when focus is outside a control. Replay position also supports the keyboard. No API keys or API calls are needed to watch recordings.

```sh
pnpm check     # strict TypeScript and deterministic engine tests
pnpm format    # format source and docs with Prettier
pnpm build     # typecheck and production viewer
pnpm fixture   # passing fixture, replay verification, local JSON export
pnpm fixture --full # both halves of the scripted baseline
```

## Generate locally

Keep `OPENAI_API_KEY` and `GEMINI_API_KEY` in ignored `.env`, using `.env.example` for names. The runner sends football state only. Defaults are a bounded ten-decision test, one repair per team, and a $0.25 estimated ceiling.

```sh
pnpm generate --smoke                       # one request per provider, no retries
pnpm generate --decisions 10 --name trial-01 # bounded real possession
pnpm publish-recording artifacts/private/trial-01/match.json
```

Publishing here validates and replay-verifies the file, then places gzip data in the local viewer catalogue. It does not deploy a site. Refresh the viewer to load the new recording. Incomplete runs remain labelled incomplete. Model availability, measured usage, limits and execution assistance are documented in [decision 003](docs/decisions/003-MODEL-CONTROL-AND-INSPECTION.md).

The original [first-task brief](FIRST_PROMPT.md) remains available. Implementation is now authorized by the user's subsequent goal: finish a beautiful, complete LLM-controlled match in tested, committed slices. See [current progress](docs/PROGRESS.md) and the [latest slice handoff](docs/slices/04-REFEREE.md).

Codex should follow [AGENTS.md](AGENTS.md). Documents communicate intent and should be challenged where incomplete. Do not silently turn illustrative examples into permanent contracts.

## Read in order

| Document                                              | Purpose                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| [Product](docs/01-PRODUCT.md)                         | Audience, settled decisions, scope                          |
| [Architecture](docs/02-ARCHITECTURE.md)               | Simulation, controllers, clocks, recording, playback        |
| [LLM control](docs/03-LLM-CONTROL.md)                 | Rulebook, observations, team orders, memory, fairness       |
| [Football rules](docs/04-FOOTBALL-RULES.md)           | Play, referee, fouls, restarts and unresolved mechanics     |
| [Visual and audio direction](docs/05-VISUAL-AUDIO.md) | Top-down camera, pixel art, animation, sound                |
| [Build plan](docs/06-BUILD-PLAN.md)                   | Incremental implementation and acceptance criteria          |
| [Providers](docs/07-PROVIDERS.md)                     | Cheap OpenAI/Gemini defaults, local keys, bounded test runs |
| [Decision records](docs/decisions/README.md)          | Lightweight ADR process                                     |

## Selected visual reference

![Selected top-down broadcast direction](docs/references/top-down-football.png)

Use the image for palette, atmosphere, layout, and camera direction. It is not an exact pitch specification, roster count, sprite sheet, or finished asset. Rebuild geometry and player count from the game rules.

## Proposed stack

TypeScript strict, pnpm, Vite, React for surrounding UI, Canvas 2D for the game, Vitest for meaningful rules and determinism tests. Start with one package. A later local Node runner can generate matches using provider adapters while the browser plays exported match files. Versions and exact dependencies should be selected during scaffolding and locked.

## First deliverable

A beautiful top-down pitch with 22 identifiable animated players and a ball, demonstrating a small deterministic pass-and-move sequence from explicit fixture orders. It runs headlessly, can be replayed, and is clearly labelled a development fixture. Real LLM control follows once the action semantics work.

The end goal remains a complete LLM-played game. Small implementation slices are milestones toward that goal, not a pivot to penalties or a different sport.
