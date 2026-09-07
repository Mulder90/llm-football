import { createMatch, cloneState } from '../sim/state.ts';
import { applyDecision, emptyBatch } from '../sim/orders.ts';
import { step } from '../sim/step.ts';
import { ENGINE_VERSION, TICK_RATE } from '../sim/rules.ts';
import type { Order, Team } from '../sim/types.ts';
import { capture, stateHash, SAMPLE_INTERVAL_TICKS } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';

const FIXTURE_DURATION_SECONDS = 24;
const FIXTURE_MOVEMENT_PACE = 0.55;
const FIXTURE_PASS_SPEED = 15;

const move = (playerId: string, x: number, y: number): Order => ({
  type: 'move',
  playerId,
  target: { x, y },
  pace: FIXTURE_MOVEMENT_PACE,
});
const kick = (playerId: string, x: number, y: number): Order => ({
  type: 'kick',
  playerId,
  target: { x, y },
  speed: FIXTURE_PASS_SPEED,
});

// These are deliberately explicit scripted orders, with no hidden football controller.
const sequence: { tick: number; coral: Order[]; cyan: Order[] }[] = [
  {
    tick: 0,
    coral: [kick('coral-7', 40, 15), move('coral-9', 57, 9), move('coral-11', 56, 60)],
    cyan: [move('cyan-7', 65, 32), move('cyan-2', 80, 56), move('cyan-5', 80, 12)],
  },
  {
    tick: 120,
    coral: [move('coral-6', 45, 19), move('coral-7', 43, 34)],
    cyan: [move('cyan-6', 63, 51), move('cyan-8', 63, 17)],
  },
  {
    tick: 240,
    coral: [kick('coral-6', 50, 34), move('coral-2', 28, 12), move('coral-5', 28, 56)],
    cyan: [move('cyan-10', 60, 35), move('cyan-9', 59, 55), move('cyan-11', 59, 13)],
  },
  {
    tick: 360,
    coral: [kick('coral-10', 40, 53), move('coral-6', 48, 15)],
    cyan: [move('cyan-7', 65, 38)],
  },
  {
    tick: 480,
    coral: [move('coral-8', 44, 50), move('coral-10', 52, 36)],
    cyan: [move('cyan-8', 61, 21)],
  },
  {
    tick: 600,
    coral: [kick('coral-8', 43, 34), move('coral-11', 51, 57)],
    cyan: [move('cyan-10', 57, 34), move('cyan-7', 65, 32)],
  },
  {
    tick: 720,
    coral: [kick('coral-7', 48, 15), move('coral-8', 42, 54)],
    cyan: [move('cyan-8', 58, 20), move('cyan-6', 63, 48)],
  },
  { tick: 840, coral: [kick('coral-6', 57, 34)], cyan: [move('cyan-10', 56, 33)] },
  {
    tick: 960,
    coral: [move('coral-7', 47, 34), move('coral-10', 51, 30)],
    cyan: [kick('cyan-10', 65, 32), move('cyan-8', 60, 18)],
  },
  {
    tick: 1080,
    coral: [move('coral-8', 47, 50)],
    cyan: [kick('cyan-7', 63, 48), move('cyan-10', 57, 30)],
  },
  {
    tick: 1200,
    coral: [move('coral-11', 54, 55)],
    cyan: [move('cyan-6', 59, 46), move('cyan-7', 65, 34)],
  },
  { tick: 1320, coral: [move('coral-7', 47, 38)], cyan: [kick('cyan-6', 65, 34)] },
];

export function createPassingFixture(): Recording {
  const state = createMatch();
  const record: Recording = {
    format: 'ai-football-recording',
    version: 1,
    engine: ENGINE_VERSION,
    kind: 'fixture',
    title: 'The first exchange',
    description:
      'A development fixture: explicit pass-and-move orders, resolved by the football engine.',
    teams: {
      coral: { name: 'Coral FC', controller: 'Scripted fixture' },
      cyan: { name: 'Cyan FC', controller: 'Scripted fixture' },
    },
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
    finalHash: '',
    durationTicks: 0,
  };
  let index = 0;
  while (state.tick < FIXTURE_DURATION_SECONDS * TICK_RATE && state.phase === 'open_play') {
    const next = sequence[index];
    if (next?.tick === state.tick) {
      const batch = (team: Team) => ({ ...emptyBatch(state, team), orders: next[team] });
      const batches = applyDecision(state, batch('coral'), batch('cyan'));
      record.decisions.push({ tick: state.tick, batches, fallback: [] });
      index++;
    }
    step(state);
    if (state.tick % SAMPLE_INTERVAL_TICKS === 0) record.frames.push(capture(state));
  }
  if (record.frames.at(-1)!.tick !== state.tick) record.frames.push(capture(state));
  record.events = state.events;
  record.durationTicks = state.tick;
  record.finalHash = stateHash(state);
  return record;
}
