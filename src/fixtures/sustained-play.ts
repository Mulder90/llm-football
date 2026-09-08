import type { TeamController } from '../generation/providers.ts';
import type { observe } from '../protocol/observation.ts';
import type { TacticalMemory } from '../protocol/schema.ts';
import { footPosition } from '../sim/ball-control.ts';
import { createMatch } from '../sim/state.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { MatchState, Order, Team, Vec2 } from '../sim/types.ts';

export const SEQUENCE_IDS = ['carry-pressure', 'receive-follow-up', 'keeper-outlet'] as const;
export type SequenceId = (typeof SEQUENCE_IDS)[number];
export type FootballSequence = {
  id: SequenceId;
  title: string;
  description: string;
  initial: MatchState;
  playingTicks: number;
};
type Observation = ReturnType<typeof observe>;

/** Fixed authored starting states. Repetitions reuse their seeds; no outcome is inserted. */
export function createFootballSequence(id: SequenceId): FootballSequence {
  const initial = createMatch(`sustained-${id}`);
  initial.seed = 34891;
  const positions: Record<Team, Vec2[]> = {
    coral: [
      { x: 8, y: 34 },
      { x: 25, y: 8 },
      { x: 23, y: 22 },
      { x: 24, y: 49 },
      { x: 27, y: 60 },
      { x: 47, y: 25 },
      { x: 35, y: 34 },
      { x: 48, y: 50 },
      { x: 67, y: 14 },
      { x: 70, y: 45 },
      { x: 64, y: 58 },
    ],
    cyan: [
      { x: 98, y: 34 },
      { x: 84, y: 10 },
      { x: 81, y: 25 },
      { x: 82, y: 43 },
      { x: 85, y: 58 },
      { x: 66, y: 8 },
      { x: 72, y: 30 },
      { x: 68, y: 55 },
      { x: 90, y: 16 },
      { x: 55, y: 40 },
      { x: 91, y: 56 },
    ],
  };
  for (const player of initial.players)
    player.position = { ...positions[player.team][player.number - 1]! };
  initial.ball.owner = 'coral-7';
  initial.ball.lastTouch = 'coral-7';
  initial.ball.position = footPosition(initial.players.find((player) => player.id === 'coral-7')!);
  if (id === 'keeper-outlet') {
    initial.players.find((player) => player.id === 'coral-3')!.position = { x: 20, y: 23 };
    initial.players.find((player) => player.id === 'cyan-10')!.position = { x: 24, y: 40 };
    initial.ball.owner = null;
    initial.ball.lastTouch = 'cyan-10';
    initial.ball.position = { x: 17, y: 34, z: 1.6 };
    initial.ball.velocity = { x: -14, y: 0, z: 0.8 };
  }
  const descriptions = {
    'carry-pressure': [
      'Carry before pressure',
      'A carrier has room to advance before a defender begins pressing. Measure carrying across decisions and any later loss of control.',
    ],
    'receive-follow-up': [
      'Receive and choose again',
      'A moving outlet must meet a pass and act after reception while both sides can replan.',
    ],
    'keeper-outlet': [
      'Collect and find an outlet',
      'An incoming ball approaches the keeper. Outlets can move and opponents can press during collection and distribution.',
    ],
  } as const;
  return {
    id,
    title: descriptions[id][0],
    description: descriptions[id][1],
    initial,
    playingTicks: 8 * TICK_RATE,
  };
}

