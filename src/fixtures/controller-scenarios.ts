import type { TacticalMemory } from '../protocol/schema.ts';
import { capture, SAMPLE_INTERVAL_TICKS, stateHash } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import { footPosition } from '../sim/ball.ts';
import { distanceBetween } from '../sim/math.ts';
import { applyDecision, emptyBatch } from '../sim/orders.ts';
import { BALL_CONTROL, TICK_RATE } from '../sim/rules.ts';
import { attackDirection, cloneState } from '../sim/state.ts';
import { createMatch } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import type { Batch, MatchState, Order, Team, Vec2 } from '../sim/types.ts';

export type ControllerScenario = {
  id:
    | 'carry-space'
    | 'pass-pressure'
    | 'blocked-lane'
    | 'keeper-distribution'
    | 'shooting-chance'
    | 'narrow-angle'
    | `recorded-${Team}-${number}`;
  title: string;
  description: string;
  team: Team;
  state: MatchState;
  memory: TacticalMemory | null;
  previousDecisionTick: number;
  opponentOrders: Order[];
  evaluationTicks: number;
};

const EVALUATION_TICKS = 2 * TICK_RATE;

function place(state: MatchState, playerId: string, position: Vec2): void {
  state.players.find((player) => player.id === playerId)!.position = { ...position };
}

function giveBall(state: MatchState, playerId: string): void {
  const carrier = state.players.find((player) => player.id === playerId)!;
  state.ball.owner = playerId;
  state.ball.lastTouch = playerId;
  state.ball.position = footPosition(carrier);
}

/** Explicit opponents stay at their snapshot positions unless a scenario names another order. */
function opponentOrders(state: MatchState, overrides: Order[] = []): Order[] {
  return state.players
    .filter((player) => player.team === 'cyan')
    .map(
      (player) =>
        overrides.find((order) => order.playerId === player.id) ?? {
          type: 'hold',
          playerId: player.id,
        },
    );
}

function scenario(
  id: ControllerScenario['id'],
  title: string,
  description: string,
  positions: Record<string, Vec2>,
  carrierId: string,
  opposition: Order[] = [],
): ControllerScenario {
  const state = createMatch(`controller-${id}`);
  for (const [playerId, position] of Object.entries(positions)) place(state, playerId, position);
  giveBall(state, carrierId);
  return {
    id,
    title,
    description,
    team: 'coral',
    state,
    memory: null,
    previousDecisionTick: 0,
    opponentOrders: opponentOrders(state, opposition),
    evaluationTicks: EVALUATION_TICKS,
  };
}

function keeperDistribution(): ControllerScenario {
  const result = scenario(
    'keeper-distribution',
    'Keeper distribution after two intercepted outlets',
    'A scripted lead-in actually repeats the central outlet twice. Cyan #10 intercepts and returns both balls; Coral #1 catches them. Wide outlets remain available. Holding, carrying or changing delivery are all measurable choices.',
    {
      'coral-1': { x: 8, y: 34 },
      'coral-7': { x: 30, y: 34 },
      'cyan-10': { x: 19, y: 34 },
    },
    'coral-1',
  );
  const state = result.state;
  // Fixed, explicit setup orders create real interception/save evidence. No outcomes are inserted.
  for (let boundary = 0; boundary < 4; boundary++) {
    const returning = boundary % 2 === 1;
    applyDecision(
      state,
      {
        ...emptyBatch(state, 'coral'),
        orders: returning
          ? [{ type: 'guard', playerId: 'coral-1', target: { x: 8, y: 34 } }]
          : [
              state.ball.handControl
                ? {
                    type: 'distribute',
                    delivery: 'roll',
                    playerId: 'coral-1',
                    target: { x: 30, y: 34 },
                    speed: 12,
                    loft: 0,
                  }
                : {
                    type: 'kick',
                    playerId: 'coral-1',
                    target: { x: 30, y: 34 },
                    speed: 12,
                    loft: 0,
                  },
            ],
      },
      {
        ...emptyBatch(state, 'cyan'),
        orders: returning
          ? [{ type: 'kick', playerId: 'cyan-10', target: { x: 8, y: 34 }, speed: 12, loft: 0 }]
          : [],
      },
    );
    for (let tick = 0; tick < TICK_RATE; tick++) step(state);
  }
  result.previousDecisionTick = state.tick - TICK_RATE;
  result.memory = {
    plan: 'Distribute from Coral #1 toward Coral #7 centrally; keep wide outlets and defensive cover.',
    ballPlayerId: 'coral-1',
    pass: { receiverId: 'coral-7', target: { x: 30, y: 34 } },
    assignments: state.players
      .filter((player) => player.team === 'coral' && player.role === 'outfield')
      .map((player) => ({ playerId: player.id, role: 'support', opponentId: null })),
    threats: [{ opponentId: 'cyan-10', concern: 'Intercepted the central outlet twice.' }],
    review:
      'Cyan #10 intercepted both central passes. Coral #1 caught the returns; the planned outlet has not worked.',
  };
  return result;
}

