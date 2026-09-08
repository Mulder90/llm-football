import { sample } from '../recording/record.ts';
import type { Frame, Recording } from '../recording/record.ts';
import { FIELD, TICK_RATE } from '../sim/rules.ts';
import type { MatchEvent, Team, Vec2 } from '../sim/types.ts';
import { GOAL_PRESENTATION } from './celebration.ts';

/** A presentation cue derived from an actual outcome, never from a controller's intent. */
export type FootballMoment = {
  id: string;
  /** First visible boundary: physical events belong to the step ending at event.tick + 1. */
  tick: number;
  type: 'goal' | 'save' | 'near-miss' | 'good-pass';
  team: Team;
  playerId: string | null;
  otherPlayerId: string | null;
  position: Vec2;
};

export type MatchAtmosphere = {
  attack: { team: Team; intensity: number } | null;
  moment: FootballMoment | null;
};

const ANTICIPATION = {
  attackingZoneDepth: 45,
  looseBallMemoryTicks: 3 * TICK_RATE,
  buildupSampleTicks: 6,
  buildupSamples: 7,
  minimumPassDistance: 6,
  nearMissGoalMargin: 3,
  nearMissHeightMargin: 1.5,
  nearMissBoundaryDistance: 2,
  maximumShotFlightTicks: 6 * TICK_RATE,
} as const;

export const MOMENT_DURATION_TICKS = {
  goal: GOAL_PRESENTATION.durationTicks,
  save: 1.4 * TICK_RATE,
  'near-miss': 1.25 * TICK_RATE,
  'good-pass': 0.65 * TICK_RATE,
} as const;

function teamOf(recording: Recording, playerId: string | null): Team | undefined {
  return recording.initial.players.find((player) => player.id === playerId)?.team;
}

function attacksRight(team: Team, half: 1 | 2): boolean {
  return (team === 'coral') === (half === 1);
}

/** One chronological pass preserves causality even when a later rebound becomes a goal. */
export function createFootballMoments(recording: Recording): FootballMoment[] {
  const moments: FootballMoment[] = [];
  let lastKick: { event: MatchEvent; position: Vec2 } | null = null;
  let shot: MatchEvent | null = null;
  let frameIndex = 0;
  for (const event of recording.events) {
    while (
      frameIndex + 1 < recording.frames.length &&
      recording.frames[frameIndex + 1]!.tick <= event.tick
    )
      frameIndex++;
    // The pre-event sample still holds the flight position, before a restart resets the ball.
    const before = recording.frames[frameIndex]!;
    const playerIndex = recording.initial.players.findIndex(
      (player) => player.id === event.playerId,
    );
    const position = { ...(before.players[playerIndex]?.position ?? before.ball) };
    const team = event.team ?? teamOf(recording, event.playerId);
    const add = (
      type: FootballMoment['type'],
      side: Team,
      playerId = event.playerId,
      otherPlayerId: string | null = null,
    ) => {
      moments.push({
        id: `${type}:${event.id}`,
        tick: event.tick + 1,
        type,
        team: side,
        playerId,
        otherPlayerId,
        position,
      });
    };

    if (event.type === 'goal' && team) add('goal', team);
    if (event.type === 'save' && team) add('save', team, event.playerId, shot?.playerId ?? null);
    if (event.type === 'receive' && lastKick && team) {
      const giver = lastKick.event.playerId;
      if (
        giver !== event.playerId &&
        teamOf(recording, giver) === team &&
        Math.hypot(position.x - lastKick.position.x, position.y - lastKick.position.y) >=
          ANTICIPATION.minimumPassDistance
      ) {
        add('good-pass', team, event.playerId, giver);
      }
    }
    if (
      event.type === 'ball_out' &&
      shot &&
      event.detail === 'Goal line crossed outside the goal'
    ) {
      const shootingTeam = shot.team ?? teamOf(recording, shot.playerId);
      if (shootingTeam) {
        const goalX = attacksRight(shootingTeam, before.half) ? FIELD.length : 0;
        const nearGoal =
          Math.abs(before.ball.x - goalX) <= ANTICIPATION.nearMissBoundaryDistance &&
          Math.abs(before.ball.y - FIELD.width / 2) <=
            FIELD.goalWidth / 2 + ANTICIPATION.nearMissGoalMargin &&
          before.ball.z <= FIELD.goalHeight + ANTICIPATION.nearMissHeightMargin;
        if (nearGoal && event.tick - shot.tick <= ANTICIPATION.maximumShotFlightTicks) {
          // Only an actual shot ending close to its target goal earns a near-miss reaction.
          position.x = before.ball.x;
          position.y = before.ball.y;
          add('near-miss', shootingTeam, shot.playerId);
        }
      }
    }
    if (event.type === 'kick' || event.type === 'shot' || event.type === 'keeper_release') {
      lastKick =
        event.type === 'kick' || (event.type === 'keeper_release' && event.delivery !== 'put_down')
          ? { event, position }
          : null;
      shot = event.type === 'shot' ? event : null;
    } else if (
      [
        'receive',
        'interception',
        'save',
        'keeper_pickup',
        'keeper_violation',
        'block',
        'tackle',
        'ball_out',
        'goal',
        'foul',
        'offside',
        'restart_awarded',
        'halftime',
        'full_time',
        'abandoned',
      ].includes(event.type)
    ) {
      lastKick = null;
      shot = null;
    }
  }
  return moments;
}

