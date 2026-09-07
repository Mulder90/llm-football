import type { MatchEvent, MatchState, Team } from './types.ts';

export function emitEvent(
  state: MatchState,
  type: MatchEvent['type'],
  playerId: string | null,
  detail: string,
  team?: Team,
): void {
  state.events.push({
    id: state.events.length,
    tick: state.tick,
    type,
    playerId,
    detail,
    ...(team ? { team } : {}),
  });
}
