import { describe, expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample } from '../src/recording/record.ts';
import {
  celebrationFrame,
  celebrationGesture,
  GOAL_PRESENTATION,
} from '../src/render/celebration.ts';
import { worldToScreen } from '../src/render/layout.ts';
import { drawPlayers } from '../src/render/players.ts';
import { robotReactions, robotStyle } from '../src/render/robot-character.ts';
import { ORDER_LIFETIME, TICK_RATE } from '../src/sim/rules.ts';
import type { FootballMoment } from '../src/render/match-atmosphere.ts';

describe('recorded robot character', () => {
  it('only prepares after an accepted kick boundary, and reactions wait for the completed step', () => {
    const record = createPassingFixture();
    record.decisions = [record.decisions[0]!];
    record.decisions[0]!.tick = 5;
    record.events = [{ id: 1, tick: 5, type: 'order_failed', playerId: 'coral-7', detail: '' }];
    const frame = record.frames[0]!;
    expect(robotReactions(record, { ...frame, tick: 4.99 }).size).toBe(0);
    expect(robotReactions(record, { ...frame, tick: 5 }).get('coral-7')?.gesture).toBe(
      'prepare-kick',
    );
    expect(robotReactions(record, { ...frame, tick: 5.99 }).get('coral-7')?.gesture).toBe(
      'prepare-kick',
    );
    expect(robotReactions(record, { ...frame, tick: 6 }).get('coral-7')?.gesture).toBe('shrug');
    record.decisions = [];
    expect(robotReactions(record, { ...frame, tick: 5.99 }).size).toBe(0);
  });

  it('requires both an explicit pass plan and a matching accepted receiver order', () => {
    const record = createPassingFixture();
    const decision = record.decisions[0]!;
    record.decisions = [decision];
    record.events = [];
    decision.notes = {
      coral: {
        intent: '',
        memory: {
          plan: '',
          ballPlayerId: 'coral-7',
          pass: { receiverId: 'coral-9', target: { x: 57, y: 9 } },
          assignments: [],
          threats: [],
          review: '',
        },
      },
      cyan: { intent: '', memory: null },
    };
    const frame = record.frames[0]!;
    expect(robotReactions(record, frame).get('coral-9')?.gesture).toBe('receive');
    expect(
      robotReactions(record, { ...frame, tick: ORDER_LIFETIME.persistentTicks }).has('coral-9'),
    ).toBe(false);
    expect(robotReactions(record, { ...frame, owner: 'cyan-7' }).has('coral-9')).toBe(false);
    decision.batches[0].orders = decision.batches[0].orders.filter(
      (order) => order.playerId !== 'coral-9',
    );
    expect(robotReactions(record, frame).has('coral-9')).toBe(false);
  });

  it('gives the scorer one turn in the air and a settled wide-arm landing, with teammates behind', () => {
    const start = GOAL_PRESENTATION.gatheringTicks;
    expect(celebrationGesture(start + 4, true, 7, 'cyan')).toMatchObject({
      phase: 'windup',
      jump: 0,
    });
    expect(celebrationGesture(start + 15, true, 7, 'cyan')).toMatchObject({
      phase: 'jump',
      facingAway: true,
    });
    expect(celebrationGesture(start + 23, true, 7, 'cyan')).toMatchObject({
      phase: 'jump',
      facingAway: false,
    });
    expect(celebrationGesture(start + 32, true, 7, 'cyan')).toMatchObject({
      phase: 'landing',
      jump: 0,
      armPose: 'wide',
    });
    expect(celebrationGesture(start + 45, true, 7, 'cyan')).toMatchObject({
      phase: 'salute',
      jump: 0,
      crouch: 0,
      armPose: 'wide',
    });
    const record = createFullMatchFixture();
    const goal = record.events.find((event) => event.type === 'goal')!;
    const before = JSON.stringify(record);
    const frame = sample(record, (goal.tick + 60) / TICK_RATE);
    const huddle = celebrationFrame(record, frame, false);
    expect(huddle.scorerId).toBe(goal.playerId);
    const scorer =
      huddle.frame.players[
        record.initial.players.findIndex((player) => player.id === huddle.scorerId)
      ]!;
    for (const id of huddle.playerIds) {
      if (id === huddle.scorerId) continue;
      const teammate =
        huddle.frame.players[record.initial.players.findIndex((player) => player.id === id)]!;
      // The support fans toward the pitch interior at either top or bottom corner.
      const inwardY = huddle.corner!.y === 0 ? 1 : -1;
      expect((teammate.position.y - scorer.position.y) * inwardY).toBeGreaterThan(-0.2);
    }
    expect(celebrationFrame(record, frame, true).frame).toBe(frame);
    expect(JSON.stringify(record)).toBe(before);
  });

  it('gives Coral two compact fist-raised hops while Cyan retains the turning leap', () => {
    const settled = GOAL_PRESENTATION.gatheringTicks;
    const firstHop = celebrationGesture(settled + 14, true, 7, 'coral');
    const betweenHops = celebrationGesture(settled + 24, true, 7, 'coral');
    const secondHop = celebrationGesture(settled + 33, true, 7, 'coral');
    expect(firstHop).toMatchObject({ phase: 'jump', facingAway: false, armPose: 'pump' });
    expect(firstHop.jump).toBeGreaterThan(0);
    expect(betweenHops.jump).toBe(0);
    expect(secondHop).toMatchObject({ phase: 'jump', facingAway: false, armPose: 'pump' });
    expect(secondHop.jump).toBeGreaterThan(0);
    const cyan = celebrationGesture(settled + 14, true, 7, 'cyan');
    expect(cyan.facingAway).toBe(true);
    expect(cyan.jump).toBeGreaterThan(firstHop.jump);
    expect(celebrationGesture(settled + 48, true, 7, 'coral').jump).toBe(0);
  });

  it('uses only visible classified moments and cancels stale reactions when possession changes', () => {
    const record = createPassingFixture();
    record.decisions = [];
    record.events = [];
    const initial = record.frames[0]!;
    const moment: FootballMoment = {
      id: 'save:10',
      tick: 10,
      type: 'save',
      team: 'coral',
      playerId: 'coral-1',
      otherPlayerId: 'cyan-7',
      position: { x: 5, y: 34 },
    };
    const afterSave = { ...initial, tick: 20, owner: 'coral-1' };
    expect(robotReactions(record, { ...afterSave, tick: 9.99 }, [moment]).size).toBe(0);
    expect(robotReactions(record, { ...afterSave, tick: 10 }, [moment]).size).toBe(0);
    expect(robotReactions(record, afterSave, [moment]).get('coral-1')?.gesture).toBe('save-pump');
    expect(robotReactions(record, { ...afterSave, owner: null }, [moment]).size).toBe(0);
    expect(robotReactions(record, { ...afterSave, tick: 60 }, [moment]).size).toBe(0);
    const miss: FootballMoment = {
      ...moment,
      id: 'miss:10',
      type: 'near-miss',
      playerId: 'coral-7',
      otherPlayerId: null,
    };
    const afterMiss = { ...initial, tick: 10, owner: null };
    expect(robotReactions(record, { ...afterMiss, tick: 9.99 }, [miss]).size).toBe(0);
    expect(robotReactions(record, afterMiss, [miss]).get('coral-7')?.gesture).toBe('frustrated');
    expect(robotReactions(record, { ...afterMiss, owner: 'coral-7' }, [miss]).size).toBe(0);
    expect(robotReactions(record, afterMiss, []).size).toBe(0);
    const fullTime = {
      ...afterMiss,
      phase: { type: 'full_time' as const, reason: 'completed' as const, sinceTick: 10 },
    };
    expect(robotReactions(record, fullTime, [miss]).size).toBe(0);
  });

  it('acknowledges both ends of a good pass briefly, without asking a current carrier for the ball', () => {
    const record = createPassingFixture();
    record.decisions = [];
    record.events = [];
    const frame = { ...record.frames[0]!, tick: 10, owner: 'coral-9' };
    const pass: FootballMoment = {
      id: 'pass:10',
      tick: 10,
      type: 'good-pass',
      team: 'coral',
      playerId: 'coral-9',
      otherPlayerId: 'coral-7',
      position: { x: 60, y: 34 },
    };
    const before = JSON.stringify({ record, frame, pass });
    const reactions = robotReactions(record, frame, [pass]);
    expect(reactions.get('coral-9')?.gesture).toBe('acknowledge');
    expect(reactions.get('coral-7')?.gesture).toBe('acknowledge');
    expect(robotReactions(record, { ...frame, tick: 9.99 }, [pass]).size).toBe(0);
    expect(robotReactions(record, { ...frame, tick: 34 }, [pass]).size).toBe(0);
    for (const owner of [null, 'coral-7', 'cyan-9'])
      expect(robotReactions(record, { ...frame, owner }, [pass]).size).toBe(0);
    const nextKick = structuredClone(frame);
    nextKick.players[
      record.initial.players.findIndex((player) => player.id === 'coral-9')
    ]!.lastKickTick = 10;
    expect(robotReactions(record, nextKick, [pass]).size).toBe(0);
    expect(JSON.stringify({ record, frame, pass })).toBe(before);
  });

  it('keeps every active robot visible and paints the airborne scorer above the group', () => {
    const record = createFullMatchFixture();
    const goal = record.events.find((event) => event.type === 'goal')!;
    const frame = sample(
      record,
      (goal.tick + 1 + GOAL_PRESENTATION.gatheringTicks + 15) / TICK_RATE,
    );
    const celebration = celebrationFrame(record, frame, false);
    expect(celebrationGesture(celebration.ageTicks, true, 1, goal.team!).jump).toBeGreaterThan(0);
    const labels: Array<[string, number, number]> = [];
    const context = {
      save() {},
      restore() {},
      fillRect() {},
      fillText: (text: string, x: number, y: number) => labels.push([text, x, y]),
    } as unknown as CanvasRenderingContext2D;
    drawPlayers(context, frame, record, true, false, frame.tick, [], celebration);
    const active = celebration.frame.players.filter((pose) => !pose.dismissed);
    expect(labels).toHaveLength(active.length * 2);
    const scorer = record.initial.players.find((player) => player.id === celebration.scorerId)!;
    const pose = celebration.frame.players[record.initial.players.indexOf(scorer)]!;
    const ground = worldToScreen(pose.position);
    expect(labels.at(-1)).toEqual([String(scorer.number), ground.x, ground.y + 14]);
  });

  it('repeats expressive rendering after seeks and makes reduced-motion poses independent of decorative time', () => {
    const record = createFullMatchFixture();
    const original = JSON.stringify(record);
    const goal = record.events.find((event) => event.type === 'goal')!;
    const frame = sample(record, (goal.tick + 49) / TICK_RATE);
    const commands = (reduced: boolean, time: number) => {
      const rectangles: number[][] = [];
      const context = {
        save() {},
        restore() {},
        fillRect: (...rect: number[]) => rectangles.push(rect),
      } as unknown as CanvasRenderingContext2D;
      drawPlayers(context, frame, record, false, reduced, time);
      return rectangles;
    };
    const first = commands(false, 150);
    commands(false, 400);
    expect(commands(false, 150)).toEqual(first);
    expect(commands(true, 150)).toEqual(commands(true, 400));
    const styles = record.initial.players.slice(0, 3).map(robotStyle);
    expect(new Set(styles.map((style) => style.variant)).size).toBe(3);
    expect(JSON.stringify(record)).toBe(original);
  });
});
