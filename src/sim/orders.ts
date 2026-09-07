import { BALL_CONTROL, FIELD, ORDER_LIFETIME, PLAYERS_PER_TEAM } from './rules.ts';
import type { Batch, MatchState, Order, Team, Vec2 } from './types.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function containsOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPitchTarget(value: unknown): value is Vec2 {
  return (
    isObject(value) &&
    Object.keys(value).length === 2 &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    value.x >= 0 &&
    value.x <= FIELD.length &&
    value.y >= 0 &&
    value.y <= FIELD.width
  );
}

function parseOrder(raw: Record<string, unknown>, playerId: string): Order {
  switch (raw.type) {
    case 'restart_taker':
      if (containsOnlyKeys(raw, ['type', 'playerId'])) return { type: 'restart_taker', playerId };
      break;
    case 'guard':
      if (containsOnlyKeys(raw, ['type', 'playerId', 'target']) && isPitchTarget(raw.target))
        return { type: 'guard', playerId, target: { ...raw.target } };
      break;
    case 'tackle':
      if (
        containsOnlyKeys(raw, ['type', 'playerId', 'targetId']) &&
        typeof raw.targetId === 'string'
      )
        return { type: 'tackle', playerId, targetId: raw.targetId };
      break;
    case 'hold':
      if (containsOnlyKeys(raw, ['type', 'playerId'])) return { type: 'hold', playerId };
      break;
    case 'move':
      if (
        containsOnlyKeys(raw, ['type', 'playerId', 'target', 'pace']) &&
        isPitchTarget(raw.target) &&
        isFiniteNumber(raw.pace) &&
        raw.pace > 0 &&
        raw.pace <= 1
      ) {
        return { type: 'move', playerId, target: { ...raw.target }, pace: raw.pace };
      }
      break;
    case 'shoot':
    case 'kick':
      if (
        containsOnlyKeys(raw, ['type', 'playerId', 'target', 'speed', 'loft']) &&
        isPitchTarget(raw.target) &&
        isFiniteNumber(raw.speed) &&
        raw.speed >= BALL_CONTROL.minimumKickSpeed &&
        raw.speed <= BALL_CONTROL.maximumKickSpeed &&
        (raw.loft === undefined ||
          (isFiniteNumber(raw.loft) && raw.loft >= 0 && raw.loft <= BALL_CONTROL.maximumLoftSpeed))
      ) {
        return {
          type: raw.type,
          playerId,
          target: { ...raw.target },
          speed: raw.speed,
          ...(raw.loft === undefined ? {} : { loft: raw.loft as number }),
        };
      }
      break;
  }
  throw new Error('Invalid order parameters');
}

function validatePhaseOrder(order: Order, state: MatchState, team: Team): void {
  const phase = state.phase;
  if (phase.type === 'full_time' || phase.type === 'halftime')
    throw new Error('No orders during this phase');
  if (order.type === 'restart_taker') {
    if (phase.type !== 'restart_setup' || phase.restart.team !== team)
      throw new Error('Only the awarded team may choose its restart taker during setup');
    return;
  }
  if (phase.type === 'restart_setup' && !['move', 'hold', 'guard'].includes(order.type))
    throw new Error('Only positioning orders are legal during restart setup');
  if (
    phase.type === 'restart_ready' &&
    (order.type === 'kick' || order.type === 'shoot') &&
    order.playerId !== phase.restart.takerId
  )
    throw new Error('Only the selected taker may deliver the restart');
  if (phase.type === 'restart_ready' && order.type === 'tackle')
    throw new Error('Wait until the ball is in play to tackle');
}

export function validateBatch(raw: unknown, state: MatchState, team: Team): Batch {
  const batchFields = ['version', 'matchId', 'decisionId', 'team', 'tick', 'orders'];
  if (
    !isObject(raw) ||
    !containsOnlyKeys(raw, batchFields) ||
    raw.version !== 1 ||
    raw.matchId !== state.matchId ||
    raw.decisionId !== state.decisionId ||
    raw.tick !== state.tick ||
    raw.team !== team ||
    !Array.isArray(raw.orders) ||
    raw.orders.length > PLAYERS_PER_TEAM
  ) {
    throw new Error('Invalid, unsupported or stale team batch');
  }

  const orderedPlayers = new Set<string>();
  const orders = raw.orders.map((candidate: unknown): Order => {
    if (!isObject(candidate) || typeof candidate.playerId !== 'string') {
      throw new Error('Order requires an owned player');
    }
    const playerId = candidate.playerId;
    const ownsPlayer = state.players.some(
      (player) => player.id === playerId && player.team === team,
    );
    if (!ownsPlayer || orderedPlayers.has(playerId)) throw new Error('Duplicate or unowned player');
    orderedPlayers.add(playerId);
    const order = parseOrder(candidate, playerId);
    const player = state.players.find((player) => player.id === playerId)!;
    if (order.type === 'guard' && player.role !== 'keeper')
      throw new Error('Only keepers may guard');
    if (
      order.type === 'tackle' &&
      !state.players.some((target) => target.id === order.targetId && target.team !== team)
    )
      throw new Error('Tackle target must be an opponent');
    validatePhaseOrder(order, state, team);
    return order;
  });

  if (orders.filter((order) => order.type === 'restart_taker').length > 1)
    throw new Error('Choose one restart taker');
  return {
    version: 1,
    matchId: state.matchId,
    decisionId: state.decisionId,
    tick: state.tick,
    team,
    orders,
  };
}

export function emptyBatch(state: MatchState, team: Team): Batch {
  return {
    version: 1,
    matchId: state.matchId,
    decisionId: state.decisionId,
    team,
    tick: state.tick,
    orders: [],
  };
}

export function applyDecision(
  state: MatchState,
  coralPayload: unknown,
  cyanPayload: unknown,
): [Batch, Batch] {
  // Validate both against one boundary before applying either team's orders.
  const batches: [Batch, Batch] = [
    validateBatch(coralPayload, state, 'coral'),
    validateBatch(cyanPayload, state, 'cyan'),
  ];
  for (const batch of batches) {
    for (const order of batch.orders) {
      const player = state.players.find((player) => player.id === order.playerId)!;
      if (order.type === 'restart_taker' && state.phase.type === 'restart_setup') {
        state.phase = { ...state.phase, restart: { ...state.phase.restart, takerId: player.id } };
        continue;
      }
      const instantaneous =
        order.type === 'kick' || order.type === 'shoot' || order.type === 'tackle';
      const lifetime = instantaneous
        ? ORDER_LIFETIME.instantaneousTicks
        : ORDER_LIFETIME.persistentTicks;
      player.active = { order, issued: state.tick, expires: state.tick + lifetime };
    }
  }
  state.decisionId++;
  return batches;
}
