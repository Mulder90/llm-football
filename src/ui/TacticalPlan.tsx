import type { TacticalMemory } from '../protocol/schema.ts';
import { formatPlayerId } from './format.ts';

const roleLabels: Record<TacticalMemory['assignments'][number]['role'], string> = {
  width: 'Keep width',
  support: 'Support',
  run: 'Make a run',
  cover: 'Defensive cover',
  mark: 'Mark',
};

export function TacticalPlan({ memory }: { memory: TacticalMemory }) {
  return (
    <div className="tactical-note">
      <details>
        <summary>Team plan</summary>
        <p>{memory.plan || 'No plan stated.'}</p>
        <p>Recorded memory for this team only. The opposing model never receives it.</p>
        <dl className="record-facts">
          <dt>Ball player</dt>
          <dd>{memory.ballPlayerId ? formatPlayerId(memory.ballPlayerId) : 'None assigned'}</dd>
          <dt>Pass receiver</dt>
          <dd>{memory.pass ? formatPlayerId(memory.pass.receiverId) : 'No pass planned'}</dd>
          {memory.pass ? (
            <>
              <dt>Meeting point</dt>
              <dd>
                ({memory.pass.target.x.toFixed(1)}, {memory.pass.target.y.toFixed(1)}) m
              </dd>
            </>
          ) : null}
        </dl>
        <p>
          <strong>Assignments</strong>
        </p>
        {memory.assignments.length > 0 ? (
          <ul>
            {memory.assignments.map((assignment) => (
              <li key={assignment.playerId}>
                {formatPlayerId(assignment.playerId)} · {roleLabels[assignment.role]}
                {assignment.opponentId ? ` · ${formatPlayerId(assignment.opponentId)}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>No assignments recorded.</p>
        )}
        <p>
          <strong>Opponent threats</strong>
        </p>
        {memory.threats.length > 0 ? (
          <ul>
            {memory.threats.map((threat, index) => (
              <li key={`${threat.opponentId}-${index}`}>
                {formatPlayerId(threat.opponentId)} · {threat.concern}
              </li>
            ))}
          </ul>
        ) : (
          <p>No threats noted.</p>
        )}
        <p>
          <strong>Previous attempt · model assessment</strong>
          <br />
          {memory.review || 'No review recorded.'}
        </p>
      </details>
    </div>
  );
}
