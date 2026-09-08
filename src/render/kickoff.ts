import type { Frame, Recording } from '../recording/record.ts';
import { clamp, distanceBetween, unitVector } from '../sim/math.ts';
import { prepareRestartDelivery } from '../sim/restarts.ts';
import { MATCH_TIMING, TICK_RATE } from '../sim/rules.ts';
import { attackDirection, clonePhase, cloneState } from '../sim/state.ts';

const SUPPORT_DISTANCE_METRES = 5;

/** Opening-half tableau only. Referee geometry runs on a copy; no match step is simulated. */
export function kickoffFrame(record: Recording, frame: Frame, reducedMotion: boolean): Frame {
  const phase = frame.phase;
  if (
    phase.type !== 'restart_setup' ||
    phase.restart.type !== 'kickoff' ||
    frame.playingTicks !== (frame.half - 1) * MATCH_TIMING.halfPlayingTicks ||
    record.events.some(
      (event) => event.tick < frame.tick && event.tick === phase.sinceTick && event.type === 'goal',
    )
  )
    return frame;

  const start = record.frames.find(
    (candidate) =>
      candidate.tick <= frame.tick &&
      candidate.phase.type === 'restart_setup' &&
      candidate.phase.sinceTick === phase.sinceTick,
  )!;
  const { restart } = phase;
  const support = record.initial.players
    .map((player, index) => ({ player, index, pose: start.players[index]! }))
    .filter(
      ({ player, pose }) =>
        player.team === restart.team &&
        player.role === 'outfield' &&
        player.id !== restart.takerId &&
        !pose.dismissed,
    )
    .sort(
      (first, second) =>
        Math.abs(first.pose.position.y - restart.position.y) -
          Math.abs(second.pose.position.y - restart.position.y) ||
        distanceBetween(first.pose.position, restart.position) -
          distanceBetween(second.pose.position, restart.position) ||
        (first.player.id < second.player.id ? -1 : 1),
    )[0];

  const placed = cloneState(record.initial);
  placed.tick = Math.floor(frame.tick);
  placed.half = frame.half;
  placed.phase = clonePhase(phase);
  placed.players.forEach((player, index) => {
    const pose = frame.players[index]!;
    player.position = { ...pose.position };
    player.velocity = { ...pose.velocity };
    player.facing = { ...pose.facing };
    player.dismissed = pose.dismissed;
  });
  const durationTicks = phase.readyTick - phase.sinceTick;
  const progress = clamp((frame.tick - phase.sinceTick) / durationTicks, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const speedFactor = (-6 * progress * (1 - progress) * TICK_RATE) / durationTicks;
  const direction = attackDirection(placed, restart.team);
  const supportOffset = support
    ? {
        x: restart.position.x - direction * SUPPORT_DISTANCE_METRES - support.pose.position.x,
        y: restart.position.y - support.pose.position.y,
      }
    : { x: 0, y: 0 };
  if (support && !reducedMotion) {
    const position = placed.players[support.index]!.position;
    position.x += supportOffset.x * (1 - eased);
    position.y += supportOffset.y * (1 - eased);
  }
  // This is the same placement used at readyTick: own halves, centre-circle clearance and taker foot offset.
  // Its copied orders, ball owner, phase and emitted event are intentionally not returned.
  prepareRestartDelivery(placed);

  return {
    ...frame,
    players: frame.players.map((pose, index) => {
      const player = placed.players[index]!;
      const taker = player.id === restart.takerId;
      const supporting = index === support?.index && !reducedMotion;
      const velocity = taker
        ? { x: 0, y: 0 }
        : supporting
          ? {
              x: pose.velocity.x + supportOffset.x * speedFactor,
              y: pose.velocity.y + supportOffset.y * speedFactor,
            }
          : pose.velocity;
      return {
        ...pose,
        position: player.position,
        velocity,
        facing: taker
          ? player.facing
          : supporting && Math.hypot(velocity.x, velocity.y) > 0
            ? unitVector(velocity)
            : pose.facing,
        distanceTravelled:
          pose.distanceTravelled +
          (supporting ? Math.hypot(supportOffset.x, supportOffset.y) * eased : 0),
      };
    }),
  };
}
