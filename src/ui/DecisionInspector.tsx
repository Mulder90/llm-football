import { useMemo, useState } from 'react';
import type { Frame, Recording } from '../recording/record.ts';
import type { Order, Team } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { formatPlayerId, formatTime } from './format.ts';
import { rulebook } from '../protocol/rulebook.ts';
import { RESPONSE_JSON_SCHEMA } from '../protocol/schema.ts';
import { userPrompt } from '../protocol/prompt.ts';
import type { MatchListing } from './useRecordings.ts';
import { TacticalPlan } from './TacticalPlan.tsx';

export type InspectorTab = 'decisions' | 'observations' | 'prompt' | 'match';
const TAB_LABELS: Record<InspectorTab, string> = {
  decisions: 'Team plans',
  observations: 'What they see',
  prompt: 'Rules',
  match: 'Matches',
};
function describeOrder(order: Order): string {
  switch (order.type) {
    case 'hold':
      return 'Hold position';
    case 'guard':
      return 'Guard the goal';
    case 'tackle':
      return `Challenge ${formatPlayerId(order.targetId)}`;
    case 'restart_taker':
      return 'Take this restart';
    case 'move':
      return 'Move into position';
    case 'shoot':
      return 'Take a shot';
    case 'kick':
      return 'Play the ball';
  }
}

