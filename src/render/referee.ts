import { keeperCountdown } from './keeper.ts';
import type { Frame, Recording } from '../recording/record.ts';
import type { MatchEvent, Vec2 } from '../sim/types.ts';
import { clamp } from '../sim/math.ts';
import { FIELD, TICK_RATE } from '../sim/rules.ts';
import { worldToScreen } from './layout.ts';
import { drawPixelRect } from './pixels.ts';

const REFEREE = {
  maximumSpeed: 6,
  acceleration: 10,
  ballOffset: { x: -8, y: 9 },
  boundaryInset: 6,
  incidentDistance: 3,
  cardTicks: 2.5 * TICK_RATE,
  gestureTicks: 1.4 * TICK_RATE,
  cardRaiseTicks: 12,
  whistleTicks: 30,
  framesPerMetre: 2.2,
  movingThreshold: 0.2,
} as const;
const KIT = {
  outline: '#132c36',
  shirt: '#d6df87',
  highlight: '#f0efb4',
  shade: '#92a160',
  shorts: '#27373e',
  shell: '#e4e5d4',
  visor: '#173442',
  eyes: '#f4ffdf',
} as const;
type RefereeSignal = {
  type: 'yellow_card' | 'red_card' | 'whistle' | 'point';
  tick: number;
  target: Vec2;
};
type RefereePose = {
  position: Vec2;
  velocity: Vec2;
  facing: Vec2;
  distanceTravelled: number;
  signal: RefereeSignal | null;
};
export type RefereeTrack = readonly RefereePose[];

function insidePitch(position: Vec2): Vec2 {
  return {
    x: clamp(position.x, REFEREE.boundaryInset, FIELD.length - REFEREE.boundaryInset),
    y: clamp(position.y, REFEREE.boundaryInset, FIELD.width - REFEREE.boundaryInset),
  };
}
function patrolTarget(frame: Frame): Vec2 {
  return insidePitch({
    x: frame.ball.x + REFEREE.ballOffset.x,
    y: frame.ball.y + REFEREE.ballOffset.y,
  });
}
function incidentSignal(
  event: MatchEvent,
  frame: Frame,
  recording: Recording,
): RefereeSignal | null {
  const playerIndex = recording.initial.players.findIndex((player) => player.id === event.playerId);
  const incident = frame.players[playerIndex]?.position ?? frame.ball;
  switch (event.type) {
    case 'yellow_card':
    case 'red_card':
      return { type: event.type, tick: event.tick, target: { x: incident.x, y: incident.y } };
    case 'keeper_violation':
    case 'foul':
    case 'offside':
    case 'restart_ready':
    case 'halftime':
    case 'full_time':
    case 'abandoned':
      return { type: 'whistle', tick: event.tick, target: { x: incident.x, y: incident.y } };
    case 'goal':
      return {
        type: 'point',
        tick: event.tick,
        target: { x: FIELD.length / 2, y: FIELD.width / 2 },
      };
    default:
      return null;
  }
}

