import { describe, expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { capture, sample, stateHash, verifyRecording } from '../src/recording/record.ts';
import type { Frame, Recording } from '../src/recording/record.ts';
import { atmosphereAt, createFootballMoments } from '../src/render/match-atmosphere.ts';
import { supporterMood } from '../src/render/stadium-atmosphere.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { cloneState, createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { Team } from '../src/sim/types.ts';
import { TICK_RATE } from '../src/sim/rules.ts';

const passing = createPassingFixture();

function shotFixture(y: number, type: 'shoot' | 'kick' = 'shoot', keeper = false): Recording {
  const state = createMatch();
  state.players.forEach((player, index) => {
    player.position = { x: 15, y: 3 + index * 2 };
  });
  const shooter = state.players.find((player) => player.id === 'coral-7')!;
  shooter.position = { x: 99, y };
  shooter.facing = { x: 1, y: 0 };
  if (keeper) state.players.find((player) => player.id === 'cyan-1')!.position = { x: 103, y };
  state.ball.owner = shooter.id;
  state.ball.position = { x: 99.65, y, z: 0 };
  const record: Recording = {
    ...passing,
    initial: cloneState(state),
    decisions: [],
    frames: [capture(state)],
    events: [],
  };
  const batches = applyDecision(
    state,
    {
      ...emptyBatch(state, 'coral'),
      orders: [{ type, playerId: shooter.id, target: { x: 105, y }, speed: keeper ? 17 : 25 }],
    },
    {
      ...emptyBatch(state, 'cyan'),
      orders: keeper ? [{ type: 'guard', playerId: 'cyan-1', target: { x: 103, y } }] : [],
    },
  );
  record.decisions.push({ tick: 0, batches, fallback: [] });
  while (state.tick < 100 && state.phase.type === 'open_play') {
    const eventCount = state.events.length;
    step(state);
    if (state.tick % 3 === 0 || eventCount !== state.events.length)
      record.frames.push(capture(state));
  }
  if (record.frames.at(-1)!.tick !== state.tick) record.frames.push(capture(state));
  record.events = state.events;
  record.durationTicks = state.tick;
  record.finalHash = stateHash(state);
  return record;
}

function buildupRecord(x: number, team: Team = 'coral', half: 1 | 2 = 1): Recording {
  const frame: Frame = {
    ...passing.frames[0]!,
    half,
    ball: { x, y: 34, z: 0 },
    owner: `${team}-7`,
  };
  return {
    ...passing,
    events: [],
    durationTicks: 90,
    frames: [
      { ...frame, tick: 0 },
      { ...frame, tick: 90 },
    ],
  };
}

describe('causal match atmosphere', () => {
  it('classifies actual nearby shot exits, saves and goals without praising a wide pass', () => {
    const miss = shotFixture(38.5);
    const save = shotFixture(34, 'shoot', true);
    const goal = shotFixture(34);
    const missedMoment = createFootballMoments(miss).find((moment) => moment.type === 'near-miss')!;
    expect(missedMoment).toMatchObject({ team: 'coral', playerId: 'coral-7' });
    expect(missedMoment.tick).toBe(
      miss.events.find((event) => event.type === 'ball_out')!.tick + 1,
    );
    expect(createFootballMoments(shotFixture(50))).toEqual([]);
    expect(createFootballMoments(shotFixture(38.5, 'kick'))).toEqual([]);
    expect(createFootballMoments(save)).toContainEqual(
      expect.objectContaining({
        type: 'save',
        team: 'cyan',
        playerId: 'cyan-1',
        otherPlayerId: 'coral-7',
      }),
    );
    expect(createFootballMoments(save).some((moment) => moment.type === 'near-miss')).toBe(false);
    expect(createFootballMoments(goal)).toContainEqual(
      expect.objectContaining({ type: 'goal', team: 'coral' }),
    );
    expect(createFootballMoments(goal).some((moment) => moment.type === 'near-miss')).toBe(false);
    for (const record of [miss, save, goal])
      expect(verifyRecording(record).tick).toBe(record.durationTicks);
  });

  it('credits the actual receiver and giver only after an uninterrupted completed pass', () => {
    const moments = createFootballMoments(passing);
    const pass = moments.find((moment) => moment.type === 'good-pass')!;
    expect(pass).toMatchObject({ playerId: 'coral-6', otherPlayerId: 'coral-7', team: 'coral' });
    const receive = passing.events.find(
      (event) => event.tick + 1 === pass.tick && event.type === 'receive',
    )!;
    const altered = {
      ...passing,
      events: passing.events.flatMap((event) =>
        event === receive
          ? [
              {
                ...event,
                id: -1,
                tick: event.tick - 1,
                type: 'interception' as const,
                playerId: 'cyan-8',
                team: 'cyan' as const,
              },
              event,
            ]
          : [event],
      ),
    };
    expect(createFootballMoments(altered).some((moment) => moment.id === pass.id)).toBe(false);
  });

  it('waits for the completed physical step and clears reactions at the next phase', () => {
    const record = shotFixture(38.5);
    const moments = createFootballMoments(record);
    const moment = moments[0]!;
    const final = record.frames.at(-1)!;
    expect(atmosphereAt(record, { ...final, tick: moment.tick - 0.01 }, moments).moment).toBeNull();
    expect(atmosphereAt(record, { ...final, tick: moment.tick }, moments).moment).toBe(moment);
    expect(
      atmosphereAt(
        record,
        {
          ...final,
          tick: moment.tick + 20,
          phase: { type: 'open_play', sinceTick: moment.tick + 10 },
        },
        moments,
      ).moment,
    ).toBeNull();
  });

  it('builds from recent attacking territory, reverses ends, and resets after a turnover', () => {
    const midfield = buildupRecord(52.5);
    const advanced = buildupRecord(91);
    const attack = atmosphereAt(advanced, advanced.frames[1]!, []).attack!;
    expect(atmosphereAt(midfield, midfield.frames[1]!, []).attack).toBeNull();
    expect(attack.intensity).toBeGreaterThan(0.65);
    const early = atmosphereAt(advanced, { ...advanced.frames[0]!, tick: 3 }, []).attack!;
    expect(early.intensity).toBeLessThan(attack.intensity / 3);
    const mirrored = buildupRecord(14, 'coral', 2);
    expect(atmosphereAt(mirrored, mirrored.frames[1]!, []).attack?.intensity).toBeCloseTo(
      attack.intensity,
    );
    const otherSide = buildupRecord(14, 'cyan', 1);
    expect(atmosphereAt(otherSide, otherSide.frames[1]!, []).attack?.intensity).toBeCloseTo(
      attack.intensity,
    );
    const turnover = { ...advanced.frames[1]!, owner: 'cyan-7', ball: { x: 14, y: 34, z: 0 } };
    const newAttack = atmosphereAt(advanced, turnover, []).attack!;
    expect(newAttack.team).toBe('cyan');
    expect(newAttack.intensity).toBeCloseTo(attack.intensity / 7);
    expect(
      atmosphereAt(
        advanced,
        { ...advanced.frames[1]!, phase: { type: 'halftime', sinceTick: 90, endsAtTick: 270 } },
        [],
      ).attack,
    ).toBeNull();
  });

  it('does not infer an attacking side from an old loose ball or a future kick', () => {
    const record = buildupRecord(95);
    const loose = { ...record.frames[1]!, owner: null };
    const kick = {
      id: 1,
      tick: 89,
      type: 'kick' as const,
      team: 'coral' as const,
      playerId: 'coral-7',
      detail: '',
    };
    expect(
      atmosphereAt({ ...record, events: [{ ...kick, tick: 90 }] }, loose, []).attack,
    ).toBeNull();
    expect(atmosphereAt({ ...record, events: [kick] }, loose, []).attack?.team).toBe('coral');
    expect(
      atmosphereAt({ ...record, events: [kick] }, { ...loose, tick: 300 }, []).attack,
    ).toBeNull();
  });

  it('is reproducible on arbitrary seeks and never looks ahead for an outcome', () => {
    const record = createFullMatchFixture();
    const unchanged = JSON.stringify(record);
    const moments = createFootballMoments(record);
    const goal = moments.find((moment) => moment.type === 'goal')!;
    const earlier = sample(record, (goal.tick - 12) / TICK_RATE);
    const prefix = {
      ...record,
      events: record.events.filter((event) => event.tick + 1 <= earlier.tick),
    };
    expect(atmosphereAt(prefix, earlier, createFootballMoments(prefix))).toEqual(
      atmosphereAt(record, earlier, moments),
    );
    const first = atmosphereAt(record, earlier, moments);
    atmosphereAt(record, record.frames.at(-1)!, moments);
    expect(atmosphereAt(record, earlier, moments)).toEqual(first);
    expect(JSON.stringify(record)).toBe(unchanged);
    expect(verifyRecording(record).tick).toBe(record.durationTicks);
  });

  it('gives opposing supporters different reactions to the same event', () => {
    const base = createFootballMoments(shotFixture(34))[0]!;
    for (const [type, coralMood, cyanMood] of [
      ['goal', 'cheer', 'disbelief'],
      ['save', 'relief', 'disbelief'],
      ['near-miss', 'disbelief', 'relief'],
      ['good-pass', 'acknowledge', 'idle'],
    ] as const) {
      const atmosphere = { attack: null, moment: { ...base, type } };
      expect(supporterMood('coral', atmosphere)).toBe(coralMood);
      expect(supporterMood('cyan', atmosphere)).toBe(cyanMood);
    }
    const attack = { attack: { team: 'cyan' as const, intensity: 0.8 }, moment: null };
    expect(supporterMood('cyan', attack)).toBe('urge');
    expect(supporterMood('coral', attack)).toBe('tense');
  });
});
