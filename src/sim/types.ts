import type { ENGINE_VERSION } from './rules.ts';

export type Team = 'coral' | 'cyan';
/** Metres for positions, metres/second for velocities, unit length for facing. */
export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };

export type KickOrder = {
  type: 'kick' | 'shoot';
  playerId: string;
  target: Vec2;
  speed: number;
  /** Upward speed in m/s; omitted means a ground kick. */
  loft?: number;
};

export type Order =
  | { type: 'hold'; playerId: string }
  | { type: 'move'; playerId: string; target: Vec2; pace: number }
  | KickOrder
  | { type: 'guard'; playerId: string; target: Vec2 }
  | { type: 'tackle'; playerId: string; targetId: string }
  | { type: 'restart_taker'; playerId: string };

export type RestartType =
  'kickoff' | 'throw_in' | 'corner' | 'goal_kick' | 'free_kick' | 'indirect_free_kick' | 'penalty';
export type Restart = {
  type: RestartType;
  team: Team;
  position: Vec2;
  takerId: string;
};

export type MatchPhase =
  | { type: 'open_play'; sinceTick: number }
  | { type: 'restart_setup'; sinceTick: number; readyTick: number; restart: Restart }
  | { type: 'restart_ready'; sinceTick: number; deadlineTick: number; restart: Restart }
  | { type: 'halftime'; sinceTick: number; endsAtTick: number }
  | { type: 'full_time'; sinceTick: number; reason: 'completed' | 'abandoned' };

export type ActiveOrder = {
  order: Order;
  /** Simulation tick when this order stops being eligible. */
  expires: number;
  /** Simulation boundary at which both teams committed their orders. */
  issued: number;
};
export type Player = {
  id: string;
  team: Team;
  number: number;
  role: 'keeper' | 'outfield';
  yellowCards: number;
  dismissed: boolean;
  position: Vec2;
  velocity: Vec2;
  facing: Vec2;
  active: ActiveOrder | null;
  /** Simulation tick of the last executed kick; used only for presentation. */
  lastKick: number;
  lastTackleTick: number;
  lastSaveTick: number;
  /** Total metres travelled; drives distance-based run animation. */
  distance: number;
};
export type Ball = {
  position: Vec3;
  velocity: Vec3;
  owner: string | null;
  lastTouch: string | null;
  /** Simulation tick of the last kick; controls the recapture cooldown. */
  kickedAt: number;
  /** Cleared on another player's touch; enforces direct-restart and second-touch rules. */
  restartTouch: { type: RestartType; team: Team; takerId: string } | null;
};
export type MatchEvent = {
  id: number;
  tick: number;
  type:
    | 'kick'
    | 'shot'
    | 'receive'
    | 'interception'
    | 'order_failed'
    | 'ball_out'
    | 'goal'
    | 'save'
    | 'block'
    | 'post'
    | 'tackle'
    | 'foul'
    | 'yellow_card'
    | 'red_card'
    | 'offside'
    | 'restart_awarded'
    | 'restart_ready'
    | 'restart_taken'
    | 'restart_violation'
    | 'halftime'
    | 'full_time'
    | 'abandoned';
  playerId: string | null;
  detail: string;
  team?: Team;
};
export type MatchState = {
  version: typeof ENGINE_VERSION;
  matchId: string;
  tick: number;
  playingTicks: number;
  half: 1 | 2;
  phase: MatchPhase;
  halfPlayingTicks: number;
  firstKickoffTeam: Team;
  score: Record<Team, number>;
  seed: number;
  decisionId: number;
  players: Player[];
  ball: Ball;
  /** Position snapshot at a teammate's touch, retained through rebounds and saves. */
  offside: { team: Team; touchTick: number; playerIds: string[] } | null;
  events: MatchEvent[];
};
export type Batch = {
  version: 1;
  matchId: string;
  decisionId: number;
  team: Team;
  tick: number;
  orders: Order[];
};
export type Decision = {
  tick: number;
  batches: [Batch, Batch];
  fallback: Team[];
  notes?: Record<Team, { intent: string; memory: string }>;
  observations?: Record<Team, string>;
};
