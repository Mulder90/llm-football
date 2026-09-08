import { executeKeeperOrder, checkKeeperHoldLimit } from './keeper.ts';
import { advanceBall, executeKick } from './ball.ts';
import { movePlayer } from './movement.ts';
import { separatePlayers } from './player-contacts.ts';
import { advanceMatchClock } from './restarts.ts';
import { resolveTackles } from './tackles.ts';
import type { MatchState } from './types.ts';

/** The runner owns the number of steps. No wall-clock or controller work belongs here. */
export function step(state: MatchState): void {
  if (state.phase.type === 'full_time') return;

  const playersInStableOrder = [...state.players].sort((first, second) =>
    first.id < second.id ? -1 : 1,
  );
  const startedPlaying = state.phase.type === 'open_play';
  if (state.phase.type === 'restart_setup') {
    for (const player of playersInStableOrder) movePlayer(state, player);
    separatePlayers(state);
  }
  if (state.phase.type === 'open_play' || state.phase.type === 'restart_ready') {
    for (const player of playersInStableOrder) {
      if (state.phase.type !== 'open_play' && state.phase.type !== 'restart_ready') break;
      executeKick(state, player);
      executeKeeperOrder(state, player);
    }
  }
  const wasPlaying = startedPlaying || state.phase.type === 'open_play';
  if (state.phase.type === 'open_play') {
    // Instant kicks commit before tackles; neither side gets priority from request arrival.
    resolveTackles(state);
  }
  if (state.phase.type === 'open_play') {
    const previousPositions = new Map(
      state.players.map((player) => [player.id, { ...player.position }]),
    );
    for (const player of playersInStableOrder) movePlayer(state, player);
    separatePlayers(state);
    advanceBall(state, previousPositions);
  }
  checkKeeperHoldLimit(state);
  advanceMatchClock(state, wasPlaying);
}
