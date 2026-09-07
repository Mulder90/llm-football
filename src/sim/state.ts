import { BALL_CONTROL, BEFORE_MATCH_TICK, ENGINE_VERSION, FIELD } from './rules.ts';
import type { MatchPhase, MatchState, Order, Player, Team, Vec2 } from './types.ts';

// Initial 4–3–3 formation, expressed in metres for a side attacking positive x.
// These are setup data, not movement targets chosen by an execution helper.
const INITIAL_FORMATION: readonly Vec2[] = [
  { x: 5, y: 34 }, // Goalkeeper
  { x: 24, y: 10 }, // Left back
  { x: 22, y: 26 }, // Left centre back
  { x: 22, y: 42 }, // Right centre back
  { x: 24, y: 58 }, // Right back
  { x: 40, y: 15 }, // Left midfield
  { x: 37, y: 34 }, // Centre midfield
  { x: 40, y: 53 }, // Right midfield
  { x: 48, y: 12 }, // Left wing
  { x: 50, y: 34 }, // Centre forward
  { x: 48, y: 56 }, // Right wing
];
const DEFAULT_SEED = 2026;
const INITIAL_CARRIER_ID = 'coral-7';

export function createMatch(matchId = 'fixture-001', seed = DEFAULT_SEED): MatchState {
  const players: Player[] = [];
  for (const team of ['coral', 'cyan'] as const) {
    INITIAL_FORMATION.forEach((position, index) => {
      players.push({
        id: `${team}-${index + 1}`,
        team,
        number: index + 1,
        role: index === 0 ? 'keeper' : 'outfield',
        position:
          team === 'coral'
            ? { ...position }
            : {
                x: FIELD.length - position.x,
                y: FIELD.width - position.y,
              },
        velocity: { x: 0, y: 0 },
        facing: { x: team === 'coral' ? 1 : -1, y: 0 },
        active: null,
        lastKick: BEFORE_MATCH_TICK,
        lastTackleTick: BEFORE_MATCH_TICK,
        lastSaveTick: BEFORE_MATCH_TICK,
        distance: 0,
      });
    });
  }

  const carrier = players.find((player) => player.id === INITIAL_CARRIER_ID)!;
  return {
    version: ENGINE_VERSION,
    matchId,
    tick: 0,
    playingTicks: 0,
    half: 1,
    phase: { type: 'open_play', sinceTick: 0 },
    halfPlayingTicks: 0,
    firstKickoffTeam: 'coral',
    score: { coral: 0, cyan: 0 },
    seed: seed >>> 0 || 1,
    decisionId: 0,
    players,
    ball: {
      position: {
        x: carrier.position.x + BALL_CONTROL.carryingOffset,
        y: carrier.position.y,
        z: BALL_CONTROL.radius,
      },
      velocity: { x: 0, y: 0, z: 0 },
      owner: carrier.id,
      lastTouch: carrier.id,
      kickedAt: BEFORE_MATCH_TICK,
      restartTouch: null,
    },
    events: [],
  };
}

export function opponent(team: Team): Team {
  return team === 'coral' ? 'cyan' : 'coral';
}

export function cloneOrder(order: Order): Order {
  return 'target' in order ? { ...order, target: { ...order.target } } : { ...order };
}

// Explicit copying avoids platform APIs and shares no mutable coordinates.
export function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    score: { ...state.score },
    phase: clonePhase(state.phase),
    players: state.players.map((player) => ({
      ...player,
      position: { ...player.position },
      velocity: { ...player.velocity },
      facing: { ...player.facing },
      active: player.active ? { ...player.active, order: cloneOrder(player.active.order) } : null,
    })),
    ball: {
      ...state.ball,
      restartTouch: state.ball.restartTouch ? { ...state.ball.restartTouch } : null,
      position: { ...state.ball.position },
      velocity: { ...state.ball.velocity },
    },
    events: state.events.map((event) => ({ ...event })),
  };
}

export function clonePhase(phase: MatchPhase): MatchPhase {
  return 'restart' in phase
    ? { ...phase, restart: { ...phase.restart, position: { ...phase.restart.position } } }
    : { ...phase };
}

/** Initial formation is reused only for kickoffs, never as tactical assistance in play. */
export function resetFormation(state: MatchState): void {
  for (const player of state.players) {
    const initial = INITIAL_FORMATION[player.number - 1]!;
    const positiveAttack = attackDirection(state, player.team) === 1;
    player.position = positiveAttack
      ? { ...initial }
      : { x: FIELD.length - initial.x, y: FIELD.width - initial.y };
    player.velocity = { x: 0, y: 0 };
    player.facing = { x: positiveAttack ? 1 : -1, y: 0 };
    player.active = null;
  }
}

export function attackDirection(state: MatchState, team: Team): 1 | -1 {
  return (team === 'coral') === (state.half === 1) ? 1 : -1;
}

export function defendingTeam(state: MatchState, goalX: number): Team {
  return attackDirection(state, 'coral') === (goalX === 0 ? 1 : -1) ? 'coral' : 'cyan';
}

export function inOwnPenaltyArea(state: MatchState, player: Player): boolean {
  const distanceFromGoal =
    attackDirection(state, player.team) === 1
      ? player.position.x
      : FIELD.length - player.position.x;
  return (
    distanceFromGoal <= FIELD.penaltyAreaDepth &&
    Math.abs(player.position.y - FIELD.width / 2) <= FIELD.penaltyAreaWidth / 2
  );
}
