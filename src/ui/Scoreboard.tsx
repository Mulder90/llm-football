import type { Frame, Recording } from '../recording/record.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { activeGoal } from '../render/celebration.ts';
import { formatTime, recordingLabel } from './format.ts';

export function Scoreboard({
  recording,
  frame,
  hasEnded,
}: {
  recording: Recording;
  frame: Frame;
  hasEnded: boolean;
}) {
  const phaseLabel =
    frame.phase.type === 'full_time'
      ? frame.phase.reason === 'completed'
        ? 'Full time'
        : 'Unfinished'
      : hasEnded
        ? 'End of recording'
        : activeGoal(recording, frame)
          ? 'Goal!'
          : frame.phase.type === 'halftime'
            ? 'Half time'
            : 'restart' in frame.phase
              ? frame.phase.restart.type.replaceAll('_', ' ')
              : `${frame.half === 1 ? '1st' : '2nd'} half`;
  return (
    <div
      className="scoreboard"
      aria-label={`${recording.teams.coral.name} ${frame.score.coral}, ${recording.teams.cyan.name} ${frame.score.cyan}. ${phaseLabel}. ${formatTime(frame.playingTicks / TICK_RATE)}`}
    >
      <div className="score-line">
        <span className="score-team coral" title={recording.teams.coral.name}>
          <span>{recording.teams.coral.name}</span>
          <small>
            {recording.kind === 'fixture'
              ? 'Scripted'
              : (recording.generation?.controllers.coral.model ?? recording.teams.coral.controller)}
          </small>
        </span>
        <strong className="score-numbers">
          <span>{frame.score.coral}</span>
          <span className="score-divider">:</span>
          <span>{frame.score.cyan}</span>
        </strong>
        <span className="score-team cyan" title={recording.teams.cyan.name}>
          <span>{recording.teams.cyan.name}</span>
          <small>
            {recording.kind === 'fixture'
              ? 'Scripted'
              : (recording.generation?.controllers.cyan.model ?? recording.teams.cyan.controller)}
          </small>
        </span>
      </div>
      <div className="match-clock">
        <span>{phaseLabel}</span>
        <b>{formatTime(frame.playingTicks / TICK_RATE)}</b>
      </div>
      <span className="recording-kind">{recordingLabel(recording)}</span>
    </div>
  );
}
