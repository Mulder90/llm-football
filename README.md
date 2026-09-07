# AI Football

> Watch two AI teams play a short, complete football match. Replay every moment and inspect the decisions behind it.

An independent football experiment: one language model controls each team, a deterministic engine resolves play, and a top-down pixel-art broadcast lets you watch and inspect the result. “AI Football” is a working title.

**The first complete model-controlled match is ready to watch.** GPT-5 nano (Coral FC) plays Gemini 3.1 Flash-Lite (Cyan FC), eleven players per team, for two three-minute playing halves. Including restarts and halftime, the recording runs 7 minutes 12.45 seconds.

The broadcast fills the viewport by default. The complete recording loads automatically; a short model excerpt and clearly labelled scripted fixtures are also available. This is the preserved first full run, including the models' mistakes. The engine implements a documented simplified football ruleset, not every IFAB rule.

Open **Behind the match** for team/player decisions, the exact observation stream, rules/prompt and recording import/export. The panel follows replay time; select an order to highlight its player and target on the pitch. Goal celebrations and synthetic stadium sound are available; click the sound control to unmute. Playback never calls an LLM.

## Run locally

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Click **Watch the match**. Space toggles playback; left/right arrows seek five seconds when focus is outside a control. Replay position also supports the keyboard. No API keys or API calls are needed to watch recordings.

```sh
pnpm check     # strict TypeScript and 60 simulation/protocol/replay tests
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

The completed `north-garden-001` run used `--decisions 2000 --usd 4 --wall-seconds 14400`. It finished after 637 paired decision boundaries and 1,283 requests, with an estimated $1.3533 usage cost and 63 minutes 40 seconds of generation time. Those are observed results, not guaranteed limits for a future full match. Replay uses the committed recording and costs no model requests.

Publishing here validates and replay-verifies the file, then places gzip data in the local viewer catalogue. It does not deploy a site. Refresh the viewer to load the new recording. Incomplete runs remain labelled incomplete. Model availability, measured usage, limits and execution assistance are documented in [decision 003](docs/decisions/003-MODEL-CONTROL-AND-INSPECTION.md).

The original [first-task brief](FIRST_PROMPT.md) remains available. The user's subsequent goal authorized implementation in tested, committed slices. See [current progress](docs/PROGRESS.md) and the [complete-match handoff](docs/slices/06-COMPLETE-MODEL-MATCH.md) for verification, outcome and limitations.

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

Improve the controllers' understanding of direction and possession, starting with explicit own/opponent goal coordinates after halftime. Preserve this first match as a reproducible baseline. Public deployment and a larger match library are separate work.
