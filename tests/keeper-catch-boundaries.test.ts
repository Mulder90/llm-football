import { describe, expect, it } from 'vitest';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { BALL_CONTROL, FIELD, KEEPER } from '../src/sim/rules.ts';
import { createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { Vec2 } from '../src/sim/types.ts';

function catchAt(
  half: 1 | 2,
  ball: Vec2,
  body: Vec2,
  facing: Vec2,
  velocity = { x: 0, y: 0, z: 0 },
) {
  const state = createMatch('catch-boundary');
  state.half = half;
  state.players.forEach((player, index) => {
    player.position = { x: 35 + index * 2, y: 8 };
  });
  const keeper = state.players[0]!;
  keeper.position = { ...body };
  keeper.facing = { ...facing };
  state.ball.owner = null;
  state.ball.position = { ...ball, z: 1 };
  state.ball.velocity = velocity;
  state.ball.lastTouch = 'cyan-10';
  applyDecision(
    state,
    {
      ...emptyBatch(state, 'coral'),
      orders: [{ type: 'guard', playerId: keeper.id, target: body }],
    },
    emptyBatch(state, 'cyan'),
  );
  step(state);
  return { state, keeper };
}

describe('catch contact placement', () => {
  it.each([1, 2] as const)(
    'retains the legal contact at an outward-facing goal in half %i',
    (half) => {
      // Mirrored reproduction of keeper-era-match-001 tick 3245. The old facing
      // anchor moved a legal catch to x=105.25 and immediately awarded a free kick.
      const x = half === 1 ? 0.4 : 104.6;
      const outward = half === 1 ? -1 : 1;
      const ball = { x: x - outward * 1.42031091839458, y: 33.234688284793904 };
      const { state, keeper } = catchAt(
        half,
        ball,
        { x, y: 34 },
        { x: outward, y: 0 },
        { x: outward * 13.138534429441435, y: 21.92081486070929, z: 0 },
      );
      expect(state.ball.position.z).toBe(KEEPER.handHeight);
      expect(Math.abs(state.ball.position.x - ball.x)).toBeLessThan(13.14 / 60);
      expect(state.ball.position.y).toBeGreaterThan(ball.y);
      expect(state.ball.position.y).toBeLessThan(ball.y + 21.93 / 60);
      expect(state.ball.owner).toBe(keeper.id);
      expect(state.phase.type).toBe('open_play');
      expect(state.events.map((event) => event.type)).toEqual(['save']);
      const held = { ...state.ball.position };
      keeper.facing = { x: 0, y: -1 };
      for (let tick = 0; tick < 60; tick++) step(state);
      expect(state.ball.position).toEqual(held);
      expect(state.events.some((event) => event.type === 'keeper_violation')).toBe(false);
    },
  );

  const edges = [
    { name: 'goal', ball: { x: 0, y: 34 }, body: { x: 0.8, y: 34 }, outward: { x: -1, y: 0 } },
    { name: 'front', ball: { x: 16.5, y: 34 }, body: { x: 17.2, y: 34 }, outward: { x: 1, y: 0 } },
    {
      name: 'top',
      ball: { x: 8, y: 34 - FIELD.penaltyAreaWidth / 2 },
      body: { x: 8, y: 13.2 },
      outward: { x: 0, y: -1 },
    },
    {
      name: 'bottom',
      ball: { x: 8, y: 34 + FIELD.penaltyAreaWidth / 2 },
      body: { x: 8, y: 54.8 },
      outward: { x: 0, y: 1 },
    },
  ];
  for (const half of [1, 2] as const) {
    for (const edge of edges) {
      const mirror = (p: Vec2) => ({ x: half === 1 ? p.x : FIELD.length - p.x, y: p.y });
      const ball = mirror(edge.ball);
      const body = mirror(edge.body);
      const outward = { x: edge.outward.x * (half === 1 ? 1 : -1), y: edge.outward.y };
      it(`keeps exact ${edge.name} line contact through turning, then penalizes actual exit in half ${half}`, () => {
        const { state, keeper } = catchAt(half, ball, body, outward);
        expect(state.ball.handControl?.kind).toBe('catch');
        expect(state.ball.position).toEqual({ ...ball, z: KEEPER.handHeight });
        keeper.facing = { x: -outward.x, y: -outward.y };
        for (let tick = 0; tick < 10; tick++) step(state);
        expect(state.ball.position).toEqual({ ...ball, z: KEEPER.handHeight });
        applyDecision(
          state,
          {
            ...emptyBatch(state, 'coral'),
            orders: [
              {
                type: 'move',
                playerId: keeper.id,
                target: { x: body.x + outward.x * 0.2, y: body.y + outward.y * 0.2 },
                pace: 1,
              },
            ],
          },
          emptyBatch(state, 'cyan'),
        );
        step(state);
        expect(state.phase).toMatchObject({
          type: 'restart_setup',
          restart: { type: 'free_kick', team: 'cyan' },
        });
      });
      it(`does not catch just outside the ${edge.name} line in half ${half}`, () => {
        const outside = { x: ball.x + outward.x * 1e-6, y: ball.y + outward.y * 1e-6 };
        const { state } = catchAt(half, outside, body, outward);
        expect(state.ball.handControl).toBeNull();
        expect(state.events.some((event) => event.type === 'save')).toBe(false);
      });
    }
  }

  it('translates a caught ball by actual body motion, preserving its original offset after a turn', () => {
    const { state, keeper } = catchAt(1, { x: 8, y: 34 }, { x: 9, y: 34 }, { x: 1, y: 0 });
    const beforeBall = { ...state.ball.position };
    const beforeKeeper = { ...keeper.position };
    applyDecision(
      state,
      {
        ...emptyBatch(state, 'coral'),
        orders: [{ type: 'move', playerId: keeper.id, target: { x: 9, y: 40 }, pace: 0.5 }],
      },
      emptyBatch(state, 'cyan'),
    );
    for (let tick = 0; tick < 60; tick++) step(state);
    expect(state.ball.position.x - beforeBall.x).toBeCloseTo(
      keeper.position.x - beforeKeeper.x,
      12,
    );
    expect(state.ball.position.y - beforeBall.y).toBeCloseTo(
      keeper.position.y - beforeKeeper.y,
      12,
    );
    expect(state.ball.position.z).toBe(KEEPER.handHeight);
    expect(state.ball.position.z).toBeGreaterThan(BALL_CONTROL.radius);
  });
});
