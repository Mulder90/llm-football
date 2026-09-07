import { clamp, distanceBetween, nextRandom } from './math.ts';
import { FIELD, MOVEMENT, NUMERIC_TOLERANCE } from './rules.ts';
import type { MatchState, Vec2 } from './types.ts';

const SEPARATION_PASSES = 2;

/** Symmetric circle separation, with stable pair order. No avoidance steering. */
export function separatePlayers(state: MatchState): void {
  const players = [...state.players].sort((first, second) => (first.id < second.id ? -1 : 1));
  const minimumDistance = MOVEMENT.playerRadius * 2;
  for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
    for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
      const first = players[firstIndex]!;
      for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex++) {
        const second = players[secondIndex]!;
        const distance = distanceBetween(first.position, second.position);
        if (distance >= minimumDistance) continue;
        let normal: Vec2;
        if (distance > NUMERIC_TOLERANCE.vectorLength) {
          normal = {
            x: (second.position.x - first.position.x) / distance,
            y: (second.position.y - first.position.y) / distance,
          };
        } else {
          const random = nextRandom(state.seed);
          state.seed = random.seed;
          const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
          ];
          normal = directions[Math.floor(random.value * directions.length)]!;
        }
        const correction = (minimumDistance - distance) / 2;
        first.position.x = clamp(
          first.position.x - normal.x * correction,
          MOVEMENT.boundaryInset,
          FIELD.length - MOVEMENT.boundaryInset,
        );
        first.position.y = clamp(
          first.position.y - normal.y * correction,
          MOVEMENT.boundaryInset,
          FIELD.width - MOVEMENT.boundaryInset,
        );
        second.position.x = clamp(
          second.position.x + normal.x * correction,
          MOVEMENT.boundaryInset,
          FIELD.length - MOVEMENT.boundaryInset,
        );
        second.position.y = clamp(
          second.position.y + normal.y * correction,
          MOVEMENT.boundaryInset,
          FIELD.width - MOVEMENT.boundaryInset,
        );
      }
    }
  }
}
