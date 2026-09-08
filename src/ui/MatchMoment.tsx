import type { Frame, Recording } from '../recording/record.ts';
import type { CSSProperties } from 'react';
import { activeGoal, GOAL_PRESENTATION } from '../render/celebration.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { formatPlayerId } from './format.ts';

export function MatchMoment({ recording, frame }: { recording: Recording; frame: Frame }) {
  const moment = activeGoal(recording, frame);
  if (moment) {
    const { event: goal, ageTicks } = moment;
    const teamName = recording.teams[goal.team!].name;
    const arrival = Math.min(1, ageTicks / GOAL_PRESENTATION.bannerArrivalTicks);
    const departure = Math.min(
      1,
      (GOAL_PRESENTATION.durationTicks - ageTicks) / GOAL_PRESENTATION.bannerDepartureTicks,
    );
    const style = {
      '--goal-opacity': Math.min(arrival, departure),
      '--goal-scale': 0.94 + 0.06 * arrival,
    } as CSSProperties;
    return (
      <div
        className={`goal-moment ${goal.team}`}
        style={style}
        key={goal.id}
        aria-label={`${teamName} goal`}
      >
        <span className="goal-kicker">THE CROWD GOES WILD</span>
        <strong className="goal-title">
          GOAAAAL<span>!</span>
        </strong>
        <div className="goal-summary">
          <span className="goal-team">{teamName}</span>
          <span className="goal-score">
            {frame.score.coral} — {frame.score.cyan}
          </span>
        </div>
        <span className="goal-detail">
          {goal.playerId ? `Last touch · ${formatPlayerId(goal.playerId)}` : 'A goal for the team'}
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
      event.tick < frame.tick &&
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