export function DecisionInspector({
  recording,
  frame,
  tab,
  onTab,
  onClose,
  onSelectFixture,
  onDownload,
  matches,
  loading,
  onImport,
  selectedPlayer,
  onSelectPlayer,
  isPlaying,
  onTogglePlayback,
}: {
  recording: Recording;
  frame: Frame;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onClose: () => void;
  onSelectFixture: (fixture: string) => void;
  onDownload: () => void;
  matches: MatchListing[];
  loading: boolean;
  onImport: (file: File) => void;
  selectedPlayer: string | null;
  onSelectPlayer: (id: string) => void;
  isPlaying: boolean;
  onTogglePlayback: () => void;
}) {
  const [team, setTeam] = useState<Team>('coral');
  const decision = recording.decisions.findLast((candidate) => candidate.tick <= frame.tick);
  const decisionId = decision?.batches[0].decisionId;
  const observation = decision?.observations?.[team];
  const formattedObservation = useMemo(
    () =>
      tab === 'observations' && observation ? JSON.stringify(JSON.parse(observation), null, 2) : '',
    [observation, tab],
  );
  const requests =
    recording.generation?.requests.filter(
      (receipt) => receipt.decisionId === decisionId && receipt.team === team,
    ) ?? [];
  return (
    <aside
      className="inspector-panel"
      aria-label="Inside the match"
      id="decision-inspector"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <header className="inspector-header">
        <div>
          <p className="eyebrow">INSIDE THE MATCH</p>
          <h2>See the plan behind the play.</h2>
        </div>
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close inside the match"
          autoFocus
        >
          ×
        </button>
      </header>
      <nav className="inspector-tabs" aria-label="Inspector sections">
        {(['decisions', 'observations', 'prompt', 'match'] as const).map((section) => (
          <button key={section} aria-pressed={tab === section} onClick={() => onTab(section)}>
            {TAB_LABELS[section]}
          </button>
        ))}
      </nav>
      <div className="inspector-body">
        {tab !== 'match' && (
          <p className="stream-boundary">
            <span className="status-dot" /> At this moment{' '}
            <span>{formatTime(frame.playingTicks / TICK_RATE)}</span>
            <button
              className="stream-pause"
              onClick={onTogglePlayback}
              aria-label={isPlaying ? 'Pause match to inspect' : 'Play match from inspector'}
            >
              {isPlaying ? 'Ⅱ Pause' : '▶ Play'}
            </button>
          </p>
        )}
        {tab === 'decisions' && (
          <>
            <p className="panel-explanation">
              Each team chooses how its players move and work together. Tap a player below to see
              where they were asked to go. A plan can succeed, fail or change.
            </p>
            {(['coral', 'cyan'] as const).map((side) => {
              const batch = decision?.batches.find((candidate) => candidate.team === side);
              const note = decision?.notes?.[side];
              return (
                <section className={`team-decisions ${side}`} key={side}>
                  <header>
                    <span className="team-chip">{side === 'coral' ? 'CR' : 'CY'}</span>
                    <div>
                      <h3>{recording.teams[side].name}</h3>
                      <p>{side === 'coral' ? 'The coral shirts' : 'The cyan shirts'}</p>
                    </div>
                    <span className="order-count">{batch?.orders.length ?? 0} players</span>
                  </header>
                  {note?.intent && <p className="tactical-note">{note.intent}</p>}
                  {note?.memory ? <TacticalPlan memory={note.memory} /> : null}
                  {decision?.fallback.includes(side) && (
                    <p className="fallback-note">
                      No new instructions arrived. Players continue their previous movements until
                      those finish.
                    </p>
                  )}
                  <div className="order-list">
                    {batch?.orders.map((order) => (
                      <button
                        className="order-row"
                        key={order.playerId}
                        aria-pressed={selectedPlayer === order.playerId}
                        onClick={() => onSelectPlayer(order.playerId)}
                      >
                        <span className="player-number">
                          #
                          {
                            recording.initial.players.find((player) => player.id === order.playerId)
                              ?.number
                          }
                        </span>
                        <span className="order-description">
                          <b>{formatPlayerId(order.playerId)}</b>
                          <span>{describeOrder(order)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {batch ? (
                    <details className="request-detail exact-orders">
                      <summary>Exact player instructions</summary>
                      <pre className="json-view">{JSON.stringify(batch, null, 2)}</pre>
                    </details>
                  ) : null}
                  {!batch?.orders.length && (
                    <p className="empty-note">No new player instructions at this moment.</p>
                  )}
                </section>
              );
            })}
          </>
        )}
        {tab === 'observations' && (
          <>
            <div className="team-switch" aria-label="Observation team">
              {(['coral', 'cyan'] as const).map((side) => (
                <button
                  key={side}
                  className={side}
                  aria-pressed={team === side}
                  onClick={() => setTeam(side)}
                >
                  {recording.teams[side].name}
                </button>
              ))}
            </div>
            <p className="panel-explanation">
              Both teams can see every player's position and movement, the ball, the score and
              recent events. Each team keeps its own plan private. They choose their next moves from
              the same moment in the match.
            </p>
            {observation ? (
              <details className="request-detail">
                <summary>Read everything this team could see</summary>
                <p>This exact snapshot updates with the replay.</p>
                <pre className="json-view" aria-label={`${team} observation`}>
                  {formattedObservation}
                </pre>
              </details>
            ) : (
              <p className="empty-note">
                This is a scripted practice match. Choose another recording to read the information
                sent to its teams.
              </p>
            )}
            {requests.length > 0 ? (
              <details className="request-detail">
                <summary>Replies and technical details</summary>
                {requests.map((request) => (
                  <details className="request-detail" key={request.attempt}>
                    <summary>
                      Attempt {request.attempt + 1} · {request.status} ·{' '}
                      {(request.latencyMs / 1000).toFixed(1)}s
                    </summary>
                    <p>{request.failure ?? 'Accepted at the shared simulation boundary.'}</p>
                    {request.feedback && (
                      <pre className="json-view">Repair feedback: {request.feedback}</pre>
                    )}
                    {observation && (
                      <details className="request-detail">
                        <summary>Exact user message</summary>
                        <pre className="json-view">{userPrompt(observation, request.feedback)}</pre>
                      </details>
                    )}
                    <pre className="json-view">{request.responseText ?? 'No response body.'}</pre>
                  </details>
                ))}
              </details>
            ) : null}
          </>
        )}
        {tab === 'prompt' && (
          <>
            <p className="panel-explanation">
              {recording.generation
                ? 'Both teams play by the same rules. They choose passes, runs, shots and challenges; the game decides what actually happens.'
                : 'This practice match uses the same football rules, with scripted player instructions.'}
            </p>
            <ul className="rules-summary">
              <li>Eleven players on each team, including a goalkeeper.</li>
              <li>Two short halves; the teams change ends at half time.</li>
              <li>Goals, saves, fouls and offside follow the action on the pitch.</li>
              <li>A planned pass or shot can fail. Neither team chooses the outcome.</li>
            </ul>
            <details className="request-detail">
              <summary>
                {recording.generation
                  ? 'Read the exact instructions given to both teams'
                  : 'Read the full football rules'}
              </summary>
              <pre className="rulebook-view">{recording.generation?.rulebook ?? rulebook()}</pre>
            </details>
            <details className="request-detail">
              <summary>Technical response format</summary>
              <pre className="json-view">
                {JSON.stringify(
                  recording.generation?.responseSchema
                    ? JSON.parse(recording.generation.responseSchema)
                    : RESPONSE_JSON_SCHEMA,
                  null,
                  2,
                )}
              </pre>
            </details>
            <p className="sound-credit">
              Stadium recording by{' '}
              <a
                href="https://freesound.org/people/paulw2k/sounds/196461/"
                target="_blank"
                rel="noreferrer"
              >
                paulw2k
              </a>{' '}
              ·{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>{' '}
              · edited excerpt
            </p>
          </>
        )}
        {tab === 'match' && (
          <>
            <p className="eyebrow">NORTH GARDEN STADIUM</p>
            <h3>{recording.title}</h3>
            <p className="panel-explanation">{recording.description}</p>
            <p className="panel-explanation">
              {recording.kind === 'llm'
                ? `Coral is controlled by ${recording.teams.coral.controller}; Cyan by ${recording.teams.cyan.controller}. Watching a recording makes no new AI requests.`
                : 'A scripted practice match, used to check the football rules and presentation.'}
            </p>
            <details className="request-detail">
              <summary>How this recording was made</summary>
              <dl className="record-facts">
                <dt>Controller</dt>
                <dd>{recording.kind === 'llm' ? 'Real model requests' : 'Scripted baseline'}</dd>
                <dt>Ruleset</dt>
                <dd>{recording.engine}</dd>
                <dt>Replay checksum</dt>
                <dd>{recording.finalHash}</dd>
                <dt>Recording</dt>
                <dd>{recording.generation?.status ?? 'Development fixture'}</dd>
              </dl>
              {recording.generation && (
                <dl className="record-facts">
                  <dt>Decisions</dt>
                  <dd>{recording.decisions.length} shared boundaries</dd>
                  <dt>Model requests</dt>
                  <dd>{recording.generation.requests.length}</dd>
                  <dt>Fallbacks</dt>
                  <dd>
                    {recording.decisions.reduce((count, entry) => count + entry.fallback.length, 0)}{' '}
                    team decisions
                  </dd>
                  <dt>Generated in</dt>
                  <dd>{formatTime(recording.generation.wallSeconds)}</dd>
                  <dt>Estimated usage</dt>
                  <dd>${recording.generation.estimatedUsd.toFixed(3)}</dd>
                </dl>
              )}
              {recording.generation && (
                <p className="panel-explanation">
                  Generation time is separate from the match clock. Usage is estimated from the
                  recorded provider token counts and prices.
                </p>
              )}
              {recording.generation?.status === 'incomplete' && (
                <p className="fallback-note">
                  Incomplete run: {recording.generation.stopReason}. The rest of the match has not
                  been invented.
                </p>
              )}
            </details>
            <button className="panel-action" onClick={onDownload}>
              Save this match ↗
            </button>
            <label className="fixture-picker">
              Recordings
              <select
                disabled={loading}
                value={
                  recording.kind === 'llm'
                    ? matches.some((entry) => entry.id === recording.initial.matchId)
                      ? recording.initial.matchId
                      : ''
                    : recording.frames.at(-1)?.phase.type === 'full_time'
                      ? 'full'
                      : 'passing'
                }
                onChange={(event) => onSelectFixture(event.target.value)}
              >
                <option value="" disabled>
                  Imported match
                </option>
                {matches.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                    {entry.complete ? '' : ' · incomplete'}
                  </option>
                ))}
                <option value="full">Full practice match · scripted</option>
                <option value="passing">Passing practice · scripted</option>
                <option value="carry-and-chip">Running & chips · scripted</option>
              </select>
            </label>
            <label className="fixture-picker">
              Open a local recording
              <input
                type="file"
                accept=".json,.gz"
                disabled={loading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImport(file);
                }}
              />
            </label>
            <a
              className="source-link"
              href="https://github.com/Mulder90/llm-football"
              target="_blank"
              rel="noreferrer"
            >
              Project source ↗
            </a>
          </>
        )}
      </div>
    </aside>
  );
}
