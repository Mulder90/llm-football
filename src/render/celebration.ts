import { sample } from '../recording/record.ts';
import type { Frame, PlayerFrame, Recording } from '../recording/record.ts';
import { FIELD, TICK_RATE } from '../sim/rules.ts';
import { clamp, distanceBetween, unitVector } from '../sim/math.ts';
import type { Vec2 } from '../sim/types.ts';

export const GOAL_PRESENTATION = {
  durationTicks: 1.85 * TICK_RATE,
  watchDurationSeconds: 6,
  gatheringTicks: 0.45 * TICK_RATE,
  returnStartsTicks: 1.4 * TICK_RATE,
  bannerArrivalTicks: 0.16 * TICK_RATE,
  bannerDepartureTicks: 0.25 * TICK_RATE,
  teammates: 5,
  huddleRadius: 4,
} as const;

export type CelebrationGesture = {
  phase: 'windup' | 'jump' | 'landing' | 'salute' | 'support';
  jump: number;
  crouch: number;
  facingAway: boolean;
  armPose: 'raised' | 'wide' | 'pump';
  footSpread: number;
  landingPulse: number;
};

/** One scorer-led jump and broad landing, timed inside the existing six-watch-second vignette. */
export function celebrationGesture(
  ageTicks: number,
  scorer: boolean,
  playerNumber: number,
): CelebrationGesture {
  const settledAge = ageTicks - GOAL_PRESENTATION.gatheringTicks;
  const windupTicks = 9;
  const flightTicks = 19;
  const landingTicks = 9;
  const flight = clamp((settledAge - windupTicks) / flightTicks, 0, 1);
  const landingAge = settledAge - windupTicks - flightTicks;
  if (!scorer) {
    const reply = Math.max(0, landingAge - (playerNumber % 3) * 2);
    return {
      phase: 'support',
      jump: reply > 0 && reply < 12 ? Math.sin((reply / 12) * Math.PI) * 4 : 0,
      crouch: 0,
      facingAway: false,
      armPose: playerNumber % 2 === 0 ? 'raised' : 'pump',
      footSpread: 0,
      landingPulse: 0,
    };
  }
  const phase =
    settledAge < windupTicks
      ? 'windup'
      : flight < 1
        ? 'jump'
        : landingAge < landingTicks
          ? 'landing'
          : 'salute';
  return {
    phase,
    jump: phase === 'jump' ? Math.sin(flight * Math.PI) * 18 : 0,
    crouch: phase === 'windup' ? 3 : phase === 'landing' ? 3 * (1 - landingAge / landingTicks) : 0,
    facingAway: phase === 'jump' && flight < 0.55,
    armPose: phase === 'jump' ? 'raised' : 'wide',
    footSpread: phase === 'landing' || phase === 'salute' ? 3 : phase === 'jump' ? -1 : 0,
    landingPulse: phase === 'landing' ? 1 - landingAge / landingTicks : 0,
  };
}

export type CelebrationFrame = {
  frame: Frame;
  playerIds: Set<string>;
  scorerId: string | null;
  ageTicks: number;
  focus: Vec2 | null;
};

/** A goal becomes visible only after its physical step has updated the score. */
export function activeGoal(record: Recording, frame: Frame) {
  if (frame.phase.type !== 'restart_setup' || frame.phase.restart.type !== 'kickoff') return null;
  const event = record.events.findLast(
    (candidate) => candidate.type === 'goal' && candidate.tick < frame.tick,
  );
  if (!event?.team || frame.phase.sinceTick !== event.tick) return null;
  const ageTicks = frame.tick - event.tick - 1;
  return ageTicks < GOAL_PRESENTATION.durationTicks ? { event, ageTicks } : null;
}

function easedProgress(progress: number): number {
  const bounded = clamp(progress, 0, 1);
  return bounded * bounded * (3 - 2 * bounded);
}

function between(start: Vec2, end: Vec2, progress: number): Vec2 {
  return { x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress };
}

/** Pose interpolation also supplies distance/velocity so the sprite runs along its visual path. */
function movingPose(
  pose: PlayerFrame,
  start: Vec2,
  end: Vec2,
  progress: number,
  durationTicks: number,
): PlayerFrame {
  const bounded = clamp(progress, 0, 1);
  const eased = easedProgress(bounded);
  const speedFactor = (6 * bounded * (1 - bounded) * TICK_RATE) / durationTicks;
  const offset = { x: end.x - start.x, y: end.y - start.y };
  return {
    ...pose,
    position: between(start, end, eased),
    velocity: { x: offset.x * speedFactor, y: offset.y * speedFactor },
    facing: distanceBetween(start, end) > 0.01 ? unitVector(offset) : pose.facing,
    distanceTravelled: pose.distanceTravelled + distanceBetween(start, end) * eased,
  };
}

