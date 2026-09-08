import type { Frame, Recording } from '../recording/record.ts';
import type { CSSProperties } from 'react';
import {
  activeGoal,
  GOAL_PRESENTATION,
  goalTransitionOpacity,
  goalWatchSeconds,
} from '../render/celebration.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { formatPlayerId } from './format.ts';

const GOAL_BURST_SECONDS = 1.1;
const CALLOUT_ARRIVAL_TICKS = 0.15 * TICK_RATE;

/** Every entrance is sampled from the playhead, so pause and seeking also stop the lettering. */
function calloutStyle(ageTicks: number): CSSProperties {
  const arrival = Math.min(1, ageTicks / CALLOUT_ARRIVAL_TICKS);
  return {
    '--callout-scale': 0.92 + 0.08 * arrival,
    '--callout-tilt': `${-3 * (1 - arrival)}deg`,
  } as CSSProperties;
}

export function MatchMoment({
  recording,
  frame,
  reducedMotion = false,
}: {
  recording: Recording;
  frame: Frame;
  reducedMotion?: boolean;
}) {
  const moment = activeGoal(recording, frame);
  if (moment) {
    const { event: goal, ageTicks } = moment;
    const teamName = recording.teams[goal.team!].name;
    const ageSeconds = goalWatchSeconds(ageTicks);
    const bursting = ageSeconds < GOAL_BURST_SECONDS;
    const lastTouch = recording.initial.players.find((player) => player.id === goal.playerId);
    const scorer = lastTouch
      ? lastTouch.team === goal.team
        ? `#${lastTouch.number} scores!`
        : `Own goal · ${formatPlayerId(lastTouch.id)}`
      : 'One for the team!';
    const transitionOpacity = reducedMotion ? 0 : goalTransitionOpacity(ageSeconds);
    return (
      <>
        {ageSeconds < GOAL_PRESENTATION.transitionStartSeconds ? (
          <div
            className={`goal-moment ${goal.team} ${bursting ? 'goal-burst' : 'goal-strip'}`}
            style={calloutStyle(ageTicks)}
            key={goal.id}
            aria-label={`${teamName} goal. ${scorer} ${frame.score.coral} to ${frame.score.cyan}.`}
          >
            <strong className="goal-title">{bursting ? 'GOAAAAL!' : 'GOAL!'}</strong>
            <div className="goal-summary">
              <span className="goal-team">{teamName}</span>
              <span className="goal-detail">{scorer}</span>
            </div>
            <span className="goal-score">
              {frame.score.coral} — {frame.score.cyan}
            </span>
          </div>
        ) : null}
        {transitionOpacity > 0 ? (
          <div
            className={`restart-wipe ${ageSeconds < GOAL_PRESENTATION.transitionStartSeconds ? 'goal-cut' : ''}`}
            style={{ opacity: transitionOpacity }}
            aria-hidden="true"
          >
            {ageSeconds >= GOAL_PRESENTATION.transitionStartSeconds ? (
              <span>BACK TO IT!</span>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }
  if (frame.phase.type === 'halftime')
    return (
      <div className="interval-moment" style={calloutStyle(frame.tick - frame.phase.sinceTick)}>
        <span>HALF TIME</span>
        <strong>Catch your breath!</strong>
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
        ? 'PENALTY!'
        : `${incident.type.replaceAll('_', ' ').toUpperCase()}!`;
    return (
      <div
        className={`referee-moment ${incident.type}`}
        style={calloutStyle(frame.tick - incident.tick - 1)}
      >
        <span className="referee-signal" aria-hidden="true" />
        <div>
          <strong>{label}</strong>
          <span>
            {incident.playerId ? formatPlayerId(incident.playerId) : 'The referee calls it'}
          </span>
        </div>
      </div>
    );
  }
  // The whistle is a clock event: it belongs to this exact frame, not the next physical step.
  const kickoff = recording.events.findLast(
    (event) =>
      event.tick <= frame.tick && event.type === 'restart_ready' && event.detail === 'kickoff',
  );
  if (
    kickoff &&
    frame.tick - kickoff.tick < TICK_RATE &&
    (frame.phase.type === 'restart_ready' || frame.phase.type === 'open_play')
  )
    return (
      <div className="kickoff-moment" style={calloutStyle(frame.tick - kickoff.tick)}>
        <strong>LET’S PLAY!</strong>
        <span>{kickoff.team ? `${recording.teams[kickoff.team].name} kick off` : 'Kickoff'}</span>
      </div>
    );
  return null;
}
