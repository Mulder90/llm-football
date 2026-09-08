import { sample } from '../recording/record.ts';
import type { Frame, Recording } from '../recording/record.ts';
import { clamp } from '../sim/math.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { Vec2 } from '../sim/types.ts';
import { activeGoal, celebrationFrame, GOAL_PRESENTATION } from './celebration.ts';
import { PITCH_LAYOUT, STADIUM_SIZE } from './layout.ts';

/** View centre in logical stadium pixels; zoom keeps the pitch flat and orthographic. */
export type Camera = { x: number; y: number; zoom: number };
const CAMERA = {
  playZoom: 1.12,
  goalZoom: 1.24,
  historySeconds: 0.35,
  historyWeight: 0.3,
  anticipationSeconds: 0.2,
  followFraction: 0.13,
  goalFollowFraction: 0.4,
  frameMarginPixels: 22,
} as const;

function screenPoint(point: Vec2): Vec2 {
  return {
    x: PITCH_LAYOUT.left + point.x * PITCH_LAYOUT.pixelsPerMetre,
    y: PITCH_LAYOUT.top + point.y * PITCH_LAYOUT.pixelsPerMetre,
  };
}

function smooth(progress: number): number {
  const bounded = clamp(progress, 0, 1);
  return bounded * bounded * (3 - 2 * bounded);
}

/** Fixed past samples provide smoothing and a little lead without depending on drawing cadence. */
export function cameraAt(
  recording: Recording,
  frame: Frame,
  wholePitch: boolean,
  reducedMotion: boolean,
): Camera {
  const wide = { x: STADIUM_SIZE.width / 2, y: STADIUM_SIZE.height / 2, zoom: 1 };
  if (
    wholePitch ||
    reducedMotion ||
    frame.phase.type === 'halftime' ||
    frame.phase.type === 'full_time'
  )
    return wide;
  const previous = sample(recording, Math.max(0, frame.tick / TICK_RATE - CAMERA.historySeconds));
  const samePhase =
    previous.phase.sinceTick === frame.phase.sinceTick && previous.phase.type === frame.phase.type;
  const pastBall = samePhase ? previous.ball : frame.ball;
  const lead = CAMERA.anticipationSeconds / CAMERA.historySeconds;
  let focus = screenPoint({
    x: frame.ball.x + (frame.ball.x - pastBall.x) * (lead - CAMERA.historyWeight),
    y: frame.ball.y + (frame.ball.y - pastBall.y) * (lead - CAMERA.historyWeight),
  });
  let zoom: number = CAMERA.playZoom;
  let follow = CAMERA.followFraction;
  let required = [
    { x: PITCH_LAYOUT.left, y: PITCH_LAYOUT.top },
    { x: PITCH_LAYOUT.left + PITCH_LAYOUT.width, y: PITCH_LAYOUT.top + PITCH_LAYOUT.height },
  ];
  const goal = activeGoal(recording, frame);
  if (goal) {
    const previousPlay = sample(recording, Math.max(0, goal.event.tick - 1) / TICK_RATE);
    const celebration = celebrationFrame(recording, frame, false);
    const goalPoint = screenPoint(previousPlay.ball);
    const huddle = screenPoint(celebration.focus ?? previousPlay.ball);
    const envelope = smooth(
      Math.min(
        goal.ageTicks / GOAL_PRESENTATION.gatheringTicks,
        (GOAL_PRESENTATION.durationTicks - goal.ageTicks) /
          (GOAL_PRESENTATION.durationTicks - GOAL_PRESENTATION.returnStartsTicks),
      ),
    );
    const destination = { x: (goalPoint.x + huddle.x) / 2, y: (goalPoint.y + huddle.y) / 2 };
    focus = {
      x: focus.x + (destination.x - focus.x) * envelope,
      y: focus.y + (destination.y - focus.y) * envelope,
    };
    zoom += (CAMERA.goalZoom - CAMERA.playZoom) * envelope;
    follow += (CAMERA.goalFollowFraction - CAMERA.followFraction) * envelope;
    const huddleRadius = GOAL_PRESENTATION.huddleRadius * PITCH_LAYOUT.pixelsPerMetre;
    required = [
      goalPoint,
      { x: huddle.x - huddleRadius, y: huddle.y - huddleRadius },
      { x: huddle.x + huddleRadius, y: huddle.y + huddleRadius },
      screenPoint(celebration.frame.ball),
    ];
  }
  const margin = CAMERA.frameMarginPixels;
  // A long-range scorer and the net can be far apart; widen to include both.
  const requiredWidth =
    Math.max(...required.map((point) => point.x)) - Math.min(...required.map((point) => point.x));
  const requiredHeight =
    Math.max(...required.map((point) => point.y)) - Math.min(...required.map((point) => point.y));
  zoom = Math.min(
    zoom,
    STADIUM_SIZE.width / (requiredWidth + margin * 2),
    STADIUM_SIZE.height / (requiredHeight + margin * 2),
  );
  const halfWidth = STADIUM_SIZE.width / zoom / 2;
  const halfHeight = STADIUM_SIZE.height / zoom / 2;
  // Constrain the scene to the canvas and preserve the ball/goal action inside its frame.
  const minimumX = Math.max(halfWidth, ...required.map((point) => point.x + margin - halfWidth));
  const maximumX = Math.min(
    STADIUM_SIZE.width - halfWidth,
    ...required.map((point) => point.x - margin + halfWidth),
  );
  const minimumY = Math.max(halfHeight, ...required.map((point) => point.y + margin - halfHeight));
  const maximumY = Math.min(
    STADIUM_SIZE.height - halfHeight,
    ...required.map((point) => point.y - margin + halfHeight),
  );
  return {
    x: clamp(wide.x + (focus.x - wide.x) * follow, minimumX, maximumX),
    y: clamp(wide.y + (focus.y - wide.y) * follow, minimumY, maximumY),
    zoom,
  };
}
