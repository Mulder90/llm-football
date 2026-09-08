import { sample } from '../recording/record.ts';
import type { Frame, PlayerFrame, Recording } from '../recording/record.ts';
import { BALL_CONTROL, FIELD, TICK_RATE } from '../sim/rules.ts';
import { clamp, distanceBetween, unitVector } from '../sim/math.ts';
import type { MatchEvent, Team, Vec2 } from '../sim/types.ts';

const GOAL_RECORDING_TICKS = 1.85 * TICK_RATE;
const GOAL_WATCH_SECONDS = 9;
const GATHERING_END_SECONDS = 3.25;

export const GOAL_PRESENTATION = {
  durationTicks: GOAL_RECORDING_TICKS,
  watchDurationSeconds: GOAL_WATCH_SECONDS,
  impactEndSeconds: 0.45,
  approachStartSeconds: 0.85,
  gatheringEndSeconds: GATHERING_END_SECONDS,
  transitionStartSeconds: 7.1,
  transitionMiddleSeconds: 8,
  transitionEndSeconds: 8.9,
  gatheringTicks: (GATHERING_END_SECONDS / GOAL_WATCH_SECONDS) * GOAL_RECORDING_TICKS,
  bannerArrivalTicks: 0.16 * TICK_RATE,
  bannerDepartureTicks: 0.25 * TICK_RATE,
  teammates: 5,
  huddleRadius: 6,
  cornerInsetMetres: 3,
  approachLengthMetres: 16,
  teammateDelaySeconds: 0.14,
} as const;

export function goalWatchSeconds(ageTicks: number): number {
  return (ageTicks / GOAL_PRESENTATION.durationTicks) * GOAL_PRESENTATION.watchDurationSeconds;
}

/** The covered midpoint is a TV cut, never a fast run back across the pitch. */
export function goalTransitionOpacity(watchAgeSeconds: number): number {
  const cover = (start: number, middle: number, end: number, holdSeconds: number) => {
    return easedProgress(
      Math.min(
        (watchAgeSeconds - start) / (middle - start - holdSeconds),
        (end - watchAgeSeconds) / (end - middle - holdSeconds),
      ),
    );
  };
  return Math.max(
    // The HUD refreshes at 10 Hz while the pitch draws every frame; cover both sides of the cut.
    cover(GOAL_PRESENTATION.impactEndSeconds, 0.65, GOAL_PRESENTATION.approachStartSeconds, 0.12),
    cover(
      GOAL_PRESENTATION.transitionStartSeconds,
      GOAL_PRESENTATION.transitionMiddleSeconds,
      GOAL_PRESENTATION.transitionEndSeconds,
      0.3,
    ),
  );
}

export type CelebrationGesture = {
  phase: 'windup' | 'jump' | 'landing' | 'salute' | 'support';
  jump: number;
  crouch: number;
  facingAway: boolean;
  armPose: 'raised' | 'wide' | 'pump';
  footSpread: number;
  landingPulse: number;
};

function powerUpGesture(settledAge: number): CelebrationGesture {
  const chargeTicks = 8;
  const hopTicks = 12;
  const restTicks = 7;
  const firstHop = settledAge - chargeTicks;
  const secondHop = firstHop - hopTicks - restTicks;
  const hopAge = secondHop >= 0 ? secondHop : firstHop;
  const jumping = hopAge >= 0 && hopAge < hopTicks;
  const landingAge = hopAge - hopTicks;
  const landingTicks = 6;
  const landing = landingAge >= 0 && landingAge < landingTicks;
  return {
    phase: settledAge < chargeTicks ? 'windup' : jumping ? 'jump' : landing ? 'landing' : 'salute',
    jump: jumping ? Math.sin((hopAge / hopTicks) * Math.PI) * 8 : 0,
    crouch: settledAge < chargeTicks ? 2 : landing ? 2 * (1 - landingAge / landingTicks) : 0,
    facingAway: false,
    armPose: 'pump',
    footSpread: 1,
    landingPulse: landing ? (1 - landingAge / landingTicks) * 0.65 : 0,
  };
}

