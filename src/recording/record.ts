import { clamp } from '../sim/math.ts';
import { applyDecision } from '../sim/orders.ts';
import { ENGINE_VERSION, TICK_RATE } from '../sim/rules.ts';
import { cloneState } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import type { Decision, MatchEvent, MatchState, Team, Vec2, Vec3 } from '../sim/types.ts';

export const SAMPLE_INTERVAL_TICKS = 3;

/** Named fields remain readable in exported JSON. Compression can be added later. */
export type PlayerFrame = {
  position: Vec2;
  velocity: Vec2;
  facing: Vec2;
  lastKickTick: number;
  distanceTravelled: number;
};

export type Frame = {
  tick: number;
  playingTicks: number;
  half: 1 | 2;
  phase: MatchState['phase'];
  score: Record<Team, number>;
  players: PlayerFrame[];
  ball: Vec3;
  owner: string | null;
};

export type Recording = {
  format: 'ai-football-recording';
  version: 1;
  engine: string;
  kind: 'fixture' | 'llm';
  title: string;
  description: string;
  teams: Record<Team, { name: string; controller: string }>;
  initial: MatchState;
  decisions: Decision[];
  frames: Frame[];
  events: MatchEvent[];
  finalHash: string;
  durationTicks: number;
};

export function capture(state: MatchState): Frame {
  return {
    tick: state.tick,
    playingTicks: state.playingTicks,
    half: state.half,
    phase: state.phase,
    score: { ...state.score },
    players: state.players.map((player) => ({
      position: { ...player.position },
      velocity: { ...player.velocity },
      facing: { ...player.facing },
      lastKickTick: player.lastKick,
      distanceTravelled: player.distance,
    })),
    ball: { ...state.ball.position },
    owner: state.ball.owner,
  };
}

/** FNV-1a diagnostic checksum; these constants are defined by the hash algorithm. */
export function stateHash(state: MatchState): string {
  const fnvOffsetBasis = 2166136261;
  const fnvPrime = 16777619;
  const hexadecimalDigits = 8;
  const serializedState = JSON.stringify(state);
  let hash = fnvOffsetBasis;
  for (let index = 0; index < serializedState.length; index++) {
    hash = Math.imul(hash ^ serializedState.charCodeAt(index), fnvPrime) >>> 0;
  }
  return hash.toString(16).padStart(hexadecimalDigits, '0');
}

export function verifyRecording(record: Recording): MatchState {
  if (record.engine !== ENGINE_VERSION)
    throw new Error('Re-simulation requires the matching engine');

  const state = cloneState(record.initial);
  let decisionIndex = 0;
  while (state.tick < record.durationTicks) {
    const decision = record.decisions[decisionIndex];
    if (decision?.tick === state.tick) {
      applyDecision(state, ...decision.batches);
      decisionIndex++;
    }
    const previousTick = state.tick;
    step(state);
    if (state.tick === previousTick)
      throw new Error('Recording advanced beyond a stopped simulation');
  }
  const hasUnusedDecisions = decisionIndex !== record.decisions.length;
  const hasDiverged = stateHash(state) !== record.finalHash;
  if (hasUnusedDecisions || hasDiverged) throw new Error('Replay diverged from canonical result');
  return state;
}

function frameIndexAtTick(frames: Frame[], tick: number): number {
  let lowerIndex = 0;
  let upperIndex = frames.length - 1;
  while (lowerIndex < upperIndex) {
    const middleIndex = Math.ceil((lowerIndex + upperIndex) / 2);
    if (frames[middleIndex]!.tick <= tick) lowerIndex = middleIndex;
    else upperIndex = middleIndex - 1;
  }
  return lowerIndex;
}

function interpolate(start: number, end: number, fraction: number): number {
  return start + (end - start) * fraction;
}

function interpolatePosition(start: Vec2, end: Vec2, fraction: number): Vec2 {
  return {
    x: interpolate(start.x, end.x, fraction),
    y: interpolate(start.y, end.y, fraction),
  };
}

/** Pure sampling: playback speed, seeking and frame rate cannot affect outcomes. */
export function sample(record: Recording, seconds: number): Frame {
  const tick = clamp(seconds * TICK_RATE, 0, record.durationTicks);
  const previousIndex = frameIndexAtTick(record.frames, tick);
  const nextIndex = Math.min(previousIndex + 1, record.frames.length - 1);
  const previousFrame = record.frames[previousIndex]!;
  const nextFrame = record.frames[nextIndex]!;
  if (previousFrame === nextFrame || previousFrame.phase !== nextFrame.phase) return previousFrame;

  const fraction = (tick - previousFrame.tick) / (nextFrame.tick - previousFrame.tick);
  const interpolatedBall = {
    ...interpolatePosition(previousFrame.ball, nextFrame.ball, fraction),
    z: interpolate(previousFrame.ball.z, nextFrame.ball.z, fraction),
  };
  return {
    ...previousFrame,
    tick,
    players: previousFrame.players.map((player, index) => {
      const nextPlayer = nextFrame.players[index]!;
      return {
        position: interpolatePosition(player.position, nextPlayer.position, fraction),
        velocity: interpolatePosition(player.velocity, nextPlayer.velocity, fraction),
        facing: player.facing,
        lastKickTick: player.lastKickTick,
        distanceTravelled: interpolate(
          player.distanceTravelled,
          nextPlayer.distanceTravelled,
          fraction,
        ),
      };
    }),
    // Receiving a ball is a discrete contact, not a slide through its new owner.
    ball: previousFrame.owner !== nextFrame.owner ? previousFrame.ball : interpolatedBall,
  };
}
