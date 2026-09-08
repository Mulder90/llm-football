# Slice 24 — Single-match Cloudflare release

Date: 2026-09-08. The user explicitly requested deployment of the current version with only the latest game. This supersedes the earlier local-only publication direction. The main README remains unchanged and evergreen.

## Released

[LLM Football](https://llm-football.lore-cinque.workers.dev) now serves **One minute, two models** as its only bundled recording. Cloudflare version: **`ff1ae8ca-4e69-4017-8aa5-e8bbc83bc1f4`**, using the existing `llm-football` Workers Static Assets application. Four assets were uploaded and four unchanged assets reused.

The recording remains the full 60-playing-second match, Coral 0–1 Cyan, replay hash **`ac2a3856`**. Its bytes and keeper-review caveat are unchanged. This release does not fix the catch-position defect or claim readiness for the conditional four-minute showcase. No model requests ran during deployment.

## Changes and mechanism

The catalogue contains only `keeper-era-match-001`. The three earlier excerpt gzip files were copied to ignored `artifacts/private/catalogue-before-single-match/` and removed from `public/matches/`; original private records also remain. The build therefore uploads neither their catalogue entries nor their recording data.

Scripted fixture selection and option labels are guarded by `import.meta.env.DEV`. Vite replaces that constant during production compilation, eliminating the fixture branches and generators while preserving development practice. The production JavaScript is **394.71 kB / 125.46 kB gzip**, down from 437.80 / 138.47 kB. No dependency was added.

The recording hook now starts with null until a validated catalogue recording is loaded. The application shows a loading or error status during that interval, instead of constructing a keeper fixture that could remain playable after a failed download. An empty catalogue is an explicit error. Local-file import remains a user action; it does not add another hosted recording.

## Verification

- TypeScript and **258 tests across 29 files** pass. The final production build and Wrangler deployment dry run pass.
- The release directory has eight files and exactly one recording gzip. The bundle contains no practice labels or fixture identifiers. Independent replay and metadata-only comparison preserve the original match hash and all actions, events and receipts.
- The production preview loads the complete latest match and its inspector contains exactly one selectable recording. Scripted practices are absent.
- All **eight live files match the checked build by SHA-256**, including the 1,418,949-byte recording. Cloudflare redirects `/index.html` to `/`; verification uses that canonical homepage path.
- All six earlier recording URLs return **404**: the three previous live games (`positional-match-001`, `character-match-001`, `tactical-memory-match-001`) and three removed excerpts (`sustained-carry-pressure`, `keeper-reliability-01`, `sustained-keeper-outlet`).
- Live browser playback reaches Full time at 0–1 and exactly 60 playing seconds, with the correct model labels, 01:26 presentation duration and recorded-match label. The live inspector shows exactly one selectable recording and the keeper caveat. Browser warnings/errors are empty.

The deployment command was `pnpm exec wrangler deploy` after verifying the build, using the existing authenticated account and `wrangler.jsonc`. Local asset hashes and live verification results are retained under ignored `artifacts/private/cloudflare-release/`. Only `dist/` was uploaded; provider credentials and private generation records remain local.

Next proposed slice: reproduce and fix keeper catch attachment at pitch and penalty-area boundaries offline, then reassess the requested two-minute halves before further paid generation.