/** Fresh deterministic snapshots for comparisons, never claimed to be naturally model-played. */
export function createControllerScenarios(): ControllerScenario[] {
  return [
    scenario(
      'carry-space',
      'Space in front of the carrier',
      'Coral #7 has open grass ahead with teammates offering wider routes. Cyan #10 moves to a fixed deeper position. Measure progress and retained control without requiring a particular action.',
      {
        'coral-7': { x: 35, y: 34 },
        'coral-10': { x: 52, y: 45 },
        'cyan-10': { x: 65, y: 34 },
      },
      'coral-7',
      [{ type: 'move', playerId: 'cyan-10', target: { x: 58, y: 34 }, pace: 0.5 }],
    ),
    scenario(
      'pass-pressure',
      'A reachable challenge and an open outlet',
      'Cyan #10 attempts an immediate legal tackle on Coral #7. Coral #6 is available diagonally. The engine commits a legal kick before the tackle; movement alone does not evade an already reachable challenge.',
      {
        'coral-7': { x: 45, y: 34 },
        'coral-6': { x: 50, y: 19 },
        'coral-10': { x: 59, y: 43 },
        'cyan-10': { x: 46.65, y: 34 },
      },
      'coral-7',
      [{ type: 'tackle', playerId: 'cyan-10', targetId: 'coral-7' }],
    ),
    scenario(
      'blocked-lane',
      'A screened central lane and a wide alternative',
      'Cyan #10 occupies the ground lane between Coral #7 and #9. A timed chip can clear that lane; a ground pass to the wider #6 is also viable. The metrics report the actual route and reception, not a preferred pass type.',
      {
        'coral-7': { x: 45, y: 34 },
        'coral-9': { x: 65, y: 34 },
        'coral-6': { x: 53, y: 18 },
        'coral-10': { x: 50, y: 47 },
        'cyan-10': { x: 55, y: 34 },
      },
      'coral-7',
    ),
    scenario(
      'narrow-angle',
      'A narrow angle near the goal line',
      'Coral #10 owns the ball outside the posts near the opponent goal line. A central teammate is available. Measure whether the carrier cuts back, passes or continues narrowing the angle; no result or preferred receiver is inserted.',
      {
        'coral-10': { x: 102, y: 18 },
        'coral-6': { x: 92, y: 34 },
        'cyan-1': { x: 103, y: 34 },
        'cyan-2': { x: 82, y: 12 },
        'cyan-3': { x: 84, y: 26 },
        'cyan-4': { x: 84, y: 44 },
        'cyan-5': { x: 82, y: 56 },
      },
      'coral-10',
      [{ type: 'guard', playerId: 'cyan-1', target: { x: 103, y: 34 } }],
    ),
    keeperDistribution(),
    scenario(
      'shooting-chance',
      'An open shooting angle',
      'Coral #10 controls the ball near goal; the keeper is displaced toward the upper post. Compare a shot through the open side with carrying or passing. The engine decides whether it scores.',
      {
        'coral-10': { x: 94, y: 36 },
        'cyan-1': { x: 102, y: 31 },
        'cyan-2': { x: 82, y: 12 },
        'cyan-3': { x: 84, y: 26 },
        'cyan-4': { x: 84, y: 44 },
        'cyan-5': { x: 82, y: 56 },
      },
      'coral-10',
      [{ type: 'guard', playerId: 'cyan-1', target: { x: 102, y: 31 } }],
    ),
  ];
}

