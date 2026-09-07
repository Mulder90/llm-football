# LLM control contract

## Inputs

Each team receives the same versioned rules and action descriptions. These must explain our exact simulation, not assume pretrained football knowledge: coordinate conventions, attack direction, legal actions by phase, movement limits, action durations, timing, restart restrictions, and failure handling.

Keep rules in logical context on every request, even if a provider requires physically resending them. Prompt caching or conversation persistence is an adapter optimisation, not an engine assumption.

Every observation contains a decision ID, simulation tick, match phase, half, playing time, score, ball state, all visible players, current own orders, recent public events and feedback about the team's prior orders. Initially expose the full public pitch state to both controllers. Never expose opponent pending orders, private memory, RNG state or future random outcomes.

Use structured rulebook data where useful and concise prose for meaning. Runtime validation and the documented schema must agree.

## Illustrative observation

This is a structural example, not a complete schema; the actual roster array contains all active players.

```json
{
  "protocolVersion": "0.1",
  "rulesetVersion": "football-draft-0.1",
  "matchId": "demo-001",
  "decisionId": 7,
  "tick": 420,
  "phase": "open_play",
  "half": 1,
  "playingSecondsRemaining": 173,
  "you": "coral",
  "attackDirection": "positive_x",
  "score": { "coral": 0, "cyan": 0 },
  "ball": {
    "position": [52, 31, 0.11],
    "velocity": [0, 0, 0],
    "possessorId": "coral-8"
  },
  "players": [],
  "recentEvents": [{ "type": "interception", "playerId": "coral-8" }],
  "orderFeedback": [],
  "privateMemory": "Their right winger stays high."
}
```

## Illustrative action batch

```json
{
  "protocolVersion": "0.1",
  "matchId": "demo-001",
  "decisionId": 7,
  "orders": [
    { "playerId": "coral-8", "type": "pass", "target": [65, 18], "power": 0.6 },
    { "playerId": "coral-7", "type": "move", "target": [65, 18], "effort": 0.9 }
  ],
  "memory": "Use the right channel when their midfield presses."
}
```

A target coordinate is a desired destination or kick target, never a declaration that the player/ball arrives there. A pass can miss, be intercepted or leave the field. Define how target, power and later loft/spin map to physical velocity; avoid redundant unconstrained parameters.

## Proposed order semantics to approve

- At most one new order per owned active player in a batch; reject duplicates.
- Omitted players continue existing orders until completion or expiry. Expiry triggers a declared neutral behaviour such as deceleration to rest, not an invented tactic.
- Instantaneous actions such as a kick execute once; persistent orders such as moving have bounded lifetime.
- Possession-dependent orders cancel or fail explicitly when their preconditions disappear. Never retain a shot that unexpectedly fires after possession returns much later.
- Define whether wind-up actions are cancellable and at which phase they commit.
- Phase changes can cancel orders. Ball-out-of-play must not leave an old tackle active at a corner.
- Moving to a point uses bounded mechanical steering. Tracking a moving opponent, automatic chasing and auto-interception are additional capabilities only if explicitly introduced and made equally available.
- Goalkeepers need model orders and documented execution mechanics. They are not secretly controlled by an unrelated football AI.

Likely eventual vocabulary: move, hold, kick/pass, shoot, dribble, tackle, goalkeeper catch/dive, and phase-specific restarts. Start with the minimum needed for one passing sequence; do not freeze all actions before testing.

## Validation and failures

Check JSON shape, finite values, ranges, version, match/decision identity, player ownership, duplicate IDs, phase legality and current preconditions. Distinguish a malformed/illegal instruction from a valid attempted action that fails physically or causes a foul.

Proposed first policy: validate a whole batch atomically. On rejection, provide concise validation feedback and allow a bounded retry with the same world snapshot; the opponent's accepted response remains locked and private. Once limits are exhausted, use a documented continuation/expiry fallback. Record rejection and fallback. Do not grant indefinite retries or extra world information.

Set hard generation limits for requests, retries, output size, memory size and overall job duration. A failed run can be marked incomplete; never fabricate the remaining match.

## Memory and fairness

Supply bounded recent public events and a bounded team-owned tactical notebook. Apply the same retention rules and limits to both teams. The notebook is the model's stated plan, not evidence of its hidden reasoning. Do not publish it to the opponent during generation.

Same rulebook, state boundary, controls, observations, execution assistance and declared budget policy for both teams. Record exact model IDs/configuration; API nondeterminism means regenerating a match may yield different decisions even with the same game seed. Replaying recorded decisions should not.

Test against scripted fixtures to distinguish engine defects from weak model play. Scripted baselines are clearly labelled and live outside the simulation core.
