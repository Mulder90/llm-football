import type { FootballSequence } from '../fixtures/sustained-play.ts';
import type { Recording } from '../recording/record.ts';
import { stateHash } from '../recording/record.ts';
import { parseRecording } from '../recording/validate.ts';
import type { GenerationProvenance } from '../recording/provenance.ts';
import { applyDecision } from '../sim/orders.ts';
import { attackDirection, cloneState } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import { distanceBetween } from '../sim/math.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { MatchEvent, Order, Team } from '../sim/types.ts';
import { generationProviderUsd } from './budget.ts';
import type { TeamController } from './providers.ts';
import { DEFAULT_LIMITS, runMatchFromState } from './run.ts';

export const SEQUENCE_LIMITS: GenerationProvenance['limits'] = {
  ...DEFAULT_LIMITS,
  maximumDecisions: 32,
  maximumRequests: 128,
  maximumEstimatedUsd: 0,
  maximumEstimatedUsdByProvider: { openai: 0, gemini: 0 },
  maximumWallSeconds: 30,
};
type CompletedPass = {
  from: string;
  to: string;
  releaseTick: number;
  receiveTick: number;
  delivery: 'kick' | 'roll' | 'throw' | 'punt';
  nextDecisionTick: number | null;
  nextOrder: Order['type'] | 'omitted' | null;
  controlledCarryAfterMetres: number;
  controlEndedTick: number | null;
};

