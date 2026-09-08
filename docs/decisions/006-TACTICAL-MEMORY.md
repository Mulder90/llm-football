# Decision 006 — Structured tactical memory and short development matches

Status: accepted under the user's 8 September 2026 direction to improve the football experience, add the proposed small structured tactical memory, reduce halves to 30 seconds, stop the running generation and address crowding. This supersedes decision 005's two-minute duration and the earlier free-text notebook shape. One model controls each team; the deterministic engine still resolves every outcome.

## Context

The controllers already receive all 22 players' public positions, velocities and facing. More whole-roster orders reduced idle players, but movement targets can converge around the ball and written intent can lack continuity. The earlier 500-character notebook did not give plans, off-ball responsibilities or previous-attempt review a consistent shape. A four-minute match is too costly and slow for each development iteration.

## Decision

Use football-0.5 with two 30-second playing halves. The single `MATCH_TIMING.halfPlayingTicks` constant remains authoritative for the engine, observations, prompt and complete-record validation. Public recordings from earlier versions are removed. There is no old-memory converter, legacy-duration map or replay compatibility implementation.

Replace free-text memory with the strict `tacticalMemorySchema` in `src/protocol/schema.ts`. The object contains a short `plan`, nullable `ballPlayerId`, nullable `pass` with receiver and meeting point, distinct off-ball `assignments`, up to two opponent `threats`, and a short `review`. Owned references must name active teammates; opponent references must name active opponents. A pass requires a ball player and a different receiver. Character, array and coordinate bounds keep the context finite. Imported notes reuse reference-side, assignment and pass validation against the original roster; historical fallback memory may legitimately retain a player who was later dismissed.

Each team starts with null memory. An accepted response replaces only its own object, which is cloned into its next observation. An invalid reply cannot replace memory. When repairs are exhausted, the explicit empty-order fallback carries forward the previous memory. Retained plans can become stale as play changes; the model receives current state and must update them. The simulation never reads memory or converts assignments into actions.

Public opponent movement remains visible while opponent orders, private memory and pending replies remain hidden. The model may infer an opponent's likely purpose from position and velocity; it must distinguish that inference from an observed fact. The inspector may reveal recorded plans to spectators without changing the controller information boundary.

The prompt assigns one player to the ball and one receiver to a pass meeting point. It asks other players to maintain distinct supporting targets, width, different depths and defensive cover across decisions. Six metres of support spacing is a soft preference with football exceptions, not an engine rule. `nearestTeammate` reports current public geometry, excluding self and dismissed teammates; it does not select a destination. There is no automatic spreading, marking, chasing, receiver choice or pass correction.

The model's `review` is an assessment, not an outcome declaration. The observation includes the previous decision tick and retains the latest 12 non-`block` public events so repeated deflections do not bury a pass, reception or turnover. The complete recording keeps all events. Own action-failure feedback remains separately bounded. Models should report unresolved attempts where current evidence is insufficient.

## Principal alternative

Keep enlarging the free-text notebook and prompt, or have the engine assign formations and spread players automatically. Structured memory makes continuity inspectable without a separate planning service. Automatic tactical movement would change the control contract and obscure whether the models actually coordinated, so it is outside this slice.

## Consequences and verification

The response schema becomes larger and models emit more structured output. Shorter matches reduce the required play, but lower inference latency or lower cost per decision is not guaranteed. The added fields can reveal contradictory plans; they do not prevent poor tactics. The same schema and action capabilities apply to both providers.

Verification must cover memory bounds and active-player ownership, duplicate assignments, private carry-forward, fallback preservation, observation isolation and request-size limits. The scripted one-minute fixture exercises halftime and exact full time, and independent replay must reproduce its hash. Real-model evidence is recorded separately in [slice 8](../slices/08-TACTICAL-MEMORY.md); no quality improvement is claimed before that evaluation.

Revisit the memory fields after inspecting actual pass completion, spacing, stale plans and repair frequency. Prefer the smallest change supported by those failures. Broadcast, highlights and rendering remain later work.
