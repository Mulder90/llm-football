import { BALL_CONTROL, KEEPER } from './rules.ts';
import { inPenaltyArea } from './state.ts';
import type { Ball, MatchState, Player, Vec3 } from './types.ts';

export function footPosition(player: Player): Vec3 {
  return {
    x: player.position.x + player.facing.x * BALL_CONTROL.carryingOffset,
    y: player.position.y + player.facing.y * BALL_CONTROL.carryingOffset,
    z: BALL_CONTROL.radius,
  };
}

export function handPosition(player: Player): Vec3 {
  return { ...footPosition(player), z: KEEPER.handHeight };
}

export function possessionMode(
  ball: Pick<Ball, 'owner' | 'handControl'>,
): 'loose' | 'feet' | 'hands' {
  return ball.owner === null ? 'loose' : ball.handControl ? 'hands' : 'feet';
}

/** Ball centre, including the line, is the declared handling-area approximation. */
export function handlingRestriction(
  state: MatchState,
  keeper: Player,
  position = state.ball.position,
): string | null {
  if (keeper.dismissed || keeper.role !== 'keeper') return 'Only an active keeper may handle';
  if (!inPenaltyArea(state, keeper.team, position)) return 'Ball is outside the own penalty area';
  const history = state.ball.handling;
  if (history.releasedBy === keeper.id)
    return 'Keeper must wait for another player touch after release';
  if (history.directThrowInTeam === keeper.team)
    return 'Direct teammate throw-in requires foot control';
  if (history.deliberateKick?.team === keeper.team && history.deliberateKick.playerId !== keeper.id)
    return 'Deliberate teammate kick requires foot control';
  return null;
}

/** Separate histories have different reset laws. No tactical prose is consulted. */
export function noteHandlingTouch(state: MatchState, player: Player, controlled: boolean): void {
  const history = state.ball.handling;
  if (history.releasedBy !== player.id) history.releasedBy = null;
  history.directThrowBy = null; // A throw stops being direct on any subsequent player touch.
  if (player.role !== 'keeper' || player.team !== history.directThrowInTeam)
    history.directThrowInTeam = null;
  // Deflections do not convert an own-team kick into an eligible back-pass.
  if (controlled && history.deliberateKick?.team !== player.team) history.deliberateKick = null;
}

export function noteDeliberateKick(state: MatchState, player: Player, throwIn = false): void {
  noteHandlingTouch(state, player, true);
  state.ball.handling.deliberateKick = throwIn ? null : { playerId: player.id, team: player.team };
  state.ball.handling.directThrowInTeam = throwIn ? player.team : null;
}

export function clearHandPossession(state: MatchState): void {
  if (state.ball.handControl) {
    state.ball.owner = null;
    state.ball.position.z = BALL_CONTROL.radius;
  }
  state.ball.handControl = null;
  state.ball.handling = {
    deliberateKick: null,
    directThrowInTeam: null,
    releasedBy: null,
    directThrowBy: null,
  };
}
