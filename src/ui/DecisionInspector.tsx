import type { Frame, Recording } from '../recording/record.ts';
import type { MatchEvent, Order, Vec2 } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { formatPlayerId } from './format.ts';

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
      return `Move to ${formatTarget(order.target)}`;
    case 'shoot':
    case 'kick':
      return `${order.type === 'shoot' ? 'Shoot' : 'Kick'} toward ${formatTarget(order.target)} · ${order.speed.toFixed(1)} m/s`;
  }
}

function describeEvent(event: MatchEvent): string {
  const player = event.playerId ? formatPlayerId(event.playerId) : 'Referee';
  switch (event.type) {
    case 'kick':
      return `${player} · plays the ball`;
    case 'shot':
      return `${player} · shoots`;
    case 'goal':
      return `${event.team} · GOAL`;
    case 'save':
      return `${player} · makes the save`;
    case 'tackle':
      return `${player} · wins the ball`;
    case 'interception':
      return `${player} · intercepts the pass`;
    case 'receive':
      return `${player} · takes a touch`;
    default:
      return `${player} · ${event.detail}`;
  }
}

export function EventStrip({ recording, frame }: { recording: Recording; frame: Frame }) {
  const latestEvent = recording.events.findLast((event) => event.tick <= frame.tick);
  const isCyan = latestEvent?.playerId?.startsWith('cyan');
  return (
    <div className="event-strip">
      <span className="event-label">ON THE PITCH</span>
      <span className={`event-dot ${isCyan ? 'cyan' : ''}`} />
      <span>
        {latestEvent ? describeEvent(latestEvent) : 'The teams are ready. Press play to begin.'}
      </span>
      <span className="engine-tag">{TICK_RATE} TICKS / SEC</span>
    </div>
  );
}

export function DecisionInspector({ recording, frame }: { recording: Recording; frame: Frame }) {
  const decision = recording.decisions.findLast((decision) => decision.tick <= frame.tick);
  const orders = decision?.batches.flatMap((batch) => batch.orders) ?? [];
  return (
    <div className="inspector" id="decision-inspector">
      <div>
        <p className="eyebrow">THE DECISION BEHIND THE MOMENT</p>
        <h3>Explicit instructions. Real outcomes.</h3>
        <p>
          This fixture uses scripted orders. The engine resolves each kick and contact. No model has
          been called.
        </p>
        <span className="mono">
          DECISION {decision?.batches[0].decisionId ?? 0} · TICK {Math.floor(frame.tick)}
        </span>
        <p className="verification">
          ENGINE {recording.engine} · RECORD {recording.finalHash}
        </p>
      </div>
      <div className="order-list">
        {orders.map((order) => (
          <div key={order.playerId}>
            <b className={order.playerId.startsWith('coral') ? 'coral-text' : 'cyan-text'}>
              {formatPlayerId(order.playerId)}
            </b>
            <span>{describeOrder(order)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