/** A causal presentation track, computed once. It has no collision or referee-rule authority. */
export function createRefereeTrack(recording: Recording): RefereeTrack {
  const track: RefereePose[] = [
    {
      position: patrolTarget(recording.frames[0]!),
      velocity: { x: 0, y: 0 },
      facing: { x: 0.65, y: -0.76 },
      distanceTravelled: 0,
      signal: null,
    },
  ];
  let frameIndex = 0;
  let eventIndex = 0;
  let signal: RefereeSignal | null = null;
  const abandonmentTick = recording.frames.find(
    (frame) => frame.phase.type === 'full_time' && frame.phase.reason === 'abandoned',
  )?.tick;
  for (let tick = 1; tick <= recording.durationTicks; tick++) {
    // Only earlier samples/incidents contribute. Future ball resets or goals cannot
    // bend an earlier portion of the route, even though the whole track is prepared.
    while (recording.frames[frameIndex + 1] && recording.frames[frameIndex + 1]!.tick < tick)
      frameIndex++;
    const observed = recording.frames[frameIndex]!;
    while (recording.events[eventIndex]) {
      const event = recording.events[eventIndex]!;
      // Clock transitions are stamped after the tick increments; physical incidents are not.
      const clockSignal =
        event.type === 'restart_ready' || event.type === 'halftime' || event.type === 'full_time';
      // Abandonment can happen inside a foul step or after a delivery timeout.
      const visibleTick =
        event.type === 'abandoned'
          ? (abandonmentTick ?? event.tick + 1)
          : event.tick + (clockSignal ? 0 : 1);
      if (visibleTick > tick) break;
      eventIndex++;
      const nextSignal = incidentSignal(event, observed, recording);
      if (nextSignal) signal = nextSignal;
    }
    const card = signal?.type === 'yellow_card' || signal?.type === 'red_card';
    if (signal && tick - signal.tick >= (card ? REFEREE.cardTicks : REFEREE.gestureTicks))
      signal = null;
    const previous = track[tick - 1]!;
    let target = patrolTarget(observed);
    // A new signal can be displayed now, but cannot influence movement before this tick.
    const guidingSignal = previous.signal;
    const guidingCard = guidingSignal?.type === 'yellow_card' || guidingSignal?.type === 'red_card';
    if (
      guidingSignal &&
      tick - guidingSignal.tick < (guidingCard ? REFEREE.cardTicks : REFEREE.gestureTicks)
    ) {
      const offsetX = previous.position.x - guidingSignal.target.x;
      const offsetY = previous.position.y - guidingSignal.target.y;
      const distance = Math.hypot(offsetX, offsetY);
      target = insidePitch({
        x:
          guidingSignal.target.x +
          (distance > 0 ? offsetX / distance : 0) * REFEREE.incidentDistance,
        y:
          guidingSignal.target.y +
          (distance > 0 ? offsetY / distance : 1) * REFEREE.incidentDistance,
      });
    }
    const toTarget = { x: target.x - previous.position.x, y: target.y - previous.position.y };
    const distance = Math.hypot(toTarget.x, toTarget.y);
    const desiredSpeed = Math.min(
      REFEREE.maximumSpeed,
      Math.sqrt(2 * REFEREE.acceleration * distance),
    );
    const desired =
      distance > 0.05
        ? { x: (toTarget.x / distance) * desiredSpeed, y: (toTarget.y / distance) * desiredSpeed }
        : { x: 0, y: 0 };
    const change = { x: desired.x - previous.velocity.x, y: desired.y - previous.velocity.y };
    const changeMagnitude = Math.hypot(change.x, change.y);
    const changeFraction =
      changeMagnitude > 0 ? Math.min(1, REFEREE.acceleration / TICK_RATE / changeMagnitude) : 0;
    const velocity = {
      x: previous.velocity.x + change.x * changeFraction,
      y: previous.velocity.y + change.y * changeFraction,
    };
    const position = insidePitch({
      x: previous.position.x + velocity.x / TICK_RATE,
      y: previous.position.y + velocity.y / TICK_RATE,
    });
    const speed = Math.hypot(velocity.x, velocity.y);
    const lookingAt = signal?.target ?? observed.ball;
    const looking =
      signal || speed < REFEREE.movingThreshold
        ? { x: lookingAt.x - position.x, y: lookingAt.y - position.y }
        : velocity;
    const lookingDistance = Math.hypot(looking.x, looking.y);
    const facing =
      lookingDistance > 0.05
        ? { x: looking.x / lookingDistance, y: looking.y / lookingDistance }
        : previous.facing;
    track.push({
      position,
      velocity,
      facing,
      distanceTravelled:
        previous.distanceTravelled +
        Math.hypot(position.x - previous.position.x, position.y - previous.position.y),
      signal,
    });
  }
  return track;
}