/** Replay to a real possession boundary, then hold the recorded opposition to that one batch. */
export function recordedPossessionScenario(
  recording: Recording,
  decisionIndex: number,
  team: Team,
): ControllerScenario {
  const boundary = recording.decisions[decisionIndex];
  if (!boundary) throw new Error('No recorded decision at that index');
  const state = cloneState(recording.initial);
  let nextDecision = 0;
  while (state.tick < boundary.tick) {
    const decision = recording.decisions[nextDecision];
    if (decision?.tick === state.tick) {
      applyDecision(state, ...decision.batches);
      nextDecision++;
    }
    const tick = state.tick;
    step(state);
    if (state.tick === tick) throw new Error('Recorded boundary follows a stopped simulation');
  }
  const carrier = state.players.find((player) => player.id === state.ball.owner);
  if (state.phase.type !== 'open_play' || carrier?.team !== team || carrier.role !== 'outfield')
    throw new Error('Choose an open-play outfield possession for the controlled team');
  const previous = recording.decisions[decisionIndex - 1];
  return {
    id: `recorded-${team}-${boundary.tick}`,
    title: `${team} possession at recorded tick ${boundary.tick}`,
    description: `Exact state and prior memory from ${recording.initial.matchId}. Opposition executes its recorded orders at this boundary, with no later replanning. This is a counterfactual diagnostic, not a continuation of the match.`,
    team,
    state,
    memory: structuredClone(previous?.notes?.[team].memory ?? null),
    previousDecisionTick: previous?.tick ?? 0,
    opponentOrders: structuredClone(boundary.batches.find((batch) => batch.team !== team)!.orders),
    evaluationTicks: EVALUATION_TICKS,
  };
}

function minimumOwnSpacing(state: MatchState, team: Team): number {
  const teammates = state.players.filter((player) => player.team === team && !player.dismissed);
  let minimum = Infinity;
  for (let first = 0; first < teammates.length; first++)
    for (let second = first + 1; second < teammates.length; second++)
      minimum = Math.min(
        minimum,
        distanceBetween(teammates[first]!.position, teammates[second]!.position),
      );
  return minimum;
}

