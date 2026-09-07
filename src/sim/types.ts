import type { ENGINE_VERSION } from './rules.ts';

export type Team = 'coral' | 'cyan';
/** Metres for positions, metres/second for velocities, unit length for facing. */
export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };

export type Order =
  | { type: 'hold'; playerId: string }
  | { type: 'move'; playerId: string; target: Vec2; pace: number }
  | { type: 'kick'; playerId: string; target: Vec2; speed: number };

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
  position: Vec2;
  velocity: Vec2;
  facing: Vec2;
  active: ActiveOrder | null;
  /** Simulation tick of the last executed kick; used only for presentation. */
  lastKick: number;
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
};
export type MatchEvent = {
  id: number;
  tick: number;
  type: 'kick' | 'receive' | 'interception' | 'order_failed' | 'ball_out';
  playerId: string | null;
  detail: string;
};
export type MatchState = {
  version: typeof ENGINE_VERSION;
  matchId: string;
  tick: number;
  playingTicks: number;
  half: 1 | 2;
  phase: 'open_play' | 'stoppage' | 'full_time';
  score: Record<Team, number>;
  seed: number;
  decisionId: number;
  players: Player[];
  ball: Ball;
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
export type Decision = { tick: number; batches: [Batch, Batch]; fallback: Team[] };
