# AI Football

> Watch two AI teams play a short, complete football match. Replay every moment and inspect the decisions behind it.

An independent football experiment: one language model controls each team, a deterministic engine resolves play, and a top-down pixel-art broadcast lets you watch and inspect the result. “AI Football” is a working title.

**Development matches now use 30-second halves.** GPT-5 nano (Coral FC) and Gemini 3.1 Flash-Lite (Cyan FC) each control eleven players. Each team carries a small structured tactical plan between decisions: a ball player, intended pass, off-ball assignments, observed opponent threats and a review of its previous attempt. The shared prompt asks for distinct supporting positions and a coordinated order for every active teammate.

The broadcast fills the viewport by default. A complete one-minute model match is available alongside the scripted fixtures. It took 27 minutes and an estimated $0.64 to generate; viewing makes no AI calls. At the user's request, the previous four-minute generation was stopped and its public recordings removed. Development supports only football-0.5, with no backward compatibility layer. The engine implements a documented simplified football ruleset, not every IFAB rule.

The stadium fills the screen with a small TV-style score overlay, including each team's controller model. Whole pitch is on by default; turn it off in Viewing options to try the closer broadcast camera. Open **Inside the match** for team plans, what each team sees, rules and recordings. Exact prompts and instructions remain available under disclosures. Select an order to highlight its player and target on the pitch. Attacks build percussion and supporter activity. Opposing stands react differently to saves, near misses and goals. Cyan celebrates with a turning leap and wide landing; Coral powers up with two fist-raised hops. Keepers acknowledge saves, shooters react to near misses, and teammates acknowledge completed passes. Nine-second corner celebrations and fluttering stadium flags keep the broadcast moving. Toy-like helmets, expressive visors and reacting coaches/bench crews give the teams more character. Playback controls fade after 2.8 seconds of inactivity during play and return on pointer, tap or keyboard input; they remain visible while paused or in use. Sound defaults on when you press Play, with mute available in the controls. Playback never calls an LLM.

**Inside the match → Matches → Finding their feet** is a newer, explicitly unfinished 25.95-second preview using GPT-5 mini and Gemini 3.8 Flash. The user stopped its generation before halftime; its conservative estimate was $1.31. The previous complete match remains the default. The stronger configurations improved short controlled possession tests, while role discipline and pass timing still need work. See the [character and controller handoff](docs/slices/11-CHARACTER-AND-CONTROLLERS.md).

## Run locally

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Click **Watch the match**. Space toggles playback; left/right arrows seek five seconds when focus is outside a control. Replay position also supports the keyboard. **Viewing options** contains speed, volume, player numbers and fullscreen. **Inside the match → Matches → Running & chips** demonstrates ball carrying and aerial passing with explicitly scripted practice. No API keys or API calls are needed to watch recordings.

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

**Future controller requests now include short positional briefs** for the existing 4–3–3: goalkeeper, fullback, centre back, holding midfielder, central midfielder, winger and striker. The briefs cover possession, defending and recovery, with guidance on defensive cover and receiver arrival timing. Existing recordings retain their original prompts and play. See the [anticipation and roles handoff](docs/slices/12-ANTICIPATION-AND-ROLES.md).

Opening kickoffs now show the taker and a nearby teammate at the centre, with opponents outside the circle. This stopped-clock presentation gives way to exact recorded positions for live play. See the [playful broadcast handoff](docs/slices/13-PLAYFUL-BROADCAST.md).

The broadcast now uses comic score tiles and match announcements. Goals show the ball entering the net, a corner-flag celebration with all other players still visible, disappointed opponents, stronger supporter waves and a licensed stadium roar. The goal window is nine watch seconds, including a readable transition back to kickoff. Paused scenes draw only when something changes. See the [goal and comic broadcast handoff](docs/slices/14-COMIC-MATCHDAY.md).

Generation and controller evaluation accept `--openai-usd` and `--gemini-usd` as additional per-provider USD ceilings. Each provider must have room for its next requests and possible repairs before either team is called. Check current pricing and convert any non-USD credit balance before choosing limits; no balance or exchange rate is stored in the project.

## Next slice

Measure defensive recovery and receiver arrival timing on fixed situations before another model match, once a paid evaluation budget is agreed. The briefs are implemented and checked offline; their effect on model football has not yet been measured. No further paid generation is scheduled. Public deployment remains separate work.
