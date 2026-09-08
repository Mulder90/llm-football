# Slice 26 — Playing to win on Cloudflare

The user requested deploying the completed local review before generating the final match. The existing Cloudflare Workers Static Assets site now serves **Playing to win** as its only bundled recording. Source `7eed90e` is deployed as `2bd2513b-5136-410a-aa3c-fa85bc666fee` at <https://llm-football.lore-cinque.workers.dev>.

The recording remains `goal-aware-match-001`, `football-0.8`, Coral 1–3 Cyan, exactly 60 playing seconds and verified replay hash `8eed7d0a`. No model calls, prompt changes or simulation changes were made for this release. Main README and the analytics snippet remain unchanged.

The source was clean and unchanged from the successful TypeScript, 287-test and production-build checks in slice 25. The deployment reused that build. The Cloudflare account check and deployment dry run passed. All eight served files match the saved build by SHA-256, including HTML, JavaScript, CSS, audio and the single-entry match catalogue. The previous keeper review plus six older match URLs return 404.

Live browser checks passed: playback starts and advances, pause and seek work, and the final frame shows 3–1 at exactly 01:00 playing time (01:47 including the presentation). The Matches inspector shows the correct title, model labels and only one recording, with no development practice options. Browser logs contain no warnings or errors. Analytics dashboard receipt remains unchecked.

Wrangler uploads only `dist/`. The catalogue identifies the compressed recording; the browser decompresses, validates and replays its recorded decisions. Keeping the viewer and match file in the same checked release prevents a ruleset mismatch. Private generation artifacts and provider credentials are outside the published directory. The checked build snapshot, asset manifest and live verification report are retained under ignored `artifacts/private/playing-to-win-release/`.

Next: watch this review, then decide whether to proceed with the final one-minute-per-half match. The final run has not started; ordinary model mistakes remain part of the intended football.
