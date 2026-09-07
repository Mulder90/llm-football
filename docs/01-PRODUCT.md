# Product and scope

## The experience

A visitor opens a match, sees two AI teams and a scoreboard, and watches a short complete football game. They can replay a goal, slow down an exchange, or inspect the orders behind a move. Watching a published match does not trigger fresh inference calls.

The intended appeal is coherent team behaviour, rivalry, errors, adaptations and occasional excellent plays. Outcomes must emerge from actual model decisions and documented game mechanics. Do not manufacture a story by assigning successes or editing results.

This is initially a spectator experiment and a substantial engineering project. It is not a definitive measure of general model intelligence. Prompts, memory policies, action vocabulary, observation detail and game version all influence results.

## Confirmed in this conversation

- Standalone new repository focused on one game: football.
- One model controls each team and issues instructions for its players.
- Target roster is 11 versus 11 including goalkeepers.
- Continuous-looking action with LLM observation/decision cycles underneath.
- Two three-minute halves.
- Watch and re-watch on the website.
- Top-down rendering selected over the oblique 2.5D mockups.
- Minimal but beautiful pixel art, animated players, attractive pitch and stadium.
- Minimal football sound effects and crowd ambience.
- Deterministic engine referee, with corners and other recognisable football rules.
- Build iteratively with AI while preserving the user's understanding and control.

## Proposed defaults for review

- Use robots from the selected visual reference initially; human sprites remain a future artistic option.
- TypeScript, Canvas 2D, React, Vite, pnpm and Vitest in one package.
- 60 simulation ticks per second; one team decision per simulated second initially.
- Generate completed matches before publishing. Add buffered broadcasting only after generation throughput is measured.
- Pause the playing clock during restart setup. This produces six minutes of active play, so the complete viewing duration can exceed six minutes with restarts, halftime and celebrations. Never label the total replay duration as exactly 06:00 unless it is actually six minutes.
- Normal matches may end in a draw. Knockout extensions are later scope.
- Single initial stadium, team palette swaps, whole-pitch camera first, optional tracking camera later.

## Public website

First public experience: a small list of completed matches and a dedicated match player. A match page shows model/team identities, score, clock, half, playback and volume controls, and optional inspection. Display results only as playback reaches them by default to avoid spoiling a replay.

Every published match should identify its ruleset/game version and controller configuration. Clearly label fixtures, scripted baselines, incomplete matches and model-controlled matches. Selected highlights can be editorial; make complete match records available.

Account systems, submissions from strangers, live matchmaking, leaderboards across unrelated versions, monetisation, commentary generation and multiple stadium themes are not prerequisites.

## Product test

Watch a few possessions without opening the inspector. Can a viewer follow the ball, recognise which team is attacking, understand a goal or foul, and see a purposeful pass or defensive response? If not, investigate control design, execution mechanics and visual readability before adding site features.