/** A stopped-clock presentation vignette. Never written back into the match record. */
export function celebrationFrame(
  record: Recording,
  frame: Frame,
  reducedMotion: boolean,
): CelebrationFrame {
  const playerIds = new Set<string>();
  const unchanged = { frame, playerIds, scorerId: null, ageTicks: 0, focus: null };
  const moment = activeGoal(record, frame);
  if (!moment || reducedMotion) return unchanged;

  const { event: goal, ageTicks } = moment;
  const beforeGoal = sample(record, Math.max(0, goal.tick - 1) / TICK_RATE);
  const lastTouch = record.initial.players.find((player) => player.id === goal.playerId);
  // A defender's last touch can score for the other side. Only the scoring side celebrates.
  const scorerId = lastTouch && lastTouch.team === goal.team ? lastTouch.id : null;
  const candidates = record.initial.players
    .map((player, index) => ({ player, index, pose: beforeGoal.players[index]! }))
    .filter(
      ({ player, pose }) =>
        player.team === goal.team &&
        !pose.dismissed &&
        (player.role !== 'keeper' || player.id === scorerId),
    );
  const scorer = candidates.find(({ player }) => player.id === scorerId);
  const nearestToGoal = [...candidates].sort(
    (first, second) =>
      distanceBetween(first.pose.position, beforeGoal.ball) -
      distanceBetween(second.pose.position, beforeGoal.ball),
  )[0];
  const leader = scorer ?? nearestToGoal;
  if (!leader) return unchanged;

  const center = {
    x: clamp(
      leader.pose.position.x,
      GOAL_PRESENTATION.huddleRadius,
      FIELD.length - GOAL_PRESENTATION.huddleRadius,
    ),
    y: clamp(
      leader.pose.position.y + 3,
      GOAL_PRESENTATION.huddleRadius + 3,
      FIELD.width - GOAL_PRESENTATION.huddleRadius - 3,
    ),
  };
  const teammates = [
    leader,
    ...candidates
      .filter(({ player }) => player.id !== leader.player.id)
      .sort(
        (first, second) =>
          distanceBetween(first.pose.position, center) -
          distanceBetween(second.pose.position, center),
      ),
  ].slice(0, GOAL_PRESENTATION.teammates);
  const gathering = ageTicks / GOAL_PRESENTATION.gatheringTicks;
  const returning =
    (ageTicks - GOAL_PRESENTATION.returnStartsTicks) /
    (GOAL_PRESENTATION.durationTicks - GOAL_PRESENTATION.returnStartsTicks);
  const returnDuration = GOAL_PRESENTATION.durationTicks - GOAL_PRESENTATION.returnStartsTicks;
  const players = beforeGoal.players.map((pose, index) =>
    movingPose(pose, pose.position, frame.players[index]!.position, returning, returnDuration),
  );

  teammates.forEach(({ player, index, pose }, huddleIndex) => {
    // Teammates form a semicircle behind the scorer, leaving the landing and face readable.
    const angle = Math.PI + ((huddleIndex - 0.5) * Math.PI) / Math.max(1, teammates.length - 1);
    const target =
      huddleIndex === 0
        ? center
        : {
            x: center.x + Math.cos(angle) * GOAL_PRESENTATION.huddleRadius,
            y: center.y + Math.sin(angle) * GOAL_PRESENTATION.huddleRadius,
          };
    const gathered = movingPose(
      pose,
      pose.position,
      target,
      gathering,
      GOAL_PRESENTATION.gatheringTicks,
    );
    if (returning > 0) {
      players[index] = movingPose(
        gathered,
        target,
        frame.players[index]!.position,
        returning,
        returnDuration,
      );
    } else {
      players[index] = gathered;
      if (gathering >= 1) {
        playerIds.add(player.id);
        players[index] = {
          ...gathered,
          facing:
            huddleIndex === 0
              ? { x: 0, y: 1 }
              : unitVector({ x: center.x - target.x, y: center.y - target.y }),
        };
      }
    }
  });

  const ballProgress = easedProgress(returning);
  return {
    frame: {
      ...frame,
      players,
      ball: {
        ...between(beforeGoal.ball, frame.ball, ballProgress),
        z: beforeGoal.ball.z + (frame.ball.z - beforeGoal.ball.z) * ballProgress,
      },
      owner: null,
    },
    playerIds,
    scorerId,
    ageTicks,
    focus: center,
  };
}
