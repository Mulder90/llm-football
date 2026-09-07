import { footPosition } from './ball.ts';
import { emitEvent } from './events.ts';
import { distanceBetween, nextRandom } from './math.ts';
import { BALL_CONTROL, NUMERIC_TOLERANCE, TACKLE } from './rules.ts';
import type { MatchState, Player } from './types.ts';

/** One attempt at the named opponent. This never moves or chases for the player. */
export function resolveTackles(state: MatchState): void {
  const carrier = state.players.find((player) => player.id === state.ball.owner);
  const eligible: { player: Player; ballDistance: number }[] = [];
  for (const player of state.players) {
    const active = player.active;
    if (active?.order.type !== 'tackle') continue;
    player.active = null;
    if (active.expires <= state.tick) continue;
    if (state.tick - player.lastTackleTick < TACKLE.recoveryTicks) {
      emitEvent(state, 'order_failed', player.id, 'Tackle is still recovering');
      continue;
    }
    player.lastTackleTick = state.tick;
    const ballDistance = distanceBetween(player.position, state.ball.position);
    const canReach =
      carrier?.id === active.order.targetId &&
      carrier.team !== player.team &&
      distanceBetween(player.position, carrier.position) <= TACKLE.maximumOpponentDistance &&
      ballDistance <= TACKLE.ballReach &&
      state.ball.position.z <= BALL_CONTROL.maximumFootControlHeight;
    if (!canReach) {
      emitEvent(state, 'order_failed', player.id, 'Tackle did not reach the carrier and ball');
      continue;
    }
    eligible.push({ player, ballDistance });
  }
  eligible.sort(
    (first, second) =>
      first.ballDistance - second.ballDistance || (first.player.id < second.player.id ? -1 : 1),
  );
  const nearest = eligible[0];
  if (!nearest) return;
  const tied = eligible.filter(
    (candidate) =>
      Math.abs(candidate.ballDistance - nearest.ballDistance) < NUMERIC_TOLERANCE.vectorLength,
  );
  let winner = nearest.player;
  if (tied.length > 1) {
    const random = nextRandom(state.seed);
    state.seed = random.seed;
    winner = tied[Math.floor(random.value * tied.length)]!.player;
  }
  state.ball.owner = winner.id;
  state.ball.lastTouch = winner.id;
  state.ball.restartTouch = null;
  state.ball.position = footPosition(winner);
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  emitEvent(state, 'tackle', winner.id, 'Clean tackle reaches the ball', winner.team);
}
