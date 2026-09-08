import { capture, SAMPLE_INTERVAL_TICKS, stateHash } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import { observe } from '../protocol/observation.ts';
import { footPosition } from '../sim/ball-control.ts';
import { applyDecision, emptyBatch } from '../sim/orders.ts';
import { ENGINE_VERSION, TICK_RATE } from '../sim/rules.ts';
import { cloneState, createMatch } from '../sim/state.ts';
import { step } from '../sim/step.ts';
import type { Order, Team } from '../sim/types.ts';

/** Authored practice: all passes, runs and the opponent's return are explicit orders. */
export function createKeeperFixture(): Recording {
  const state = createMatch('keeper-practice-001');
  const keeper = state.players[0]!;
  keeper.position = { x: 8, y: 34 };
  state.players.find((player) => player.id === 'coral-3')!.position = { x: 21, y: 30 };
  state.players.find((player) => player.id === 'coral-4')!.position = { x: 28, y: 50 };
  state.players.find((player) => player.id === 'coral-6')!.position = { x: 27, y: 20 };
  state.players.find((player) => player.id === 'cyan-10')!.position = { x: 23, y: 42 };
  state.ball.owner = keeper.id;
  state.ball.lastTouch = 'cyan-10';
  state.ball.position = footPosition(keeper);
  const sequence: { tick: number; coral: Order[]; cyan: Order[]; intent: string }[] = [
    {
      tick: 0,
      coral: [{ type: 'pickup', playerId: keeper.id }],
      cyan: [],
      intent: 'Scripted: collect the eligible ball at feet.',
    },
    {
      tick: 60,
      coral: [{ type: 'move', playerId: keeper.id, target: { x: 10, y: 30 }, pace: 0.45 }],
      cyan: [],
      intent: 'Scripted: carry in hands toward the outlet, retaining the original timer.',
    },
    {
      tick: 270,
      coral: [
        {
          type: 'distribute',
          delivery: 'roll',
          playerId: keeper.id,
          target: { x: 21, y: 30 },
          speed: 10,
          loft: 0,
        },
      ],
      cyan: [],
      intent: 'Scripted: roll to Coral #3 before the holding limit.',
    },
    {
      tick: 390,
      coral: [{ type: 'kick', playerId: 'coral-3', target: { x: 23, y: 42 }, speed: 12, loft: 0 }],
      cyan: [],
      intent: 'Scripted drill: send the ball to Cyan #10 for a return.',
    },
    {
      tick: 510,
      coral: [{ type: 'guard', playerId: keeper.id, target: { x: 10, y: 30 } }],
      cyan: [{ type: 'kick', playerId: 'cyan-10', target: { x: 10, y: 30 }, speed: 16, loft: 3 }],
      intent: 'Scripted: guard the chosen point as Cyan returns an aerial ball.',
    },
    {
      tick: 630,
      coral: [{ type: 'hold', playerId: keeper.id }],
      cyan: [],
      intent: 'Scripted: settle the catch in hands.',
    },
    {
      tick: 750,
      coral: [
        {
          type: 'distribute',
          delivery: 'throw',
          playerId: keeper.id,
          target: { x: 27, y: 20 },
          speed: 14,
          loft: 3,
        },
      ],
      cyan: [],
      intent: 'Scripted: throw to the wide outlet.',
    },
    {
      tick: 870,
      coral: [{ type: 'move', playerId: 'coral-6', target: { x: 31, y: 16 }, pace: 0.5 }],
      cyan: [],
      intent: 'Scripted: the receiver carries on from actual control.',
    },
  ];
  const recording: Recording = {
    format: 'ai-football-recording',
    version: 2,
    engine: ENGINE_VERSION,
    kind: 'fixture',
    title: 'Safe hands, open play',
    description:
      'Scripted goalkeeper practice: ground pickup, movement in hands, roll, an opponent return, a catch and a throw to a wide receiver. All outcomes are resolved by the engine; no model calls.',
    teams: {
      coral: { name: 'Coral FC', controller: 'Scripted practice' },
      cyan: { name: 'Cyan FC', controller: 'Scripted practice' },
    },
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
    durationTicks: 0,
    finalHash: '',
  };
  let previousDecisionTick = 0;
  for (let tick = 0; tick < 16 * TICK_RATE && state.phase.type === 'open_play'; tick++) {
    const decision = sequence.find((entry) => entry.tick === state.tick);
    if (decision) {
      const observations = Object.fromEntries(
        (['coral', 'cyan'] as const).map((team) => [
          team,
          JSON.stringify(observe(state, team, null, TICK_RATE, previousDecisionTick)),
        ]),
      ) as Record<Team, string>;
      const batch = (team: Team) => ({ ...emptyBatch(state, team), orders: decision[team] });
      recording.decisions.push({
        tick: state.tick,
        batches: applyDecision(state, batch('coral'), batch('cyan')),
        fallback: [],
        observations,
        notes: {
          coral: { intent: decision.intent, memory: null },
          cyan: { intent: 'Explicit scripted practice orders; no model decisions.', memory: null },
        },
      });
      previousDecisionTick = state.tick;
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
