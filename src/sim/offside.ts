import { emitEvent } from './events.ts';
import { awardRestart } from './restarts.ts';
import { FIELD, NUMERIC_TOLERANCE, REFEREE } from './rules.ts';
import { attackDirection, opponent } from './state.ts';
import type { MatchState, Player, RestartType } from './types.ts';

/** Centres represent playable body positions; level within one centimetre is onside. */
export function snapshotOffside(state: MatchState, toucher: Player, restart?: RestartType): void {
  if (restart === 'throw_in' || restart === 'corner' || restart === 'goal_kick') {
    state.offside = null;
    return;
  }
  const direction = attackDirection(state, toucher.team);
  const defenders = state.players
    .filter((player) => player.team !== toucher.team && !player.dismissed)
    .map((player) => player.position.x * direction)
    .sort((first, second) => second - first);
  const line = Math.max(
    defenders[1]!,
    state.ball.position.x * direction,
    (FIELD.length / 2) * direction,
  );
  const playerIds = state.players
    .filter(
      (player) => player.team === toucher.team && !player.dismissed && player.id !== toucher.id,
    )
    .filter(
      (player) =>
        player.position.x * direction >
        line + REFEREE.offsideTolerance + NUMERIC_TOLERANCE.vectorLength,
    )
    .map((player) => player.id);
  state.offside = { team: toucher.team, touchTick: state.tick, playerIds };
}

/** Only touching the ball or completing a tackle counts as involvement in this ruleset. */
export function penalizeOffsideInvolvement(state: MatchState, player: Player): boolean {
  if (!state.offside?.playerIds.includes(player.id)) return false;
  emitEvent(
    state,
    'offside',
    player.id,
    'Involved after an offside position at teammate touch',
    player.team,
  );
  awardRestart(state, 'indirect_free_kick', opponent(player.team), player.position);
  return true;
}

export function notePlayerTouch(
  state: MatchState,
  player: Player,
  controlled: boolean,
  save: boolean,
): void {
  const opponentSnapshot = state.offside && state.offside.team !== player.team;
  if (opponentSnapshot && (!controlled || save)) return;
  // Controlled reception is our explicit approximation of deliberate play. Rebounds and saves are not.
  snapshotOffside(state, player);
}
