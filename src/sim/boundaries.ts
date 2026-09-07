import { emitEvent } from './events.ts';
import { clamp } from './math.ts';
import { awardRestart } from './restarts.ts';
import { BALL_CONTROL, FIELD } from './rules.ts';
import { attackDirection, defendingTeam, opponent } from './state.ts';
import type { MatchState, Team, Vec2, Vec3 } from './types.ts';

export type BoundaryCrossing = {
  type: 'boundary';
  side: 'left' | 'right' | 'top' | 'bottom';
  timeFraction: number;
  position: Vec3;
};

export function pointOnSegment(from: Vec3, to: Vec3, fraction: number): Vec3 {
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  };
}

/** The ball is out only once its trailing edge has crossed the line. */
export function firstBoundaryCrossing(from: Vec3, to: Vec3): BoundaryCrossing | null {
  const radius = BALL_CONTROL.radius;
  const planes = [
    { side: 'left', axis: 'x', value: -radius, crossed: to.x < -radius },
    {
      side: 'right',
      axis: 'x',
      value: FIELD.length + radius,
      crossed: to.x > FIELD.length + radius,
    },
    { side: 'top', axis: 'y', value: -radius, crossed: to.y < -radius },
    {
      side: 'bottom',
      axis: 'y',
      value: FIELD.width + radius,
      crossed: to.y > FIELD.width + radius,
    },
  ] as const;
  const crossings: BoundaryCrossing[] = [];
  for (const plane of planes) {
    if (!plane.crossed) continue;
    const displacement = to[plane.axis] - from[plane.axis];
    const fraction =
      displacement === 0 ? 0 : clamp((plane.value - from[plane.axis]) / displacement, 0, 1);
    crossings.push({
      type: 'boundary',
      side: plane.side,
      timeFraction: fraction,
      position: pointOnSegment(from, to, fraction),
    });
  }
  // Exact corner ties use the goal line. This declared precedence has no team-color input.
  crossings.sort((first, second) => first.timeFraction - second.timeFraction);
  return crossings[0] ?? null;
}

function cornerPosition(goalX: number, crossingY: number): Vec2 {
  return { x: goalX, y: crossingY < FIELD.width / 2 ? 0 : FIELD.width };
}

function goalKickPosition(state: MatchState, team: Team): Vec2 {
  const direction = attackDirection(state, team);
  return {
    x: direction === 1 ? FIELD.goalAreaDepth : FIELD.length - FIELD.goalAreaDepth,
    y: FIELD.width / 2,
  };
}

export function resolveBoundary(state: MatchState, crossing: BoundaryCrossing): void {
  const lastTouch = state.players.find((player) => player.id === state.ball.lastTouch);
  if (!lastTouch) throw new Error('A boundary crossing must have a recorded last-touch player');

  if (crossing.side === 'top' || crossing.side === 'bottom') {
    emitEvent(state, 'ball_out', lastTouch.id, 'Touchline crossed');
    awardRestart(state, 'throw_in', opponent(lastTouch.team), {
      x: clamp(crossing.position.x, 0, FIELD.length),
      y: crossing.side === 'top' ? 0 : FIELD.width,
    });
    return;
  }

  const goalX = crossing.side === 'left' ? 0 : FIELD.length;
  const defending = defendingTeam(state, goalX);
  const attacking = opponent(defending);
  const insidePosts =
    Math.abs(crossing.position.y - FIELD.width / 2) + BALL_CONTROL.radius < FIELD.goalWidth / 2;
  const belowCrossbar = crossing.position.z + BALL_CONTROL.radius < FIELD.goalHeight;
  const directRestart = state.ball.restartTouch;

  if (insidePosts && belowCrossbar) {
    // Direct throws cannot score; other direct restarts cannot score an own goal.
    if (directRestart && (directRestart.type === 'throw_in' || directRestart.team === defending)) {
      emitEvent(state, 'restart_violation', lastTouch.id, 'Direct restart goal is not permitted');
      if (directRestart.team === defending)
        awardRestart(state, 'corner', attacking, cornerPosition(goalX, crossing.position.y));
      else awardRestart(state, 'goal_kick', defending, goalKickPosition(state, defending));
      return;
    }
    state.score[attacking]++;
    emitEvent(state, 'goal', lastTouch.id, `${attacking} scores`, attacking);
    awardRestart(state, 'kickoff', defending, { x: FIELD.length / 2, y: FIELD.width / 2 });
    return;
  }

  emitEvent(state, 'ball_out', lastTouch.id, 'Goal line crossed outside the goal');
  if (lastTouch.team === defending)
    awardRestart(state, 'corner', attacking, cornerPosition(goalX, crossing.position.y));
  else awardRestart(state, 'goal_kick', defending, goalKickPosition(state, defending));
}
