import { advanceBall, executeKick } from './ball.ts';
import { emitEvent } from './events.ts';
import { movePlayer } from './movement.ts';
import { BALL_CONTROL, FIELD } from './rules.ts';
import type { MatchState } from './types.ts';

function stopIfBallIsOut(state: MatchState): void {
  const position = state.ball.position;
  const crossedGoalLine =
    position.x < -BALL_CONTROL.radius || position.x > FIELD.length + BALL_CONTROL.radius;
  const crossedTouchline =
    position.y < -BALL_CONTROL.radius || position.y > FIELD.width + BALL_CONTROL.radius;
  if (!crossedGoalLine && !crossedTouchline) return;

  state.phase = 'stoppage';
  for (const player of state.players) {
    player.active = null;
    player.velocity = { x: 0, y: 0 };
  }
  emitEvent(
    state,
    'ball_out',
    state.ball.lastTouch,
    'Ball fully crossed the boundary; restarts are next-slice scope',
  );
}

/** Advance one fixed tick. Mutates only the state passed by the match runner. */
export function step(state: MatchState): void {
  if (state.phase !== 'open_play') return;

  const previousPositions = new Map(
    state.players.map((player) => [player.id, { ...player.position }]),
  );
  const playersInStableOrder = [...state.players].sort((first, second) =>
    first.id < second.id ? -1 : first.id > second.id ? 1 : 0,
  );

  for (const player of playersInStableOrder) executeKick(state, player);
  for (const player of playersInStableOrder) movePlayer(state, player);
  advanceBall(state, previousPositions);
  stopIfBallIsOut(state);

  state.tick++;
  state.playingTicks++;
}