/** Measure canonical intervals by replaying actions, never inferred motion between viewer samples. */
export function measureSequence(recording: Recording) {
  const state = cloneState(recording.initial);
  const controlTicks = { coral: 0, cyan: 0, loose: 0 };
  const footCarryMetres = { coral: 0, cyan: 0 };
  const handCarryMetres = { coral: 0, cyan: 0 };
  const carryDecisionBoundaries = { coral: 0, cyan: 0 };
  const maximumControlledForwardMetres = { coral: 0, cyan: 0 };
  const turnovers = { coral: 0, cyan: 0 };
  const supportSpacing = {
    coral: { minimumMetres: null as number | null, crowdedPlayingTicks: 0 },
    cyan: { minimumMetres: null as number | null, crowdedPlayingTicks: 0 },
  };
  const passes: CompletedPass[] = [];
  let pendingPass: MatchEvent | null = null;
  let lastControlledTeam =
    state.players.find((player) => player.id === state.ball.owner)?.team ?? null;
  let nextDecision = 0;
  while (state.tick < recording.durationTicks) {
    const decision = recording.decisions[nextDecision];
    if (decision?.tick === state.tick) {
      const carrier = state.players.find((player) => player.id === state.ball.owner);
      const ownOrder = decision.batches
        .flatMap((batch) => batch.orders)
        .find((order) => order.playerId === carrier?.id);
      if (carrier && ownOrder?.type === 'move' && state.phase.type === 'open_play')
        carryDecisionBoundaries[carrier.team]++;
      const followingPass = passes.at(-1);
      if (
        followingPass &&
        followingPass.controlEndedTick === null &&
        carrier?.id === followingPass.to &&
        followingPass.nextDecisionTick === null
      ) {
        followingPass.nextDecisionTick = state.tick;
        followingPass.nextOrder = ownOrder?.type ?? 'omitted';
      }
      applyDecision(state, ...decision.batches);
      nextDecision++;
    }
    const beforeTick = state.tick;
    const beforePlaying = state.playingTicks;
    const beforePhase = state.phase.type;
    const beforeOwner = state.ball.owner;
    const beforeHands = Boolean(state.ball.handControl);
    const beforeCarrier = state.players.find((player) => player.id === beforeOwner);
    const beforePosition = beforeCarrier ? { ...beforeCarrier.position } : null;
    const eventCount = state.events.length;
    step(state);
    if (state.tick === beforeTick) throw new Error('Sequence advanced beyond stopped simulation');
    for (const event of state.events.slice(eventCount)) {
      if (
        event.type === 'kick' ||
        (event.type === 'keeper_release' && event.delivery !== 'put_down')
      )
        pendingPass = event;
      else if (event.type === 'receive') {
        const passer = state.players.find((player) => player.id === pendingPass?.playerId);
        if (
          pendingPass &&
          passer &&
          event.playerId &&
          passer.id !== event.playerId &&
          passer.team === event.team
        ) {
          passes.push({
            from: passer.id,
            to: event.playerId,
            releaseTick: pendingPass.tick,
            receiveTick: event.tick,
            delivery:
              pendingPass.type === 'kick'
                ? 'kick'
                : (pendingPass.delivery as 'roll' | 'throw' | 'punt'),
            nextDecisionTick: null,
            nextOrder: null,
            controlledCarryAfterMetres: 0,
            controlEndedTick: null,
          });
        }
        pendingPass = null;
      } else if (
        [
          'shot',
          'interception',
          'save',
          'block',
          'tackle',
          'keeper_pickup',
          'keeper_release',
          'restart_awarded',
          'halftime',
          'full_time',
          'abandoned',
        ].includes(event.type)
      )
        pendingPass = null;
    }
    const carrier = state.players.find((player) => player.id === state.ball.owner);
    const followingPass = passes.at(-1);
    if (
      followingPass &&
      followingPass.controlEndedTick === null &&
      state.ball.owner !== followingPass.to
    )
      followingPass.controlEndedTick = state.tick;
    if (state.playingTicks === beforePlaying) continue;
    controlTicks[carrier?.team ?? 'loose']++;
    if (beforePhase === 'open_play' && state.phase.type === 'open_play') {
      if (carrier) {
        maximumControlledForwardMetres[carrier.team] = Math.max(
          maximumControlledForwardMetres[carrier.team],
          (state.ball.position.x - recording.initial.ball.position.x) *
            attackDirection(state, carrier.team),
        );
        if (lastControlledTeam && carrier.team !== lastControlledTeam)
          turnovers[lastControlledTeam]++;
        lastControlledTeam = carrier.team;
      }
      if (
        carrier &&
        carrier.id === beforeOwner &&
        beforePosition &&
        beforeHands === Boolean(state.ball.handControl)
      ) {
        const distance = distanceBetween(beforePosition, carrier.position);
        (beforeHands ? handCarryMetres : footCarryMetres)[carrier.team] += distance;
        if (followingPass?.controlEndedTick === null)
          followingPass.controlledCarryAfterMetres += distance;
      }
      for (const team of ['coral', 'cyan'] as const) {
        const support = state.players.filter(
          (player) =>
            player.team === team &&
            player.role === 'outfield' &&
            !player.dismissed &&
            player.id !== state.ball.owner,
        );
        let minimum = Infinity;
        for (let first = 0; first < support.length; first++)
          for (let second = first + 1; second < support.length; second++)
            minimum = Math.min(
              minimum,
              distanceBetween(support[first]!.position, support[second]!.position),
            );
        const spacing = supportSpacing[team];
        if (Number.isFinite(minimum))
          spacing.minimumMetres = Math.min(spacing.minimumMetres ?? Infinity, minimum);
        if (minimum < 2) spacing.crowdedPlayingTicks++;
      }
    } else lastControlledTeam = null; // Restart placement is not a controlled turnover or carry.
  }
  if (nextDecision !== recording.decisions.length || stateHash(state) !== recording.finalHash)
    throw new Error('Sequence metrics replay diverged');
  const events = state.events.slice(recording.initial.events.length);
  const count = (type: MatchEvent['type']) => events.filter((event) => event.type === type).length;
  return {
    playingSeconds: (state.playingTicks - recording.initial.playingTicks) / TICK_RATE,
    simulationSeconds: (state.tick - recording.initial.tick) / TICK_RATE,
    controlTicks,
    footCarryMetres,
    handCarryMetres,
    carryDecisionBoundaries,
    maximumControlledForwardMetres,
    turnovers,
    completedPasses: passes,
    supportSpacing,
    keeper: {
      catches: count('save'),
      pickups: count('keeper_pickup'),
      distributions: events.filter(
        (event) => event.type === 'keeper_release' && event.delivery !== 'put_down',
      ).length,
      violations: count('keeper_violation'),
    },
    orderFailures: events.filter((event) => event.type === 'order_failed'),
    finalOwner: state.ball.owner,
    finalPhase: state.phase.type,
    score: { ...state.score },
  };
}

