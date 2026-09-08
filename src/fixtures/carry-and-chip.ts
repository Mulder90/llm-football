import { capture, SAMPLE_INTERVAL_TICKS, stateHash } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import { footPosition } from '../sim/ball.ts';
import { applyDecision, emptyBatch } from '../sim/orders.ts';
import { ENGINE_VERSION, TICK_RATE } from '../sim/rules.ts';
import { cloneState, createMatch } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import type { Order } from '../sim/types.ts';

const PRACTICE_SECONDS = 8;
const CARRY_SECONDS = 2;
const RECEIVER_RUN_SECONDS = 4;
const CARRIER_ID = 'coral-7';
const RECEIVER_ID = 'coral-9';

/** Explicit practice orders demonstrate carrying and loft; this is never model-played footage. */
export function createCarryAndChipFixture(): Recording {
  const state = createMatch('carry-and-chip-fixture-001');
  const carrier = state.players.find((player) => player.id === CARRIER_ID)!;
  const receiver = state.players.find((player) => player.id === RECEIVER_ID)!;
  // Set an honest practice lane: a carrier, a receiver arriving wide, and a stationary defender.
  carrier.position = { x: 35, y: 34 };
  receiver.position = { x: 63, y: 28 };
  state.players.find((player) => player.id === 'coral-10')!.position = { x: 50, y: 45 };
  state.players.find((player) => player.id === 'cyan-10')!.position = { x: 55, y: 34 };
  state.ball.position = footPosition(carrier);

  const sequence: { tick: number; orders: Order[] }[] = [
    {
      tick: 0,
      orders: [
        { type: 'move', playerId: CARRIER_ID, target: { x: 45, y: 34 }, pace: 1 },
        { type: 'move', playerId: RECEIVER_ID, target: { x: 65, y: 34 }, pace: 0.7 },
      ],
    },
    {
      tick: CARRY_SECONDS * TICK_RATE,
      orders: [
        { type: 'kick', playerId: CARRIER_ID, target: { x: 65, y: 34 }, speed: 15, loft: 6 },
      ],
    },
    {
      tick: RECEIVER_RUN_SECONDS * TICK_RATE,
      orders: [{ type: 'move', playerId: RECEIVER_ID, target: { x: 76, y: 24 }, pace: 0.75 }],
    },
  ];
  const recording: Recording = {
    format: 'ai-football-recording',
    version: 2,
    engine: ENGINE_VERSION,
    kind: 'fixture',
    title: 'Carry, chip, go',
    description:
      'Scripted practice, not LLM-controlled: Coral #7 carries into space and chips over a stationary defender to #9, who runs on. Every contact is resolved by the engine.',
    teams: {
      coral: { name: 'Coral FC', controller: 'Scripted practice' },
      cyan: { name: 'Cyan FC', controller: 'Stationary practice defenders' },
    },
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
    durationTicks: 0,
    finalHash: '',
  };
  let decisionIndex = 0;
  while (state.tick < PRACTICE_SECONDS * TICK_RATE && state.phase.type !== 'full_time') {
    const decision = sequence[decisionIndex];
    if (decision?.tick === state.tick) {
      recording.decisions.push({
        tick: state.tick,
        batches: applyDecision(
          state,
          { ...emptyBatch(state, 'coral'), orders: decision.orders },
          emptyBatch(state, 'cyan'),
        ),
        fallback: [],
      });
      decisionIndex++;
    }
    const eventCount = state.events.length;
    step(state);
    if (state.tick % SAMPLE_INTERVAL_TICKS === 0 || state.events.length !== eventCount)
      recording.frames.push(capture(state));
  }
  if (recording.frames.at(-1)!.tick !== state.tick) recording.frames.push(capture(state));
  recording.events = state.events;
  recording.durationTicks = state.tick;
  recording.finalHash = stateHash(state);
  return recording;
}
