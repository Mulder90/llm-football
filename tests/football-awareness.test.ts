import { describe, expect, it } from 'vitest';
import { observe } from '../src/protocol/observation.ts';
import { stateHash } from '../src/recording/record.ts';
import { createMatch } from '../src/sim/state.ts';
import { FIELD, REFEREE } from '../src/sim/rules.ts';
import type { Team } from '../src/sim/types.ts';

describe('neutral football geometry', () => {
  for (const team of ['coral', 'cyan'] as const) {
    it.each([1, 2] as const)(
      `mirrors goal opening for ${team} in half %i without changing state`,
      (half) => {
        const state = createMatch();
        state.half = half;
        const attackingRight = (team === 'coral') === (half === 1);
        state.ball.position = { x: attackingRight ? 75 : 30, y: 34, z: 0.11 };
        const before = stateHash(state);
        const snapshot = observe(state, team, null, 60);
        expect(snapshot.teamContext.ballToOpponentGoal).toEqual({
          distanceMetres: 30,
          openingAngleDegrees: 13.91,
        });
        expect(snapshot.ball.pitchClearanceMetres).toEqual({
          left: state.ball.position.x,
          right: 105 - state.ball.position.x,
          top: 34,
          bottom: 34,
        });
        const other: Team = team === 'coral' ? 'cyan' : 'coral';
        expect(snapshot.ball).toEqual(observe(state, other, null, 60).ball);
        expect(stateHash(state)).toBe(before);
      },
    );
  }

  it('reports a shrinking opening when a wide carrier approaches the goal line', () => {
    const state = createMatch();
    state.half = 2;
    const angles = [18, 8, 3, 1, 0].map((x) => {
      state.ball.position = { x, y: 18, z: 0.11 };
      return observe(state, 'coral', null, 60).teamContext.ballToOpponentGoal.openingAngleDegrees;
    });
    expect(angles.every((angle, i) => i === 0 || angle < angles[i - 1]!)).toBe(true);
    expect(angles.at(-1)).toBe(0);
    // Goal-plane/post edge cases have a defined finite geometric value, never NaN.
    for (const y of [34, 34 - FIELD.goalWidth / 2, 34 + FIELD.goalWidth / 2]) {
      state.ball.position.y = y;
      expect(
        observe(state, 'coral', null, 60).teamContext.ballToOpponentGoal.openingAngleDegrees,
      ).toBe(y === 34 ? 180 : 0);
    }
    state.ball.position.x = -0.1;
    expect(observe(state, 'coral', null, 60).ball.pitchClearanceMetres.left).toBe(-0.1);
  });

  it('exposes the existing card thresholds from exact public geometry, including ball-first tackles', () => {
    const state = createMatch();
    const carrier = state.players.find((p) => p.id === 'coral-7')!;
    const tackler = state.players.find((p) => p.id === 'cyan-2')!;
    carrier.position = { x: 50, y: 34 };
    tackler.position = { x: 51.2, y: 34 };
    state.ball.position = { x: 50.65, y: 34, z: 0.11 };
    const context = () =>
      observe(state, 'cyan', null, 60).players.find((p) => p.id === tackler.id)!.actionContext!;
    for (const [closing, severity] of [
      [0, null],
      [REFEREE.recklessClosingSpeed - 1e-6, null],
      [REFEREE.recklessClosingSpeed, 'reckless'],
      [REFEREE.excessiveClosingSpeed - 1e-6, 'reckless'],
      [REFEREE.excessiveClosingSpeed, 'excessive'],
      [12.6, 'excessive'],
    ] as const) {
      tackler.velocity.x = -closing / 2;
      carrier.velocity.x = closing / 2;
      expect(context()).toMatchObject({
        reachableTackleTargetId: carrier.id,
        tackleFoul: severity,
      });
    }
    tackler.velocity.x = carrier.velocity.x = 6.3; // Equal running speed is not closing speed.
    expect(context().tackleFoul).toBeNull();
    tackler.velocity.x = carrier.velocity.x = 0;
    state.ball.position.x = 49.96; // Stationary reach through the body: careless, no card.
    expect(context().tackleFoul).toBe('careless');
    state.ball.position.x = 40; // Unreachable is not a predicted foul.
    expect(context()).toMatchObject({ reachableTackleTargetId: null, tackleFoul: null });
  });
});