function attackAt(recording: Recording, frame: Frame): MatchAtmosphere['attack'] {
  if (frame.phase.type !== 'open_play') return null;
  let team = teamOf(recording, frame.owner);
  if (!team) {
    const touch = recording.events.findLast(
      (event) =>
        event.tick + 1 <= frame.tick &&
        event.tick >= frame.phase.sinceTick &&
        [
          'kick',
          'shot',
          'receive',
          'interception',
          'save',
          'keeper_pickup',
          'keeper_release',
          'block',
          'tackle',
        ].includes(event.type),
    );
    if (!touch || frame.tick - touch.tick > ANTICIPATION.looseBallMemoryTicks) return null;
    team = touch.team ?? teamOf(recording, touch.playerId);
  }
  if (!team) return null;
  const goalDistance = attacksRight(team, frame.half) ? FIELD.length - frame.ball.x : frame.ball.x;
  const progress = Math.max(0, Math.min(1, 1 - goalDistance / ANTICIPATION.attackingZoneDepth));
  const centrality = 1 - Math.abs(frame.ball.y - FIELD.width / 2) / (FIELD.width / 2);
  const intensity = progress * (0.55 + 0.45 * centrality);
  return intensity > 0 ? { team, intensity } : null;
}

/** Seekable buildup uses the preceding 0.6 s of play; it cannot know the attack's outcome. */
export function atmosphereAt(
  recording: Recording,
  frame: Frame,
  moments: readonly FootballMoment[],
): MatchAtmosphere {
  let moment: FootballMoment | null = null;
  let priority = 0;
  const priorities = { goal: 4, save: 3, 'near-miss': 3, 'good-pass': 1 };
  for (let index = moments.length - 1; index >= 0; index--) {
    const candidate = moments[index]!;
    const age = frame.tick - candidate.tick;
    if (age < 0) continue;
    if (age > MOMENT_DURATION_TICKS.goal) break;
    if (age >= MOMENT_DURATION_TICKS[candidate.type] || candidate.tick < frame.phase.sinceTick)
      continue;
    if (priorities[candidate.type] > priority) {
      moment = candidate;
      priority = priorities[candidate.type];
    }
  }
  const current = attackAt(recording, frame);
  if (!current) return { attack: null, moment };
  let total = current.intensity;
  for (let index = 1; index < ANTICIPATION.buildupSamples; index++) {
    const previousTick = frame.tick - index * ANTICIPATION.buildupSampleTicks;
    if (previousTick < frame.phase.sinceTick) break;
    const previous = attackAt(recording, sample(recording, previousTick / TICK_RATE));
    // Stop at possession changes so an opponent cannot inherit the previous attack's buildup.
    if (previous?.team !== current.team) break;
    total += previous.intensity;
  }
  return { attack: { team: current.team, intensity: total / ANTICIPATION.buildupSamples }, moment };
}
