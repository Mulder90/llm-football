import { emitEvent } from './events.ts';
import { unitVector } from './math.ts';
import { awardRestart, finishMatch } from './restarts.ts';
import { FIELD, MOVEMENT, REFEREE } from './rules.ts';
import { attackDirection, inPenaltyArea } from './state.ts';
import type { MatchState, Player } from './types.ts';

export type FoulSeverity = 'careless' | 'reckless' | 'excessive';

/** A straight reach through the carrier, or a dangerous closing speed, is a foul. */
export function tackleFoul(
  state: MatchState,
  tackler: Player,
  carrier: Player,
): FoulSeverity | null {
  const toCarrier = unitVector({
    x: carrier.position.x - tackler.position.x,
    y: carrier.position.y - tackler.position.y,
  });
  const closingSpeed = Math.max(
    0,
    (tackler.velocity.x - carrier.velocity.x) * toCarrier.x +
      (tackler.velocity.y - carrier.velocity.y) * toCarrier.y,
  );
  if (closingSpeed >= REFEREE.excessiveClosingSpeed) return 'excessive';
  if (closingSpeed >= REFEREE.recklessClosingSpeed) return 'reckless';
  const toBall = {
    x: state.ball.position.x - tackler.position.x,
    y: state.ball.position.y - tackler.position.y,
  };
  const ballDistance = Math.hypot(toBall.x, toBall.y);
  const reachDirection = unitVector(toBall);
  const carrierOffset = {
    x: carrier.position.x - tackler.position.x,
    y: carrier.position.y - tackler.position.y,
  };
  const alongReach = carrierOffset.x * reachDirection.x + carrierOffset.y * reachDirection.y;
  const acrossReach = Math.abs(
    carrierOffset.x * reachDirection.y - carrierOffset.y * reachDirection.x,
  );
  const bodyBeforeBall =
    alongReach > 0 && alongReach < ballDistance && acrossReach < MOVEMENT.playerRadius;
  return bodyBeforeBall ? 'careless' : null;
}

export function awardFoul(
  state: MatchState,
  offender: Player,
  victim: Player,
  severity: FoulSeverity,
): void {
  const incident = { ...victim.position };
  emitEvent(state, 'foul', offender.id, `${severity} tackle on ${victim.id}`, offender.team);
  if (severity === 'reckless') {
    offender.yellowCards++;
    emitEvent(
      state,
      'yellow_card',
      offender.id,
      offender.yellowCards === 2 ? 'Second caution' : 'Reckless challenge',
      offender.team,
    );
  }
  if (severity === 'excessive' || offender.yellowCards === 2) {
    offender.dismissed = true;
    emitEvent(
      state,
      'red_card',
      offender.id,
      severity === 'excessive' ? 'Excessive force' : 'Two cautions',
      offender.team,
    );
  }
  if (
    state.players.filter((player) => player.team === offender.team && !player.dismissed).length <
    REFEREE.minimumPlayers
  ) {
    finishMatch(
      state,
      'abandoned',
      `${offender.team} has fewer than ${REFEREE.minimumPlayers} players`,
    );
    return;
  }
  const penalty = inPenaltyArea(state, offender.team, incident);
  const direction = attackDirection(state, victim.team);
  awardRestart(
    state,
    penalty ? 'penalty' : 'free_kick',
    victim.team,
    penalty
      ? {
          x: direction === 1 ? FIELD.length - FIELD.penaltySpotDistance : FIELD.penaltySpotDistance,
          y: FIELD.width / 2,
        }
      : incident,
  );
}
