import { describe, expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample } from '../src/recording/record.ts';
import {
  celebrationFrame,
  celebrationGesture,
  GOAL_PRESENTATION,
} from '../src/render/celebration.ts';
import { drawPlayers } from '../src/render/players.ts';
import { robotReactions, robotStyle } from '../src/render/robot-character.ts';
import { ORDER_LIFETIME, TICK_RATE } from '../src/sim/rules.ts';

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
    expect(celebrationGesture(start + 4, true, 7)).toMatchObject({ phase: 'windup', jump: 0 });
    expect(celebrationGesture(start + 15, true, 7)).toMatchObject({
      phase: 'jump',
      facingAway: true,
    });
    expect(celebrationGesture(start + 23, true, 7)).toMatchObject({
      phase: 'jump',
      facingAway: false,
    });
    expect(celebrationGesture(start + 32, true, 7)).toMatchObject({
      phase: 'landing',
      jump: 0,
      armPose: 'wide',
    });
    expect(celebrationGesture(start + 45, true, 7)).toMatchObject({
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
      expect(teammate.position.y).toBeLessThan(scorer.position.y);
    }
    expect(celebrationFrame(record, frame, true).frame).toBe(frame);
    expect(JSON.stringify(record)).toBe(before);
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
