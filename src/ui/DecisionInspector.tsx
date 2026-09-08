import { useMemo, useState } from 'react';
import type { Frame, Recording } from '../recording/record.ts';
import type { MatchEvent, Order, Team, Vec2 } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { formatPlayerId, formatTime } from './format.ts';
import { rulebook } from '../protocol/rulebook.ts';
import { RESPONSE_JSON_SCHEMA } from '../protocol/schema.ts';
import { userPrompt } from '../protocol/prompt.ts';
import type { MatchListing } from './useRecordings.ts';
import { TacticalPlan } from './TacticalPlan.tsx';

export type InspectorTab = 'decisions' | 'observations' | 'prompt' | 'match';
function formatTarget(target: Vec2): string {
  return `(${target.x.toFixed(1)}, ${target.y.toFixed(1)})`;
}
function describeOrder(order: Order): string {
  switch (order.type) {
    case 'hold':
      return 'Hold position';
    case 'guard':
      return `Guard ${formatTarget(order.target)}`;
    case 'tackle':
      return `Tackle ${formatPlayerId(order.targetId)}`;
    case 'restart_taker':
      return 'Take this restart';
    case 'move':
      return `Move to ${formatTarget(order.target)} · ${Math.round(order.pace * 100)}% pace`;
    case 'shoot':
    case 'kick':
      return `${order.type === 'shoot' ? 'Shoot' : 'Kick'} → ${formatTarget(order.target)} · ${order.speed.toFixed(1)} m/s`;
  }
}
export function describeEvent(event: MatchEvent): string {
  const player = event.playerId ? formatPlayerId(event.playerId) : 'Referee';
  switch (event.type) {
    case 'kick':
      return `${player} plays the ball`;
    case 'shot':
      return `${player} shoots`;
    case 'goal':
      return `${event.team === 'coral' ? 'Coral' : 'Cyan'} score!`;
    case 'save':
      return `${player} makes the save`;
    case 'tackle':
      return `${player} wins the ball`;
    case 'interception':
      return `${player} intercepts the pass`;
    case 'receive':
      return `${player} takes a touch`;
    default:
      return `${player} · ${event.detail}`;
  }
}
export function EventStrip({ recording, frame }: { recording: Recording; frame: Frame }) {
  const event = recording.events.findLast((candidate) => candidate.tick <= frame.tick);
  return (
    <div className="event-strip">
      <span className={`event-dot ${event?.team ?? ''}`} />
      <span>{event ? describeEvent(event) : 'The teams are ready.'}</span>
      <span className="recording-label">
        {recording.kind === 'llm'
          ? recording.generation?.status === 'complete'
            ? 'MODEL-CONTROLLED'
            : 'LLM EXCERPT · INCOMPLETE'
          : 'SCRIPTED FIXTURE'}
      </span>
    </div>
  );
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
    () => (observation ? JSON.stringify(JSON.parse(observation), null, 2) : ''),
    [observation],
  );
  const requests =
    recording.generation?.requests.filter(
      (receipt) => receipt.decisionId === decisionId && receipt.team === team,
    ) ?? [];
  return (
    <aside
      className="inspector-panel"
      aria-label="Match inspector"
      id="decision-inspector"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <header className="inspector-header">
        <div>
          <p className="eyebrow">BEHIND THE MATCH</p>
          <h2>Every decision, visible.</h2>
        </div>
        <button className="close-button" onClick={onClose} aria-label="Close inspector" autoFocus>
          ×
        </button>
      </header>
      <nav className="inspector-tabs" aria-label="Inspector sections">
        {(['decisions', 'observations', 'prompt', 'match'] as const).map((section) => (
          <button key={section} aria-pressed={tab === section} onClick={() => onTab(section)}>
            {section === 'prompt' ? 'Rules / prompt' : section[0]!.toUpperCase() + section.slice(1)}
          </button>
        ))}
      </nav>
      <div className="inspector-body">
        {tab !== 'match' && (
          <p className="stream-boundary">
            <span className="status-dot" /> FOLLOWING PLAYBACK{' '}
            <span>
              {formatTime(frame.playingTicks / TICK_RATE)} · #{decisionId ?? 0}
            </span>
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
              One {recording.kind === 'llm' ? 'AI model' : 'scripted controller'} chooses orders for
              each team. Select an order to find its player and target on the pitch.
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
                      <p>{recording.teams[side].controller}</p>
                    </div>
                    <span className="order-count">{batch?.orders.length ?? 0} orders</span>
                  </header>
                  {note?.intent && <p className="tactical-note">{note.intent}</p>}
                  {note?.memory ? <TacticalPlan memory={note.memory} /> : null}
                  {decision?.fallback.includes(side) && (
                    <p className="fallback-note">
                      No accepted reply. Existing orders continue until expiry.
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
                          <b>{order.playerId}</b>
                          <span>{describeOrder(order)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {!batch?.orders.length && (
                    <p className="empty-note">No new orders at this boundary.</p>
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
              The exact input sent at this boundary, updated as the replay moves. Opponent pending
              orders and private memory were never shared.
            </p>
            {observation ? (
              <pre className="json-view" aria-label={`${team} observation`}>
                {formattedObservation}
              </pre>
            ) : (
              <p className="empty-note">
                This scripted fixture has no model requests. Choose a generated match to inspect the
                observation stream.
              </p>
            )}
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
          </>
        )}
        {tab === 'prompt' && (
          <>
            <p className="panel-explanation">
              {recording.generation
                ? 'Both models received this same system prompt. Their team observation was the user message; a repair attempt also included the feedback shown under Observations.'
                : 'Current engine rules for this scripted fixture. No AI was prompted for this recording.'}
            </p>
            <pre className="rulebook-view">{recording.generation?.rulebook ?? rulebook()}</pre>
            <details className="request-detail">
              <summary>Response JSON schema · identities fixed per request</summary>
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
          </>
        )}
        {tab === 'match' && (
          <>
            <p className="eyebrow">NORTH GARDEN STADIUM</p>
            <h3>{recording.title}</h3>
            <p className="panel-explanation">{recording.description}</p>
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
            <button className="panel-action" onClick={onDownload}>
              Download match record ↗
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
                <option value="full">Full scripted match</option>
                <option value="passing">First exchange · 24 seconds</option>
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
