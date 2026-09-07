import type { Frame, Recording } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { Team } from '../sim/types.ts';
import { formatTime } from './format.ts';

function RobotBadge({ team }: { team: Team }) {
  return (
    <svg className={`robot ${team}`} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M15 2h2v5h-2zM12 1h8v3h-8zM4 7h24v20H4zM1 13h3v9H1zM28 13h3v9h-3zM9 27h5v4H9zM19 27h5v4h-5z"
        fill="currentColor"
      />
      <path d="M8 12h16v10H8z" fill="#16313a" />
      <path d="M10 14h4v4h-4zM18 14h4v4h-4z" fill="#e8f1d9" />
    </svg>
  );
}

export function Scoreboard({
  recording,
  frame,
  hasEnded,
}: {
  recording: Recording;
  frame: Frame;
  hasEnded: boolean;
}) {
  return (
    <div className="scoreboard">
      <div className="team team-coral">
        <RobotBadge team="coral" />
        <div>
          <h2>{recording.teams.coral.name}</h2>
          <p>{recording.teams.coral.controller}</p>
        </div>
        <span className="team-abbr">COR</span>
      </div>
      <div className="score">
        <div>
          <b>{frame.score.coral}</b>
          <span>—</span>
          <b>{frame.score.cyan}</b>
        </div>
        <p>
          <span>
            {frame.phase.type === 'full_time'
              ? frame.phase.reason === 'completed'
                ? 'FULL TIME'
                : 'INCOMPLETE'
              : hasEnded
                ? 'END OF RECORDING'
                : frame.phase.type === 'halftime'
                  ? 'HALF TIME'
                  : 'restart' in frame.phase
                    ? frame.phase.restart.type.replaceAll('_', ' ').toUpperCase()
                    : `HALF ${frame.half}`}{' '}
          </span>
          <i />
          {formatTime(frame.playingTicks / TICK_RATE)}
        </p>
      </div>
      <div className="team team-cyan">
        <span className="team-abbr">CYN</span>
        <div>
          <h2>{recording.teams.cyan.name}</h2>
          <p>{recording.teams.cyan.controller}</p>
        </div>
        <RobotBadge team="cyan" />
      </div>
    </div>
  );
}
