import { describe, expect, it } from 'vitest';
import { executeKick } from '../src/sim/ball.ts';
import { footPosition } from '../src/sim/ball-control.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { FIELD } from '../src/sim/rules.ts';
import { createMatch } from '../src/sim/state.ts';

describe('chosen kick direction from the actual ball', () => {
  for (const type of ['kick', 'shoot'] as const) {
    it.each([1, 2] as const)(
      `${type} retains launch XY when turning toward a narrow-angle target in half %i`,
      (half) => {
        const state = createMatch();
        state.half = half;
        const carrier = state.players.find((p) => p.id === 'coral-10')!;
        carrier.position = { x: half === 1 ? 102 : 3, y: 18 };
        carrier.facing = { x: half === 1 ? 1 : -1, y: 0 };
        state.ball.owner = carrier.id;
        state.ball.position = footPosition(carrier);
        const before = { ...state.ball.position };
        const target = { x: half === 1 ? FIELD.length : 0, y: 30 };
        applyDecision(
          state,
          {
            ...emptyBatch(state, 'coral'),
            orders: [{ type, playerId: carrier.id, target, speed: 25, loft: 0 }],
          },
          emptyBatch(state, 'cyan'),
        );
        executeKick(state, carrier);
        expect(state.ball.position).toEqual(before);
        expect(state.ball.owner).toBeNull();
        const timeToGoalPlane = (target.x - before.x) / state.ball.velocity.x;
        expect(before.y + timeToGoalPlane * state.ball.velocity.y).toBeCloseTo(target.y, 12);
        expect(Math.hypot(state.ball.velocity.x, state.ball.velocity.y)).toBeCloseTo(25, 12);
      },
    );
  }
});