/** A reached scenario horizon completes the evaluation, not a two-half match. */
export async function evaluateSequence(options: {
  scenario: FootballSequence;
  controllers: Record<Team, TeamController>;
  limits?: GenerationProvenance['limits'];
  signal?: AbortSignal;
  onCheckpoint?: (recording: Recording) => Promise<void>;
  onProgress?: Parameters<typeof runMatchFromState>[0]['onProgress'];
}) {
  const { scenario } = options;
  const scripted = options.controllers.coral.config.provider === 'scripted';
  const recording = await runMatchFromState({
    initialState: scenario.initial,
    title: `${scenario.title} · ${scripted ? 'scripted' : 'model'} evaluation`,
    description: `${scenario.description} Bounded ${scenario.playingTicks / TICK_RATE}-second diagnostic; ${scripted ? 'both controllers are scripted, no model calls' : 'both teams use model controllers'}.`,
    controllers: options.controllers,
    limits: { ...(options.limits ?? SEQUENCE_LIMITS), maximumPlayingTicks: scenario.playingTicks },
    ...(options.signal && { signal: options.signal }),
    ...(options.onCheckpoint && { onCheckpoint: options.onCheckpoint }),
    ...(options.onProgress && { onProgress: options.onProgress }),
  });
  parseRecording(recording);
  const metrics = measureSequence(recording);
  const generation = recording.generation!;
  const reachedHorizon = recording.frames.at(-1)!.playingTicks === scenario.playingTicks;
  const criteria = {
    'carry-pressure': {
      carriesAcrossDecisions:
        metrics.footCarryMetres.coral >= 8 &&
        metrics.maximumControlledForwardMetres.coral >= 8 &&
        metrics.carryDecisionBoundaries.coral >= 3,
    },
    'receive-follow-up': {
      receivesThenActs: metrics.completedPasses.some(
        (pass) =>
          pass.from === 'coral-7' &&
          pass.to === 'coral-6' &&
          pass.nextOrder === 'move' &&
          pass.controlledCarryAfterMetres >= 3,
      ),
    },
    'keeper-outlet': {
      catchesThenDistributes:
        metrics.keeper.catches >= 1 &&
        metrics.completedPasses.some((pass) => pass.from === 'coral-1') &&
        metrics.keeper.violations === 0,
    },
  }[scenario.id];
  return {
    scenarioId: scenario.id,
    status: reachedHorizon ? ('complete' as const) : ('incomplete' as const),
    stopReason: generation.stopReason,
    criteria: {
      reachedHorizon,
      noFallbacks: recording.decisions.every((decision) => decision.fallback.length === 0),
      noExecutionFailures: metrics.orderFailures.length === 0,
      ...criteria,
    },
    metrics,
    execution: {
      rounds: recording.decisions.length,
      requests: generation.requests.length,
      repairs: generation.requests.filter((receipt) => receipt.attempt > 0).length,
      fallbacks: recording.decisions.reduce(
        (count, decision) => count + decision.fallback.length,
        0,
      ),
      wallSeconds: generation.wallSeconds,
      requestLatencyMs: {
        mean: generation.requests.length
          ? generation.requests.reduce((total, receipt) => total + receipt.latencyMs, 0) /
            generation.requests.length
          : 0,
        maximum: Math.max(0, ...generation.requests.map((receipt) => receipt.latencyMs)),
      },
      estimatedUsd: generation.estimatedUsd,
      estimatedUsdByProvider: generationProviderUsd(generation),
    },
    recording,
  };
}
