import { capture, SAMPLE_INTERVAL_TICKS, stateHash } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import { applyDecision, emptyBatch } from '../sim/orders.ts';
import { awardRestart } from '../sim/restarts.ts';
import { ENGINE_VERSION, FIELD, TICK_RATE } from '../sim/rules.ts';
import { cloneState, createMatch } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import { scriptedOrders } from './scripted-team.ts';

const MAXIMUM_FIXTURE_TICKS = 20 * 60 * TICK_RATE;

export function createFullMatchFixture(): Recording {
  const state = createMatch('full-match-fixture-001');
  awardRestart(state, 'kickoff', state.firstKickoffTeam, {
    x: FIELD.length / 2,
    y: FIELD.width / 2,
  });
  const recording: Recording = {
    format: 'ai-football-recording',
    version: 2,
    engine: ENGINE_VERSION,
    kind: 'fixture',
    title: 'A full game in the garden',
    description:
      'A complete-match development baseline. Both teams are scripted, not LLM-controlled.',
    teams: {
      coral: { name: 'Coral FC', controller: 'Scripted baseline' },
      cyan: { name: 'Cyan FC', controller: 'Scripted baseline' },
    },
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
    durationTicks: 0,
    finalHash: '',
  };
  let previousPhase = '';
  while (state.phase.type !== 'full_time' && state.tick < MAXIMUM_FIXTURE_TICKS) {
    const phaseKey = `${state.phase.type}:${state.phase.sinceTick}`;
    const decisionBoundary = state.tick % TICK_RATE === 0 || previousPhase !== phaseKey;
    if (decisionBoundary && state.phase.type !== 'halftime') {
      const coral = { ...emptyBatch(state, 'coral'), orders: scriptedOrders(state, 'coral') };
      const cyan = { ...emptyBatch(state, 'cyan'), orders: scriptedOrders(state, 'cyan') };
      recording.decisions.push({
        tick: state.tick,
        batches: applyDecision(state, coral, cyan),
        fallback: [],
      });
    }
    previousPhase = phaseKey;
    const eventCount = state.events.length;
    step(state);
    const phaseChanged = `${state.phase.type}:${state.phase.sinceTick}` !== phaseKey;
    // Event-aligned samples retain contacts and position resets without interpolating across them.
    if (
      state.tick % SAMPLE_INTERVAL_TICKS === 0 ||
      state.events.length !== eventCount ||
      phaseChanged
    )
      recording.frames.push(capture(state));
  }
  if (state.phase.type !== 'full_time')
    throw new Error('Full-match fixture exceeded its deterministic tick budget');
  if (recording.frames.at(-1)!.tick !== state.tick) recording.frames.push(capture(state));
  recording.durationTicks = state.tick;
  recording.finalHash = stateHash(state);
  recording.events = state.events;
  return recording;
}