/** Cyan turns and lands wide; Coral powers up with two small, fist-raised hops. */
export function celebrationGesture(
  ageTicks: number,
  scorer: boolean,
  playerNumber: number,
  team: Team,
): CelebrationGesture {
  const settledAge = ageTicks - GOAL_PRESENTATION.gatheringTicks;
  const windupTicks = 9;
  const flightTicks = 19;
  const landingTicks = 9;
  const flight = clamp((settledAge - windupTicks) / flightTicks, 0, 1);
  const landingAge = settledAge - windupTicks - flightTicks;
  if (!scorer) {
    const reply = Math.max(
      0,
      (team === 'coral' ? settledAge - 8 : landingAge) - (playerNumber % 3) * 2,
    );
    return {
      phase: 'support',
      jump:
        reply > 0 && reply < 12 ? Math.sin((reply / 12) * Math.PI) * (team === 'coral' ? 2 : 4) : 0,
      crouch: 0,
      facingAway: false,
      armPose: team === 'coral' ? 'pump' : playerNumber % 2 === 0 ? 'raised' : 'pump',
      footSpread: 0,
      landingPulse: 0,
    };
  }
  if (team === 'coral') return powerUpGesture(settledAge);
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
  participantIds: ReadonlySet<string>;
  scorerId: string | null;
  ageTicks: number;
  focus: Vec2 | null;
  corner: Vec2 | null;
  goal: MatchEvent | null;
  watchAgeSeconds: number;
  transitionOpacity: number;
  canonical: boolean;
  gestureAges: ReadonlyMap<string, number>;
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

/** Cosmetic velocity is measured in watch seconds so the approach has a readable running gait. */
function movingPose(
  pose: PlayerFrame,
  start: Vec2,
  end: Vec2,
  progress: number,
  durationSeconds: number,
): PlayerFrame {
  const bounded = clamp(progress, 0, 1);
  const eased = easedProgress(bounded);
  const speedFactor = (6 * bounded * (1 - bounded)) / durationSeconds;
  const offset = { x: end.x - start.x, y: end.y - start.y };
  return {
    ...pose,
    position: between(start, end, eased),
    velocity: { x: offset.x * speedFactor, y: offset.y * speedFactor },
    facing: distanceBetween(start, end) > 0.01 ? unitVector(offset) : pose.facing,
    distanceTravelled: pose.distanceTravelled + distanceBetween(start, end) * eased,
  };
}

/** A stopped-clock corner montage, prepared once and shared by the broadcast layers. */
export function celebrationFrame(
  record: Recording,
  frame: Frame,
  reducedMotion: boolean,
): CelebrationFrame {
  const playerIds = new Set<string>();
  const gestureAges = new Map<string, number>();
  const unchanged: CelebrationFrame = {
    frame,
    playerIds,
    participantIds: new Set(),
    scorerId: null,
    ageTicks: 0,
    focus: null,
    corner: null,
    goal: null,
    watchAgeSeconds: 0,
    transitionOpacity: 0,
    canonical: true,
    gestureAges,
  };
  const moment = activeGoal(record, frame);
  if (!moment) return unchanged;
  const { event: goal, ageTicks } = moment;
  const watchAgeSeconds = goalWatchSeconds(ageTicks);
  const information = { goal, ageTicks, watchAgeSeconds };
  if (reducedMotion) return { ...unchanged, ...information };
  const transitionOpacity = goalTransitionOpacity(watchAgeSeconds);
  if (watchAgeSeconds >= GOAL_PRESENTATION.transitionMiddleSeconds)
    return { ...unchanged, ...information, transitionOpacity };

  const beforeGoal = sample(record, Math.max(0, goal.tick - 1) / TICK_RATE);
  const lastTouch = record.initial.players.find((player) => player.id === goal.playerId);
  // An own goal belongs to the awarded team; the defender never celebrates with them.
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
        distanceBetween(second.pose.position, beforeGoal.ball) ||
      first.player.id.localeCompare(second.player.id),
  )[0];
  const leader = scorer ?? nearestToGoal;
  if (!leader) return unchanged;

  const firstHalfDirection = goal.team === 'coral' ? 1 : -1;
  const direction = frame.half === 1 ? firstHalfDirection : -firstHalfDirection;
  const corner = {
    x: direction === 1 ? FIELD.length : 0,
    y: leader.pose.position.y < FIELD.width / 2 ? 0 : FIELD.width,
  };
  const inward = { x: -direction, y: corner.y === 0 ? 1 : -1 };
  const center = {
    x: corner.x + inward.x * GOAL_PRESENTATION.cornerInsetMetres,
    y: corner.y + inward.y * GOAL_PRESENTATION.cornerInsetMetres,
  };
  const teammates = [
    leader,
    ...candidates
      .filter(({ player }) => player.id !== leader.player.id)
      .sort(
        (first, second) =>
          distanceBetween(first.pose.position, center) -
            distanceBetween(second.pose.position, center) ||
          first.player.id.localeCompare(second.player.id),
      ),
  ].slice(0, GOAL_PRESENTATION.teammates);
  const players = beforeGoal.players.map((pose) => ({ ...pose, velocity: { x: 0, y: 0 } }));
  const openingCutSeconds =
    (GOAL_PRESENTATION.impactEndSeconds + GOAL_PRESENTATION.approachStartSeconds) / 2;

  if (watchAgeSeconds >= openingCutSeconds) {
    teammates.forEach(({ player, index, pose }, huddleIndex) => {
      // The four teammates fan inward, leaving the flag and scorer's face clear.
      const angle =
        Math.atan2(inward.y, inward.x) +
        ((huddleIndex - 1) / Math.max(1, teammates.length - 2) - 0.5) * Math.PI * 0.5;
      const target =
        huddleIndex === 0
          ? center
          : {
              x: center.x + Math.cos(angle) * GOAL_PRESENTATION.huddleRadius,
              y: center.y + Math.sin(angle) * GOAL_PRESENTATION.huddleRadius,
            };
      const distance = distanceBetween(pose.position, target);
      const approachLength = Math.min(distance, GOAL_PRESENTATION.approachLengthMetres);
      const heading = unitVector({ x: pose.position.x - target.x, y: pose.position.y - target.y });
      // The opening wipe cuts to the last stretch of the run, including for long-range scorers.
      const start = {
        x: target.x + heading.x * approachLength,
        y: target.y + heading.y * approachLength,
      };
      const delay = huddleIndex * GOAL_PRESENTATION.teammateDelaySeconds;
      const arrival = GOAL_PRESENTATION.gatheringEndSeconds + delay;
      const duration = arrival - GOAL_PRESENTATION.approachStartSeconds - delay;
      const progress =
        (watchAgeSeconds - GOAL_PRESENTATION.approachStartSeconds - delay) / duration;
      const gathered = movingPose(pose, start, target, progress, duration);
      players[index] = gathered;
      if (watchAgeSeconds >= arrival) {
        playerIds.add(player.id);
        gestureAges.set(
          player.id,
          ageTicks -
            (delay / GOAL_PRESENTATION.watchDurationSeconds) * GOAL_PRESENTATION.durationTicks,
        );
        players[index] = {
          ...gathered,
          facing:
            huddleIndex === 0
              ? { x: 0, y: 1 }
              : unitVector({ x: center.x - target.x, y: center.y - target.y }),
        };
      }
    });
  }

  // The confirmed goal carries the ball over the line and settles it inside the net.
  // Only the visible goal and past contact position are used; restart frames are never sampled ahead.
  const netPoint = {
    x: (direction === 1 ? FIELD.length : 0) + direction * 1.15,
    y: clamp(
      beforeGoal.ball.y,
      (FIELD.width - FIELD.goalWidth) / 2 + 0.2,
      (FIELD.width + FIELD.goalWidth) / 2 - 0.2,
    ),
  };
  const impact = easedProgress(watchAgeSeconds / GOAL_PRESENTATION.impactEndSeconds);
  return {
    frame: {
      ...frame,
      players,
      ball: {
        ...between(beforeGoal.ball, netPoint, impact),
        z: beforeGoal.ball.z * (1 - impact) + BALL_CONTROL.radius * impact,
      },
      owner: null,
    },
    playerIds,
    participantIds: new Set(teammates.map(({ player }) => player.id)),
    scorerId,
    ageTicks,
    focus: center,
    corner,
    goal,
    watchAgeSeconds,
    transitionOpacity,
    canonical: false,
    gestureAges,
  };
}
