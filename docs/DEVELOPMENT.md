# Development

## Run the viewer

Use Node 24.2 or newer and pnpm 11.20.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite; the port depends on what's available. Press **Watch the match** to start the default catalogue recording. **Inside the match → Matches** offers the public catalogue plus scripted practice choices in development mode. Production builds offer only catalogue entries, with no scripted fallback if loading fails. Watching and replaying require no API keys or provider requests.

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

## Evaluate sustained play offline

```sh
pnpm evaluate-sequences --dry-run
pnpm evaluate-sequences --name sustained-check-01 --repetitions 2
```

The default mode runs **scripted controllers**, without reading `.env` or accessing provider credentials. Select any of `carry-pressure,receive-follow-up,keeper-outlet` with `--scenarios`. Each case uses eight playing seconds, a fixed seed and at most 32 paired rounds / 128 controller calls including repairs. The dry run reports those explicit ceilings and initial request sizes; duration alone does not predict the round count.

Use a fresh name. Reports and one replayable recording per repetition go to `artifacts/private/<name>/`. Both sides replan using the real match scheduler, with private memory and bounded repair/fallback handling. Every result is retained, including failed criteria. A nonzero exit code signals incomplete runs or failed criteria. The common generation lock prevents overlap with another generation/evaluation job, and checkpoints use atomic rename.

Open a generated JSON file with **Inside the match → Matches → Open a local recording**. The viewer labels it scripted and identifies the planned evaluation excerpt. No catalogue change or deployment is needed. [The handoff](slices/19-SUSTAINED-PLAY-HARNESS.md) defines the metrics and scripted baseline.

## Evaluate sustained play with models

The explicit `--mode models` option pairs Coral's GPT-5 mini (low reasoning/verbosity) with Cyan's Gemini 3.8 Flash (LOW thinking, temperature 1). It uses the same three scenarios, unchanged prompts and scheduler. No environment model override is used. All three spending flags are required, including for a model dry run; these are trial allowances, not measured account balances.

```sh
pnpm evaluate-sequences --dry-run --mode models --usd .60 --openai-usd .20 --gemini-usd .40
```

This trial configuration requests one repetition per scenario, each capped at 12 paired rounds. That permits at most 24 initial requests and 24 repairs per scenario, 144 requests across the job. The shared deadline is 900 seconds. `--rounds`, `--requests`, `--wall-seconds` and `--repetitions` can tighten or explicitly revise the plan. The combined $0.60 allowance and $0.20/$0.40 provider allowances apply **once across all scenarios**. Review fresh allowances before dispatch. Remove `--dry-run` and add a fresh `--name` only when intending the paid run. Actual model mode then loads local credentials; dry runs never do.

Each scenario starts with only the job's remaining dollars, requests and wall time. The normal scheduler reserves both teams and their full repair allowance before each boundary. Under the current reviewed prices, one paired boundary reserves $0.11264 ($0.032768 OpenAI / $0.079872 Gemini), using the 32 KiB input and 4096-token output ceilings. Reported usage reduces the charge; missing usage keeps its full request reservation. These are conservative application estimates, not a quoted final bill or guaranteed number of completed scenarios.

The version-2 report records cumulative totals at every checkpoint, including the active run. Each recording stores its own remaining allowance and receipts. Completed horizons with failed football criteria remain in the report and do not trigger reruns. An incomplete scenario stops the job, preserving its exact stop reason and all prior outcomes. Ctrl+C also stops the entire job. Replay import identifies model controllers and the eight-second excerpt; a completed diagnostic is not a completed match.

The receiver criterion still specifically checks Coral #7 passing to Coral #6 followed by at least 3 m of controlled movement. Models can choose other legal tactics. Review actual passes, carries and failures alongside that fixed diagnostic; do not interpret its boolean alone as a general model score. The provider schema now omits only the orders-array length keyword that triggered Gemini HTTP 400; local validation still caps orders at eleven. The continued trial produced two incomplete excerpts. Carrying and receiving currently have identical starting states apart from match ID, so the duplicate receiver sample was skipped to preserve the shared allowance. The subsequent three-round keeper check accepted six full-roster replies first try with no fallback; it disabled repairs only for that diagnostic. See [the latest measured results and remaining allowance](slices/22-KEEPER-ORDER-RELIABILITY.md). The subsequent funded one-minute run is complete; see [its review](slices/23-ONE-MINUTE-REVIEW.md). The keeper defect was fixed in the following review, and the final two-minute run is now complete; see [slice 27](slices/27-FINAL-TWO-MINUTE-MATCH.md).

## Generate a match

Generation calls paid APIs. Create an ignored `.env` using [.env.example](../.env.example), and set `OPENAI_API_KEY` and `GEMINI_API_KEY` locally. Keep credentials out of frontend variables and recordings.

Read the [provider guide](07-PROVIDERS.md) for supported models, pricing assumptions and combined/per-provider USD limits. Begin with a bounded test:

```sh
pnpm generate --smoke
pnpm generate --decisions 10 --usd .25 --name trial-01
```

The smoke run permits one request per provider with no repairs. The ten-decision example permits one repair per team decision. Budget reservations may stop either run early. These limits are cost estimates, not a billing guarantee.

Recordings and request metadata are saved to `artifacts/private/<name>/match.json`. Use a fresh name for each run. Ctrl+C asks the runner to stop and save an incomplete checkpoint; it does not create a resumable job. Complete matches currently use two 60-second halves; use bounded sequence excerpts for shorter tests. Generation time and cost depend on the model requests; playback uses the saved recording.

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

Deploy when the user requests a release. Check the production build and the exact public catalogue before uploading; development-only practice options are excluded by Vite's production build. Preserve private recordings outside `public/` when removing them from the release.

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

The latest release contains only **Two minutes, two models**, the complete 0–5 final match under `football-0.9`, with two 60-second playing halves. All eight live assets match the checked build; eight older public/excerpt URLs return 404. Production playback and the final 02:00 playing clock pass, with a 03:12 watch timeline including stoppages and celebrations. [Slice 28](slices/28-FINAL-MATCH-RELEASE.md) records this deployment. Keep release progress in these docs; the main README remains evergreen.

Cloudflare Web Analytics loads from the module-script snippet in `index.html`, using the public site token supplied from the Cloudflare dashboard. Vite preserves the external script and its `data-cf-beacon` attribute in the production HTML. The browser sends analytics to Cloudflare independently of match playback; no simulation or recording changes are needed. View incoming visits in Cloudflare's Web Analytics dashboard after deployment. Blocking the beacon in the browser prevents those visits from being measured. This shared HTML also loads the snippet during local development; no production-only gate is configured.

See [current progress](PROGRESS.md) for implemented slices, verification and remaining work, or the [product brief](01-PRODUCT.md) for the overall direction.

With an empty match catalogue, the Vite development viewer starts the existing labelled keeper practice so import and practice controls remain accessible during a ruleset change. Production still requires a bundled recording.
