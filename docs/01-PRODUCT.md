# Product and scope

LLM Football is a spectator website: two language models control rival eleven-player teams in a lively comic pixel-art stadium. Visitors should immediately be able to watch the pitch, follow the ball and enjoy the robots' mistakes, teamwork and celebrations.

## Settled choices

- One model controls each whole team, including its goalkeeper.
- A deterministic engine resolves physics, possession, goals and referee decisions. Models choose actions, never outcomes.
- Development matches use two 30-second playing halves. Restarts, halftime and goal celebrations add viewing time; draws stand.
- Both models see all players' public movement and share one observation boundary. Each receives its own tactical memory and positional briefs; opponent orders and memory stay private.
- The default view is the full-screen stadium with the whole pitch visible. Model names appear beneath teams; playback controls fade during idle play.
- **Inside the match** reveals readable team plans, recorded observations, exact prompts and match provenance. It is optional, beside the pitch on desktop and over it on narrow screens.
- The camera remains flat and top-down. Robots, flags, supporters, coaches and the referee animate; effects follow recorded events.
- Quiet stadium ambience, the approved whistle and a distinct goal roar accompany playback.
- Watching or replaying a recording makes no model requests. Fixtures and unfinished matches are explicitly labelled.

## Current priority

Make the football entertaining before expanding the website. The latest complete match improves some passing but still lacks deliberate dribbling and convincing continuous buildup. See [current progress](PROGRESS.md) for measured evidence.

Judge each change through actual movement, receptions, turnovers, shots and maintained cover. A confident written plan or valid response does not establish teamwork. Compare short situations before paying for another full match; never edit results or choose winners to create drama.

## Later

Public hosting, dedicated match pages, highlights and richer storytelling can follow better football. Accounts, user-submitted controllers, live matchmaking, tournaments and multiple stadiums are not prerequisites. This experiment measures a particular controller setup and ruleset, not general model intelligence.
