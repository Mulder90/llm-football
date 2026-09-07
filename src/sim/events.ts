import type { MatchEvent, MatchState } from './types.ts';

export function emitEvent(
  state: MatchState,
  type: MatchEvent['type'],
  playerId: string | null,
  detail: string,
): void {
  state.events.push({
    id: state.events.length,
    tick: state.tick,
    type,
    playerId,
    detail,
  });
}
