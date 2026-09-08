import { describe, expect, it } from 'vitest';
import { parseModelDecision, PROTOCOL_LIMITS } from '../src/protocol/schema.ts';
import type { TacticalMemory } from '../src/protocol/schema.ts';
import { emptyBatch } from '../src/sim/orders.ts';
import { FIELD, PLAYERS_PER_TEAM } from '../src/sim/rules.ts';
import { createMatch } from '../src/sim/state.ts';
import type { MatchState } from '../src/sim/types.ts';

function passingPlan(): TacticalMemory {
  return {
    plan: 'Play wide, with a separate supporting option and cover behind the ball.',
    ballPlayerId: 'coral-7',
    pass: { receiverId: 'coral-9', target: { x: 58, y: 12 } },
    assignments: [
      { playerId: 'coral-11', role: 'support', opponentId: null },
      { playerId: 'coral-4', role: 'mark', opponentId: 'cyan-10' },
    ],
    threats: [{ opponentId: 'cyan-8', concern: 'Running behind our midfield.' }],
    review: 'The last pass reached the wing.',
  };
}

function accept(memory: unknown, state: MatchState = createMatch()) {
  return parseModelDecision(
    { batch: emptyBatch(state, 'coral'), intent: '', memory },
    state,
    'coral',
  );
}

describe('structured tactical memory boundary', () => {
  it('accepts a plan independently of executable orders, including clearing an old plan', () => {
    const memory = passingPlan();
    const accepted = accept(memory);
    expect(accepted.memory).toEqual(memory);
    expect(accepted.batch.orders).toEqual([]);
    expect(
      accept({ plan: '', ballPlayerId: null, pass: null, assignments: [], threats: [], review: '' })
        .memory,
    ).toMatchObject({
      ballPlayerId: null,
      pass: null,
      assignments: [],
    });
  });

  it('rejects wrong-side or dismissed players in every tactical reference', () => {
    const plan = passingPlan();
    for (const memory of [
      { ...plan, pass: { ...plan.pass!, receiverId: 'cyan-9' } },
      { ...plan, assignments: [{ playerId: 'cyan-4', role: 'cover', opponentId: null }] },
      { ...plan, assignments: [{ playerId: 'coral-4', role: 'mark', opponentId: 'coral-10' }] },
      { ...plan, threats: [{ opponentId: 'coral-8', concern: '' }] },
    ])
      expect(() => accept(memory)).toThrow('teammates and opponents');

    for (const id of ['coral-9', 'coral-11', 'cyan-10', 'cyan-8']) {
      const state = createMatch();
      state.players.find((player) => player.id === id)!.dismissed = true;
      expect(() => accept(plan, state)).toThrow('teammates and opponents');
    }
  });

  it.each(['coral', 'cyan'] as const)(
    'explains a wrong-side %s ballPlayerId during defence without rewriting the decision',
    (team) => {
      const state = createMatch();
      const opponent = team === 'coral' ? 'cyan' : 'coral';
      state.ball.owner = `${opponent}-10`;
      const memory: TacticalMemory = {
        plan: 'Press the opposing carrier.',
        ballPlayerId: state.ball.owner,
        pass: null,
        assignments: [],
        threats: [{ opponentId: state.ball.owner, concern: 'Carrying towards our goal.' }],
        review: '',
      };
      const response = { batch: emptyBatch(state, team), intent: '', memory };
      const before = JSON.stringify({ state, response });
      const message = `memory.ballPlayerId must name an active ${team} teammate`;
      expect(() => parseModelDecision(response, state, team)).toThrow(message);
      expect(JSON.stringify({ state, response })).toBe(before);

      memory.ballPlayerId = `${team}-7`;
      expect(parseModelDecision(response, state, team).memory).toEqual(memory);
      state.players.find((player) => player.id === memory.ballPlayerId)!.dismissed = true;
      expect(() => parseModelDecision(response, state, team)).toThrow(message);
      memory.ballPlayerId = null;
      expect(parseModelDecision(response, state, team).memory?.ballPlayerId).toBeNull();
    },
  );

  it('rejects conflicting assignments and a pass with no distinct ball player and receiver', () => {
    const plan = passingPlan();
    expect(() =>
      accept({ ...plan, assignments: [plan.assignments[0], plan.assignments[0]] }),
    ).toThrow('distinct teammates');
    expect(() => accept({ ...plan, ballPlayerId: null })).toThrow('different receiver');
    expect(() =>
      accept({ ...plan, pass: { ...plan.pass!, receiverId: plan.ballPlayerId } }),
    ).toThrow('different receiver');
  });

  it('bounds plan size and pitch coordinates and rejects non-finite targets and unknown fields', () => {
    const maximum: TacticalMemory = {
      ...passingPlan(),
      plan: 'p'.repeat(PROTOCOL_LIMITS.planCharacters),
      review: 'r'.repeat(PROTOCOL_LIMITS.reviewCharacters),
      pass: { receiverId: 'coral-9', target: { x: FIELD.length, y: FIELD.width } },
      assignments: Array.from({ length: PLAYERS_PER_TEAM - 1 }, (_, index) => ({
        playerId: `coral-${index + 1}`,
        role: 'support',
        opponentId: null,
      })),
      threats: Array.from({ length: PROTOCOL_LIMITS.opponentThreats }, (_, index) => ({
        opponentId: `cyan-${index + 1}`,
        concern: 't'.repeat(PROTOCOL_LIMITS.threatCharacters),
      })),
    };
    expect(accept(maximum).memory).toEqual(maximum);
    for (const memory of [
      { ...maximum, plan: maximum.plan + 'x' },
      { ...maximum, review: maximum.review + 'x' },
      {
        ...maximum,
        assignments: [
          ...maximum.assignments,
          { playerId: 'coral-11', role: 'cover', opponentId: null },
        ],
      },
      { ...maximum, threats: [...maximum.threats, { opponentId: 'cyan-3', concern: '' }] },
      {
        ...maximum,
        threats: [
          { opponentId: 'cyan-3', concern: 'x'.repeat(PROTOCOL_LIMITS.threatCharacters + 1) },
        ],
      },
      { ...maximum, hiddenOrders: [] },
      { ...maximum, pass: { ...maximum.pass!, target: { x: -0.01, y: 0 } } },
      { ...maximum, pass: { ...maximum.pass!, target: { x: FIELD.length + 0.01, y: 0 } } },
      { ...maximum, pass: { ...maximum.pass!, target: { x: 0, y: FIELD.width + 0.01 } } },
      ...[NaN, Infinity, -Infinity].map((x) => ({
        ...maximum,
        pass: { ...maximum.pass!, target: { x, y: 0 } },
      })),
    ])
      expect(() => accept(memory)).toThrow('Invalid response');
  });
});
