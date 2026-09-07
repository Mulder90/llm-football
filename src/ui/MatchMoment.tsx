import type { Frame, Recording } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';

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
  return null;
}