/** Stateless sampling makes pause, playback speed and arbitrary seeking repeatable. */
export function sampleReferee(track: RefereeTrack, tick: number): RefereePose {
  const boundedTick = clamp(tick, 0, track.length - 1);
  const before = track[Math.floor(boundedTick)]!;
  const after = track[Math.min(Math.floor(boundedTick) + 1, track.length - 1)]!;
  const fraction = boundedTick - Math.floor(boundedTick);
  const interpolate = (first: number, second: number) => first + (second - first) * fraction;
  return {
    ...before,
    position: {
      x: interpolate(before.position.x, after.position.x),
      y: interpolate(before.position.y, after.position.y),
    },
    velocity: {
      x: interpolate(before.velocity.x, after.velocity.x),
      y: interpolate(before.velocity.y, after.velocity.y),
    },
    distanceTravelled: interpolate(before.distanceTravelled, after.distanceTravelled),
  };
}

export function drawReferee(
  context: CanvasRenderingContext2D,
  frame: Frame,
  track: RefereeTrack,
  reducedMotion: boolean,
): void {
  const pose = sampleReferee(track, frame.tick);
  const anchor = worldToScreen(pose.position);
  const speed = Math.hypot(pose.velocity.x, pose.velocity.y);
  const running = speed > REFEREE.movingThreshold && !reducedMotion;
  const runFrame = running ? Math.floor(pose.distanceTravelled * REFEREE.framesPerMetre) % 4 : 0;
  const stride = running ? [2, 0, -2, 0][runFrame]! : 0;
  const bodyBob = running && runFrame % 2 === 1 ? -1 : 0;
  const lean = reducedMotion ? 0 : Math.round(pose.velocity.x / REFEREE.maximumSpeed);
  const facingSide = Math.abs(pose.facing.x) > 0.3 ? Math.sign(pose.facing.x) : 0;
  const facingAway = pose.facing.y < -0.7;
  const signal = pose.signal;
  const age = signal ? frame.tick - signal.tick : 0;
  const countdown = keeperCountdown(frame);
  const counting = countdown !== null;
  const showingCard = signal?.type === 'yellow_card' || signal?.type === 'red_card';
  const whistling = signal?.type === 'whistle' && (reducedMotion || age < REFEREE.whistleTicks);
  const pointing = signal?.type === 'point' || (signal?.type === 'whistle' && !whistling);
  const gestureSide = !counting && pointing && pose.facing.x < 0 ? -1 : 1;
  const pixel = (x: number, y: number, width: number, height: number, color: string) =>
    drawPixelRect(context, anchor.x + x, anchor.y + y, width, height, color);
  context.save();
  context.globalAlpha = 0.3;
  pixel(-6, 0, 13, 3, '#103d32');
  context.restore();
  for (const side of [-1, 1]) {
    const footX = side * 3 + (running ? Math.round((side * stride * pose.velocity.x) / speed) : 0);
    const footY = side * stride;
    pixel(footX - 1, footY - 5, 3, 5, KIT.outline);
    pixel(footX - 1, footY - 3, 2, 2, KIT.shirt);
    pixel(footX - 2, footY, 4, 2, KIT.outline);
    pixel(footX - 1, footY, 2, 1, '#cad9c3');
    if (side === gestureSide && (showingCard || counting || whistling || pointing)) continue;
    pixel(lean + side * 7 - 1, -11 + side * stride + bodyBob, 3, 6, KIT.outline);
    pixel(lean + side * 7, -10 + side * stride + bodyBob, 2, 4, KIT.shade);
    pixel(lean + side * 7 - 1, -5 + side * stride + bodyBob, 3, 2, KIT.shell);
  }
  pixel(-5 + lean, -12 + bodyBob, 11, 10, KIT.outline);
  pixel(-4 + lean, -11 + bodyBob, 9, 7, KIT.shirt);
  pixel(-3 + lean, -11 + bodyBob, 7, 2, KIT.highlight);
  pixel(-4 + lean, -4 + bodyBob, 9, 3, KIT.shorts);
  pixel(-3 + lean, -8 + bodyBob, 3, 3, '#edf2d2');
  pixel(-2 + lean, -7 + bodyBob, 1, 1, KIT.outline);
  pixel(2 + lean, -9 + bodyBob, 1, 4, KIT.outline); // Whistle cord.
  pixel(1 + lean, -6 + bodyBob, 3, 1, '#dce4d0');
  const headX = lean + facingSide;
  pixel(-6 + headX, -23 + bodyBob, 13, 12, KIT.outline);
  pixel(-5 + headX, -22 + bodyBob, 11, 9, KIT.shell);
  pixel(-4 + headX, -21 + bodyBob, 9, 2, '#f5f1d9');
  pixel(-7 + headX, -18 + bodyBob, 2, 4, KIT.shade);
  pixel(6 + headX, -18 + bodyBob, 2, 4, KIT.shade);
  if (facingAway && !signal) {
    pixel(-3 + headX, -18 + bodyBob, 7, 4, '#859795');
    pixel(-2 + headX, -16 + bodyBob, 5, 1, KIT.outline);
  } else {
    pixel(-4 + headX + facingSide, -19 + bodyBob, 9, 6, KIT.visor);
    const blink = !reducedMotion && !signal && Math.floor(frame.tick + 137) % 270 < 4;
    for (const eye of [-2, 2])
      pixel(eye + headX + facingSide, -17 + bodyBob, 2, blink ? 1 : 2, KIT.eyes);
    if (showingCard) pixel(-3 + headX + facingSide, -19 + bodyBob, 7, 1, KIT.shade);
  }
  pixel(headX, -26 + bodyBob, 1, 3, KIT.outline);
  pixel(headX - 1, -27 + bodyBob, 3, 2, KIT.shirt);
  if (showingCard) {
    const raise = reducedMotion ? 1 : Math.min(1, age / REFEREE.cardRaiseTicks);
    const handY = -12 - Math.round(raise * 11);
    pixel(6 + lean, handY, 3, -8 - handY, KIT.outline);
    pixel(7 + lean, handY + 2, 2, -11 - handY, KIT.shirt);
    pixel(6 + lean, handY - 1, 3, 3, KIT.shell);
    pixel(5 + lean, handY - 8, 6, 8, KIT.outline);
    pixel(6 + lean, handY - 7, 4, 6, signal.type === 'red_card' ? '#f46e65' : '#ffe06a');
  } else if (counting) {
    pixel(6 + lean, -23, 3, 15, KIT.outline);
    pixel(7 + lean, -21, 2, 11, KIT.shirt);
    pixel(6 + lean, -25, 4, 4, KIT.shell);
    // A small count accompanies the raised hand; no persistent spectator HUD is needed.
    pixel(3 + lean, -39, 11, 11, KIT.outline);
    context.fillStyle = KIT.highlight;
    context.textAlign = 'center';
    context.font = '9px monospace';
    context.fillText(String(countdown), anchor.x + 8 + lean, anchor.y - 30);
  } else if (whistling) {
    pixel(6 + lean, -12 + bodyBob, 3, 7, KIT.outline);
    pixel(3 + lean, -14 + bodyBob, 5, 3, KIT.shade);
    pixel(3 + lean, -15 + bodyBob, 3, 2, KIT.shell);
    pixel(2 + lean, -16 + bodyBob, 4, 2, '#dbe9dc');
    if (!reducedMotion && Math.floor(age / 6) % 2 === 0) {
      pixel(10, -18, 2, 1, '#e8efc6');
      pixel(11, -15, 2, 1, '#e8efc6');
    }
  } else if (pointing) {
    const direction = pose.facing.x < 0 ? -1 : 1;
    pixel(direction < 0 ? -13 : 6, -11 + bodyBob, 8, 3, KIT.outline);
    pixel(direction < 0 ? -12 : 7, -10 + bodyBob, 6, 1, KIT.shirt);
    pixel(direction < 0 ? -15 : 13, -11 + bodyBob, 3, 2, KIT.shell);
  }
}