/** One model batch plus fixed opposition. No re-planning or tactical movement is added. */
export function evaluateControllerScenario(scenario: ControllerScenario, acceptedBatch: Batch) {
  const state = cloneState(scenario.state);
  const initial = scenario.state;
  const carrier = initial.players.find((player) => player.id === initial.ball.owner)!;
  const carrierOrder = acceptedBatch.orders.find((order) => order.playerId === carrier.id);
  const direction = attackDirection(initial, scenario.team);
  const initialEventCount = state.events.length;
  const opponent: Team = scenario.team === 'coral' ? 'cyan' : 'coral';
  const opposition = {
    ...emptyBatch(state, opponent),
    orders: scenario.opponentOrders,
  };
  const batches = applyDecision(
    state,
    scenario.team === 'coral' ? acceptedBatch : opposition,
    scenario.team === 'cyan' ? acceptedBatch : opposition,
  );
  const frames = [capture(state)];
  const controlTicks = { coral: 0, cyan: 0, loose: 0 };
  let lastControlTeam: Team = scenario.team;
  let turnovers = 0;
  let carrierControlledDistance = 0;
  let maximumControlledForwardMetres = 0;
  let peakBallHeightMetres = state.ball.position.z;
  let airborneTicks = 0;
  const initialSpacing = minimumOwnSpacing(state, scenario.team);
  let minimumSpacing = initialSpacing;
  while (state.tick - initial.tick < scenario.evaluationTicks && state.phase.type === 'open_play') {
    const previousOwner = state.ball.owner;
    const previousPosition = {
      ...state.players.find((player) => player.id === carrier.id)!.position,
    };
    const previousEventCount = state.events.length;
    step(state);
    const owner = state.players.find((player) => player.id === state.ball.owner);
    controlTicks[owner?.team ?? 'loose']++;
    if (owner) {
      if (lastControlTeam === scenario.team && owner.team !== scenario.team) turnovers++;
      lastControlTeam = owner.team;
    }
    if (state.phase.type === 'open_play') {
      if (previousOwner === carrier.id && state.ball.owner === carrier.id)
        carrierControlledDistance += distanceBetween(previousPosition, owner!.position);
      if (owner?.team === scenario.team)
        maximumControlledForwardMetres = Math.max(
          maximumControlledForwardMetres,
          (state.ball.position.x - initial.ball.position.x) * direction,
        );
    }
    peakBallHeightMetres = Math.max(peakBallHeightMetres, state.ball.position.z);
    if (state.ball.position.z > BALL_CONTROL.maximumFootControlHeight) airborneTicks++;
    minimumSpacing = Math.min(minimumSpacing, minimumOwnSpacing(state, scenario.team));
    if (state.tick % SAMPLE_INTERVAL_TICKS === 0 || state.events.length !== previousEventCount)
      frames.push(capture(state));
  }
  if (frames.at(-1)!.tick !== state.tick) frames.push(capture(state));
  const events = state.events.slice(initialEventCount);
  const receptions = events.filter((event) =>
    ['receive', 'interception', 'save', 'tackle'].includes(event.type),
  );
  const finalOwner = state.players.find((player) => player.id === state.ball.owner);
  const finalCarrier = state.players.find((player) => player.id === carrier.id)!;
  return {
    batches,
    frames,
    events,
    finalState: state,
    finalHash: stateHash(state),
    metrics: {
      carrierId: carrier.id,
      carrierAction: carrierOrder?.type ?? 'omitted',
      requestedLoft:
        carrierOrder?.type === 'kick' || carrierOrder?.type === 'shoot'
          ? (carrierOrder.loft ?? 0)
          : null,
      orderedPlayers: acceptedBatch.orders.length,
      simulatedSeconds: (state.tick - initial.tick) / TICK_RATE,
      carrierDistanceMetres: finalCarrier.distance - carrier.distance,
      carrierControlledDistanceMetres: carrierControlledDistance,
      maximumControlledForwardMetres,
      controlSeconds: {
        own: controlTicks[scenario.team] / TICK_RATE,
        opponent: controlTicks[opponent] / TICK_RATE,
        loose: controlTicks.loose / TICK_RATE,
      },
      finalOwnerId: finalOwner?.id ?? null,
      finalPossession: finalOwner
        ? finalOwner.team === scenario.team
          ? 'ours'
          : 'theirs'
        : 'loose',
      passReceivers: receptions
        .filter(
          (event) =>
            event.type === 'receive' &&
            event.team === scenario.team &&
            event.playerId !== carrier.id,
        )
        .map((event) => event.playerId!),
      turnovers,
      peakBallHeightMetres,
      airborneSeconds: airborneTicks / TICK_RATE,
      blocks: events.filter((event) => event.type === 'block').length,
      ownOrderFailures: events.filter(
        (event) => event.type === 'order_failed' && event.playerId?.startsWith(`${scenario.team}-`),
      ).length,
      goalsFor: state.score[scenario.team] - initial.score[scenario.team],
      goalsAgainst: state.score[opponent] - initial.score[opponent],
      finalPhase: state.phase.type,
      spacingMetres: {
        initial: initialSpacing,
        minimum: minimumSpacing,
        final: minimumOwnSpacing(state, scenario.team),
      },
    },
  };
}

export type ControllerScenarioResult = ReturnType<typeof evaluateControllerScenario>;