/** These tactics exist only in the offline controller, never in movement or the match runner. */
function scriptedOrders(id: SequenceId, observation: Observation): Order[] {
  const { team, tick } = observation.responseIdentity;
  const owned = observation.players.filter((player) => player.team === team && !player.dismissed);
  const orders = new Map<string, Order>(
    owned.map((player) => [player.id, { type: 'hold', playerId: player.id }]),
  );
  const give = (order: Order) => orders.set(order.playerId, order);
  const move = (playerId: string, target: Vec2, pace: number) =>
    give({ type: 'move', playerId, target: { x: target.x, y: target.y }, pace });
  if (observation.phase.type === 'restart_setup') return [...orders.values()];
  if (observation.phase.type === 'restart_ready') {
    const taker = owned.find((player) => player.actionContext?.canKickNow);
    if (taker)
      give({
        type: 'kick',
        playerId: taker.id,
        target: {
          x: Math.max(
            1,
            Math.min(104, observation.ball.position.x + observation.attackDirection * 12),
          ),
          y: 34,
        },
        speed: 10,
        loft: 0,
      });
    return [...orders.values()];
  }
  const keeper = owned.find((player) => player.role === 'keeper');
  if (keeper) give({ type: 'guard', playerId: keeper.id, target: keeper.position });
  const carrier = owned.find((player) => player.id === observation.ball.owner);
  if (team === 'cyan') {
    const presser = owned.find((player) => player.id === 'cyan-10')!;
    if (carrier) move(carrier.id, { x: Math.max(5, carrier.position.x - 15), y: 42 }, 0.6);
    else if (tick >= 3 * TICK_RATE) {
      const targetId = presser.actionContext?.reachableTackleTargetId;
      if (targetId) give({ type: 'tackle', playerId: presser.id, targetId });
      else move(presser.id, observation.ball.position, 0.55);
    }
    return [...orders.values()];
  }
  if (id === 'carry-pressure') {
    if (carrier) move(carrier.id, { x: 60, y: 34 }, 0.65);
    move('coral-6', { x: 58, y: 20 }, 0.5);
  } else if (id === 'receive-follow-up') {
    if (carrier?.id === 'coral-7')
      give({ type: 'kick', playerId: carrier.id, target: { x: 47, y: 30 }, speed: 10, loft: 0 });
    move('coral-6', carrier?.id === 'coral-6' ? { x: 60, y: 22 } : { x: 47, y: 30 }, 0.85);
    if (carrier?.id !== 'coral-7') move('coral-7', { x: 43, y: 40 }, 0.45);
  } else {
    move('coral-3', carrier?.id === 'coral-3' ? { x: 36, y: 20 } : { x: 23, y: 23 }, 0.6);
    if (keeper?.actionContext?.canDistributeNow && tick >= 2 * TICK_RATE)
      give({
        type: 'distribute',
        playerId: keeper.id,
        delivery: 'throw',
        target: { x: 23, y: 23 },
        speed: 14,
        loft: 2.5,
      });
    else if (keeper?.actionContext?.canPickUpNow) give({ type: 'pickup', playerId: keeper.id });
  }
  return [...orders.values()];
}

export function scriptedSequenceControllers(id: SequenceId): Record<Team, TeamController> {
  const controller = (team: Team): TeamController => ({
    config: {
      provider: 'scripted',
      model: `scripted-${id}-${team}`,
      settings: {},
      inputUsdPerMillion: 0,
      outputUsdPerMillion: 0,
    },
    async request(request, signal) {
      signal.throwIfAborted();
      const observation = JSON.parse(request.observation) as Observation;
      if (observation.responseIdentity.team !== team)
        throw new Error('Wrong scripted controller team');
      const orders = scriptedOrders(id, observation);
      const passer = orders.find((order) => order.type === 'kick' || order.type === 'distribute');
      const receiverId = id === 'keeper-outlet' ? 'coral-3' : 'coral-6';
      const passing =
        team === 'coral' && observation.phase.type === 'open_play' && passer && 'target' in passer;
      const memory: TacticalMemory = {
        plan: `Scripted ${id}: ${team} boundary ${observation.responseIdentity.decisionId}`,
        ballPlayerId: passing
          ? passer.playerId
          : observation.teamContext.possession === 'ours'
            ? observation.ball.owner
            : `${team}-10`,
        pass: passing ? { receiverId, target: passer.target } : null,
        assignments: [],
        threats: [],
        review: observation.privateMemory
          ? `Previous scripted plan: ${observation.privateMemory.plan}`.slice(0, 120)
          : '',
      };
      return {
        text: JSON.stringify({
          batch: { ...observation.responseIdentity, orders },
          memory,
          intent: 'Scripted controller: explicit practice orders, not an LLM response.',
        }),
        usage: null,
        responseId: null,
        resolvedModel: null,
      };
    },
  });
  return { coral: controller('coral'), cyan: controller('cyan') };
}
