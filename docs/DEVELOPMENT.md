# Development

## Run the viewer

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite; the port depends on what's available. Press **Watch the match** to start the included recording. Watching and replaying require no API keys or provider requests.

Space toggles playback and the left/right arrows seek five seconds when focus is outside a control. **Viewing options** contains speed, volume, player numbers, camera and fullscreen controls. **Inside the match** contains recordings, team plans, observations and exact prompts. Scripted practice is labelled separately from model-played matches.

## Offline development

The project uses strict TypeScript, React, Canvas 2D and Vite in one package. Zod validates external JSON, Vitest checks rules and boundaries, and Prettier formats the code and documentation.

```sh
pnpm check          # TypeScript and tests
pnpm format         # Format source and docs
pnpm format:check   # Check formatting without changing files
pnpm build          # Typecheck and build the production viewer
pnpm fixture        # Export and replay-verify a scripted passing fixture
pnpm fixture --full # Export and replay-verify a full scripted baseline
```

Fixtures write to `artifacts/`. Tests and fixtures make no paid requests. See the [architecture](02-ARCHITECTURE.md) for simulation, controller and presentation boundaries, and [AGENTS.md](../AGENTS.md) for the working agreement.

## Generate a match

Generation calls paid APIs. Create an ignored `.env` using [.env.example](../.env.example), and set `OPENAI_API_KEY` and `GEMINI_API_KEY` locally. Keep credentials out of frontend variables and recordings.

Read the [provider guide](07-PROVIDERS.md) for supported models, pricing assumptions and combined/per-provider USD limits. Begin with a bounded test:

```sh
pnpm generate --smoke
pnpm generate --decisions 10 --usd .25 --name trial-01
```

The smoke run permits one request per provider with no repairs. The ten-decision example permits one repair per team decision. Budget reservations may stop either run early. These limits are cost estimates, not a billing guarantee.

Recordings and request metadata are saved to `artifacts/private/<name>/match.json`. Use a fresh name for each run. Ctrl+C asks the runner to stop and save an incomplete checkpoint; it does not create a resumable job. Development matches currently use two 30-second halves. Generation time and cost depend on the model requests; playback uses the saved recording.

## Evaluate short football situations

Select models and situations before paying for another complete game. `--dry-run` lists cases, input sizes and base request count without calling either provider or requiring keys:

```sh
pnpm evaluate-controllers --dry-run \
  --models gpt-5-mini,gemini-3.8-flash \
  --scenarios carry-space,pass-pressure,shooting-chance --repetitions 2
```

To evaluate real positions, add `--recording public/matches/positional-match-001.json.gz --possessions coral:5,cyan:82`. Selectors use team and **zero-based decision index**, not seconds. The recording is validated and replayed to those exact boundaries; its previous own memory and current opponent batch are reused. Future opponent decisions are not supplied.

Remove `--dry-run` only when intending paid requests, and set a fresh `--name`, `--usd`, `--openai-usd` and `--gemini-usd`. Omitting `--models` compares all four supported configurations; omitting `--scenarios` includes all five authored situations. Each repetition is an independent request per model, with at most one repair. Reports are saved in `artifacts/private/<name>/report.json`. These two-second diagnostics are not model-versus-model matches.

## Add a recording to the viewer

```sh
pnpm publish-recording artifacts/private/trial-01/match.json
```

This validates the recording, verifies its replay, and writes compressed match data plus an entry in `public/matches/`. Refresh the viewer to load it. Incomplete matches remain labelled incomplete. The command updates the local catalogue; it does not deploy a website.

See [current progress](PROGRESS.md) for implemented slices, verification and remaining work, or the [product brief](01-PRODUCT.md) for the overall direction.
