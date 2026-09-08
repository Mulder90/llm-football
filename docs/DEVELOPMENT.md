# Development

## Run the viewer

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite; the port depends on what's available. Press **Watch the match** to start **Safe hands, open play**, the current scripted goalkeeper demo. Watching and replaying require no API keys or provider requests.

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
pnpm fixture --keeper # Export and replay-verify the current keeper demo
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

Once a new recording exists under the current ruleset, evaluate its real positions with `--recording artifacts/private/<run-name>/match.json --possessions coral:5,cyan:82`, choosing indices present in that recording. The previous public LLM recordings were removed after the keeper ruleset change. Selectors use team and **zero-based decision index**, not seconds. The recording is validated and replayed to those exact boundaries; its previous own memory and current opponent batch are reused. Future opponent decisions are not supplied.

Remove `--dry-run` only when intending paid requests, and set a fresh `--name`, `--usd`, `--openai-usd` and `--gemini-usd`. Omitting `--models` compares all four supported configurations; omitting `--scenarios` includes all five authored situations. Each repetition is an independent request per model, with at most one repair. Reports are saved in `artifacts/private/<name>/report.json`. These two-second diagnostics are not model-versus-model matches.

## Add a recording to the viewer

```sh
pnpm publish-recording artifacts/private/trial-01/match.json
```

This validates the recording, verifies its replay, and writes compressed match data plus an entry in `public/matches/`. Refresh the viewer to load it. Incomplete matches remain labelled incomplete. The command updates the local catalogue; it does not deploy a website.

## Deploy the website to Cloudflare

The public viewer is [LLM Football](https://llm-football.lore-cinque.workers.dev). It deploys as Cloudflare Workers Static Assets. `wrangler.jsonc` uploads only the production `dist/` directory to the `llm-football` application. No server code, database or model provider keys are needed; the match generator stays local. The public website includes the bundled recordings and their inspection data.

Authenticate with your own Cloudflare account, then publish deliberately:

```sh
pnpm exec wrangler login   # Once per local login; skip if already authenticated
pnpm exec wrangler whoami # Check the destination account
pnpm deploy               # Build, then publish dist/ to Cloudflare
```

Wrangler prints the deployed `workers.dev` URL. This command publishes publicly using the account's default Workers subdomain. A custom domain and automatic Git deployments are separate setup steps. Pushing to GitHub alone does not update the website.

For a local deployment-package check without uploading:

```sh
pnpm build
pnpm exec wrangler deploy --dry-run
```

First release (8 September 2026): the viewer from commit `013d0a5`, with deployment configuration in `991b2b8`, was published from a verified build snapshot while keeper development continued separately. All 177 tests, TypeScript, the production build and deployment dry run passed. All ten public assets match the tested files by SHA-256; the three bundled recordings independently replayed to their original hashes. Live browser playback, pause, seek and the team-plan/rules inspector passed with no console errors. The release includes the three existing LLM recordings and their inspection data; no model generation ran during deployment.

Only `esbuild` and `workerd` dependency build scripts are enabled in `pnpm-workspace.yaml`; these support Wrangler's tooling. Local Cloudflare state and credentials are ignored. Keep private files outside `public/`, which Vite copies into the website. Compressed match files are served as assets; the viewer handles gzip decoding before validation.

See [current progress](PROGRESS.md) for implemented slices, verification and remaining work, or the [product brief](01-PRODUCT.md) for the overall direction.
