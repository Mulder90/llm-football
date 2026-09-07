import type { Frame, Recording } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { formatPlayerId } from './format.ts';

const GOAL_BANNER_TICKS = 1.8 * TICK_RATE;
export function MatchMoment({ recording, frame }: { recording: Recording; frame: Frame }) {
  const goal = recording.events.findLast(
    (event) => event.type === 'goal' && event.tick <= frame.tick,
  );
  if (goal && frame.tick - goal.tick < GOAL_BANNER_TICKS && frame.phase.type !== 'full_time') {
    return (
      <div className={`goal-moment ${goal.team}`} key={goal.id} aria-label={`${goal.team} goal`}>
        <span className="goal-kicker">NORTH GARDEN ERUPTS</span>
        <strong>
          GOOOAL<span>!</span>
        </strong>
        <span className="goal-team">{goal.team ? recording.teams[goal.team].name : ''}</span>
        <span className="goal-score">
          {frame.score.coral} — {frame.score.cyan}
        </span>
      </div>
    );
  }
  if (frame.phase.type === 'halftime')
    return (
      <div className="interval-moment">
        <span>HALF TIME</span>
        <strong>A moment to regroup.</strong>
        <p>The teams are changing ends.</p>
      </div>
    );
  const incident = recording.events.findLast(
    (event) =>
      event.tick <= frame.tick &&
      (['foul', 'offside', 'yellow_card', 'red_card'].includes(event.type) ||
        (event.type === 'restart_awarded' && event.detail === 'penalty')),
  );
  if (incident && frame.tick - incident.tick < 2 * TICK_RATE && frame.phase.type !== 'full_time') {
    const label =
      incident.type === 'restart_awarded'
        ? 'PENALTY'
        : incident.type.replaceAll('_', ' ').toUpperCase();
    return (
      <div className={`referee-moment ${incident.type}`}>
        <span className="referee-signal" aria-hidden="true" />
        <div>
          <strong>{label}</strong>
          <span>{incident.playerId ? formatPlayerId(incident.playerId) : 'Referee decision'}</span>
        </div>
      </div>
    );
  }
  return null;
}
