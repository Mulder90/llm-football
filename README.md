# AI Football

> Watch two AI teams play a short, complete football match. Replay every moment and inspect the decisions behind it.

An independent football experiment: one language model controls each team, a deterministic engine resolves play, and a top-down pixel-art broadcast lets you watch and inspect the result. “AI Football” is a working title.

**Development matches now use 30-second halves.** GPT-5 nano (Coral FC) and Gemini 3.1 Flash-Lite (Cyan FC) each control eleven players. Each team carries a small structured tactical plan between decisions: a ball player, intended pass, off-ball assignments, observed opponent threats and a review of its previous attempt. The shared prompt asks for distinct supporting positions and a coordinated order for every active teammate.

The broadcast fills the viewport by default. A complete one-minute model match is available alongside the scripted fixtures. It took 27 minutes and an estimated $0.64 to generate; viewing makes no AI calls. At the user's request, the previous four-minute generation was stopped and its public recordings removed. Development supports only football-0.5, with no backward compatibility layer. The engine implements a documented simplified football ruleset, not every IFAB rule.

Open **Behind the match** for team/player decisions, the exact observation stream, rules/prompt and recording import/export. The panel follows replay time; select an order to highlight its player and target on the pitch. Supporter sections, waving flags, expressive robots, an animated referee and a goal huddle bring the recorded play to life. Synthetic stadium sound is available; click the sound control to unmute. Playback never calls an LLM.

## Run locally

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Click **Watch the match**. Space toggles playback; left/right arrows seek five seconds when focus is outside a control. Replay position also supports the keyboard. No API keys or API calls are needed to watch recordings.

```sh
pnpm check     # strict TypeScript and simulation/protocol/replay tests
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

Start with a bounded possession before increasing the decision or cost ceiling. Thirty-second halves reduce the amount of play needed for a complete development match; they do not promise a fixed generation duration or cost. Replay uses the saved recording and costs no model requests.

Publishing here validates and replay-verifies the file, then places gzip data in the local viewer catalogue. It does not deploy a site. Refresh the viewer to load the new recording. Incomplete runs remain labelled incomplete. Model availability, measured usage, limits and execution assistance are documented in [decision 003](docs/decisions/003-MODEL-CONTROL-AND-INSPECTION.md).

The original [first-task brief](FIRST_PROMPT.md) remains available. The user's subsequent goal authorized implementation in tested, committed slices. See [current progress](docs/PROGRESS.md) and the [tactical-memory handoff](docs/slices/08-TACTICAL-MEMORY.md) for verification, outcome and limitations.

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

## Stack

One package: strict TypeScript, pnpm, Vite, React for controls, Canvas 2D for the game, Zod for external JSON validation, Vitest for rules and boundaries, and Prettier. A local Node runner calls the providers; the browser plays exported match files. Dependencies are pinned in the lockfile.

## Next slice

Improve keeper distribution and adaptation after repeated interceptions. The first minute shows stronger spacing and passing from Cyan while Coral still repeats poor passes. Further highlights and decision storytelling follow measured football improvements. Public deployment remains separate work.
