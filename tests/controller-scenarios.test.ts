import { describe, expect, it } from 'vitest';
import {
  createControllerScenarios,
  evaluateControllerScenario,
  recordedPossessionScenario,
} from '../src/fixtures/controller-scenarios.ts';
import type { ControllerScenario } from '../src/fixtures/controller-scenarios.ts';
import { observe } from '../src/protocol/observation.ts';
import { tacticalMemorySchema, validateTacticalMemory } from '../src/protocol/schema.ts';
import { stateHash } from '../src/recording/record.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { BALL_CONTROL, TICK_RATE } from '../src/sim/rules.ts';
import { cloneState } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { Order } from '../src/sim/types.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';

const scenarios = createControllerScenarios();
const situation = (id: ControllerScenario['id']) =>
  scenarios.find((scenario) => scenario.id === id)!;
const evaluate = (scenario: ControllerScenario, orders: Order[]) =>
  evaluateControllerScenario(scenario, { ...emptyBatch(scenario.state, scenario.team), orders });

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

describe('controller comparison situations', () => {
  it('provides the same complete snapshots on every run and preserves them through independent replay', () => {
    expect(createControllerScenarios()).toEqual(scenarios);
    for (const scenario of freeze(scenarios)) {
      expect(scenario.state.phase.type).toBe('open_play');
      expect(scenario.state.players).toHaveLength(22);
      expect(
        scenario.state.players.filter((player) => player.team === 'coral' && !player.dismissed),
      ).toHaveLength(11);
      expect(
        scenario.state.players.filter((player) => player.team === 'cyan' && !player.dismissed),
      ).toHaveLength(11);
      const original = JSON.stringify(scenario);
      const batch = freeze(emptyBatch(scenario.state, 'coral'));
      const result = evaluateControllerScenario(scenario, batch);
      const replay = cloneState(scenario.state);
      applyDecision(replay, ...result.batches);
      while (replay.tick < result.finalState.tick) step(replay);
      expect(stateHash(replay)).toBe(result.finalHash);
      expect(evaluateControllerScenario(scenario, batch)).toEqual(result);
      expect(JSON.stringify(scenario)).toBe(original);
      expect(result.frames[0]!.tick).toBe(scenario.state.tick);
      expect(result.frames.at(-1)!.tick).toBe(result.finalState.tick);
      expect(result.metrics.simulatedSeconds).toBe(2);
      expect(
        Object.values(result.metrics.controlSeconds).reduce((sum, seconds) => sum + seconds, 0),
      ).toBeCloseTo(2);
      expect(result.metrics.spacingMetres.initial).toBeGreaterThan(7);
    }
  });

  it('distinguishes carrying into open space from simply keeping possession stationary', () => {
    const scenario = situation('carry-space');
    const carry = evaluate(scenario, [
      { type: 'move', playerId: 'coral-7', target: { x: 55, y: 34 }, pace: 1 },
    ]);
    const hold = evaluate(scenario, [{ type: 'hold', playerId: 'coral-7' }]);
    expect(carry.metrics.carrierControlledDistanceMetres).toBeGreaterThan(12);
    expect(carry.metrics.maximumControlledForwardMetres).toBeGreaterThan(12);
    for (const result of [carry, hold]) {
      expect(result.metrics.finalOwnerId).toBe('coral-7');
      expect(result.metrics.controlSeconds.own).toBe(2);
      expect(result.metrics.turnovers).toBe(0);
    }
    expect(hold.metrics.carrierControlledDistanceMetres).toBe(0);
    expect(hold.metrics.maximumControlledForwardMetres).toBe(0);
  });

  it('allows an immediate pass to escape pressure, while measuring a dispossessed run separately', () => {
    const scenario = situation('pass-pressure');
    const run = evaluate(scenario, [
      { type: 'move', playerId: 'coral-7', target: { x: 55, y: 34 }, pace: 1 },
    ]);
    const pass = evaluate(scenario, [
      { type: 'kick', playerId: 'coral-7', target: { x: 50, y: 19 }, speed: 15, loft: 0 },
    ]);
    expect(run.events).toContainEqual(
      expect.objectContaining({ type: 'tackle', playerId: 'cyan-10' }),
    );
    expect(run.metrics.turnovers).toBe(1);
    expect(run.metrics.carrierDistanceMetres).toBeGreaterThan(12);
    expect(run.metrics.carrierControlledDistanceMetres).toBe(0);
    expect(pass.metrics.finalOwnerId).toBe('coral-6');
    expect(pass.metrics.passReceivers).toEqual(['coral-6']);
    expect(pass.metrics.maximumControlledForwardMetres).toBeGreaterThan(4);
    expect(pass.metrics.turnovers).toBe(0);
    expect(pass.metrics.ownOrderFailures).toBe(0);
  });

  it('makes a chip useful through a screened lane without treating it as the only viable route', () => {
    const scenario = situation('blocked-lane');
    const centralPass: Order = {
      type: 'kick',
      playerId: 'coral-7',
      target: { x: 65, y: 34 },
      speed: 15,
      loft: 0,
    };
    const ground = evaluate(scenario, [centralPass]);
    const chip = evaluate(scenario, [{ ...centralPass, loft: 6 }]);
    const wide = evaluate(scenario, [{ ...centralPass, target: { x: 53, y: 18 } }]);
    expect(ground.metrics.finalPossession).toBe('theirs');
    expect(ground.metrics.turnovers).toBe(1);
    expect(chip.metrics.requestedLoft).toBe(6);
    expect(chip.metrics.peakBallHeightMetres).toBeGreaterThan(BALL_CONTROL.bodyHeight);
    expect(chip.metrics.airborneSeconds).toBeGreaterThan(1);
    expect(chip.metrics.blocks).toBe(0);
    expect(chip.metrics.passReceivers).toEqual(['coral-9']);
    expect(wide.metrics.requestedLoft).toBe(0);
    expect(wide.metrics.peakBallHeightMetres).toBe(BALL_CONTROL.radius);
    expect(wide.metrics.passReceivers).toEqual(['coral-6']);
    for (const result of [chip, wide]) {
      expect(result.metrics.finalPossession).toBe('ours');
      expect(result.metrics.turnovers).toBe(0);
      expect(result.metrics.maximumControlledForwardMetres).toBeGreaterThan(7);
    }
  });

  it('bases keeper memory on real repeated interceptions and excludes that history from new outcomes', () => {
    const scenario = situation('keeper-distribution');
    const memory = tacticalMemorySchema.parse(scenario.memory);
    validateTacticalMemory(memory, scenario.state.players, 'coral');
    expect(
      scenario.state.events
        .filter((event) => event.type === 'interception')
        .map((event) => event.playerId),
    ).toEqual(['cyan-10', 'cyan-10']);
    expect(
      scenario.state.events.filter((event) => event.type === 'save').map((event) => event.playerId),
    ).toEqual(['coral-1', 'coral-1']);
    expect(scenario.state.ball.owner).toBe('coral-1');
    const observation = observe(
      scenario.state,
      scenario.team,
      memory,
      TICK_RATE,
      scenario.previousDecisionTick,
    );
    expect(observation.recentEvents.filter((event) => event.type === 'interception')).toHaveLength(
      2,
    );
    expect(observation.privateMemory).toEqual(memory);
    expect(observation.previousDecisionTick).toBeLessThan(scenario.state.tick);
    const repeated = evaluate(scenario, [
      { type: 'kick', playerId: 'coral-1', target: { x: 30, y: 34 }, speed: 15, loft: 0 },
    ]);
    const changed = evaluate(scenario, [
      { type: 'kick', playerId: 'coral-1', target: { x: 22, y: 26 }, speed: 15, loft: 0 },
    ]);
    expect(repeated.metrics.turnovers).toBe(1);
    expect(repeated.metrics.finalOwnerId).toBe('cyan-10');
    expect(changed.metrics.turnovers).toBe(0);
    expect(changed.metrics.finalOwnerId).toBe('coral-3');
    expect(changed.metrics.passReceivers).toEqual(['coral-3']);
    expect(changed.events.every((event) => event.tick >= scenario.state.tick)).toBe(true);
  });

  it('reports actual teammate crowding even when a carrier keeps the ball safely', () => {
    const result = evaluate(situation('carry-space'), [
      { type: 'move', playerId: 'coral-6', target: { x: 44, y: 20 }, pace: 1 },
      { type: 'move', playerId: 'coral-9', target: { x: 44, y: 20 }, pace: 1 },
    ]);
    expect(result.metrics.finalOwnerId).toBe('coral-7');
    expect(result.metrics.spacingMetres.minimum).toBeLessThan(1);
    expect(result.metrics.spacingMetres.final).toBeLessThan(1);
    expect(result.metrics.spacingMetres.initial).toBeGreaterThan(8);
  });

  it('offers a real shot through the open side without awarding goals for choosing shoot', () => {
    const scenario = situation('shooting-chance');
    const openSide = evaluate(scenario, [
      { type: 'shoot', playerId: 'coral-10', target: { x: 105, y: 36.5 }, speed: 24, loft: 0 },
    ]);
    const miss = evaluate(scenario, [
      { type: 'shoot', playerId: 'coral-10', target: { x: 105, y: 45 }, speed: 24, loft: 0 },
    ]);
    expect(openSide.metrics.goalsFor).toBe(1);
    expect(miss.metrics.goalsFor).toBe(0);
    expect(openSide.events.some((event) => event.type === 'shot')).toBe(true);
  });

  it('extracts either team’s exact possession boundary and original opposition without changing the replay', () => {
    const recording = createFullMatchFixture();
    const initialHash = stateHash(recording.initial);
    const state = cloneState(recording.initial);
    let decisionIndex = 0;
    const checked = new Set<string>();
    while (state.tick < recording.durationTicks && checked.size < 2) {
      const decision = recording.decisions[decisionIndex];
      if (decision?.tick === state.tick) {
        const carrier = state.players.find((player) => player.id === state.ball.owner);
        if (
          state.phase.type === 'open_play' &&
          carrier?.role === 'outfield' &&
          !checked.has(carrier.team)
        ) {
          const scenario = recordedPossessionScenario(recording, decisionIndex, carrier.team);
          expect(stateHash(scenario.state)).toBe(stateHash(state));
          expect(scenario.opponentOrders).toEqual(
            decision.batches.find((batch) => batch.team !== carrier.team)!.orders,
          );
          expect(scenario.memory).toBeNull();
          const result = evaluateControllerScenario(
            scenario,
            decision.batches.find((batch) => batch.team === carrier.team)!,
          );
          const replay = cloneState(state);
          applyDecision(replay, ...decision.batches);
          while (replay.tick < result.finalState.tick) step(replay);
          expect(result.finalHash).toBe(stateHash(replay));
          expect(
            result.metrics.controlSeconds.own +
              result.metrics.controlSeconds.opponent +
              result.metrics.controlSeconds.loose,
          ).toBeCloseTo(result.metrics.simulatedSeconds);
          checked.add(carrier.team);
        }
        applyDecision(state, ...decision.batches);
        decisionIndex++;
      }
      step(state);
    }
    expect(checked).toEqual(new Set(['coral', 'cyan']));
    expect(() => recordedPossessionScenario(recording, 0, 'coral')).toThrow('open-play');
    expect(() => recordedPossessionScenario(recording, -1, 'coral')).toThrow('index');
    expect(stateHash(recording.initial)).toBe(initialHash);
  });
});
