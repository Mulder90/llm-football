import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample } from '../src/recording/record.ts';
import type { Frame, Recording } from '../src/recording/record.ts';
import { GOAL_PRESENTATION } from '../src/render/celebration.ts';
import { TICK_RATE } from '../src/sim/rules.ts';
import { MatchMoment } from '../src/ui/MatchMoment.tsx';
import { Scoreboard } from '../src/ui/Scoreboard.tsx';

const record = createFullMatchFixture();
const firstGoal = record.events.find((event) => event.type === 'goal')!;
const goalFrame = (watchSeconds: number) =>
  sample(
    record,
    (firstGoal.tick +
      1 +
      (watchSeconds / GOAL_PRESENTATION.watchDurationSeconds) * GOAL_PRESENTATION.durationTicks) /
      TICK_RATE,
  );
const announcement = (frame: Frame, recording: Recording = record, reducedMotion = false) =>
  renderToStaticMarkup(createElement(MatchMoment, { recording, frame, reducedMotion }));

describe('comic broadcast announcements', () => {
  it('shows a brief goal burst, then leaves a compact scorer strip and an honest goal scoreboard', () => {
    const before = JSON.stringify(record);
    expect(announcement(sample(record, firstGoal.tick / TICK_RATE))).toBe('');
    const burst = announcement(goalFrame(0.2));
    expect(burst).toContain('goal-burst');
    expect(burst).toContain('GOAAAAL!');
    expect(burst).toContain('scores!');
    const settledFrame = goalFrame(4);
    const settled = announcement(settledFrame);
    expect(settled).toContain('goal-strip');
    expect(settled).not.toContain('GOAAAAL!');
    expect(settled).not.toContain('restart-wipe');
    const scoreboard = renderToStaticMarkup(
      createElement(Scoreboard, { recording: record, frame: settledFrame, hasEnded: false }),
    );
    expect(scoreboard).toContain('Goal!');
    expect(scoreboard).not.toContain('kickoff');
    announcement(goalFrame(GOAL_PRESENTATION.transitionMiddleSeconds));
    expect(announcement(settledFrame)).toBe(settled);
    expect(JSON.stringify(record)).toBe(before);
  });

  it('shows cuts only during their sampled windows and removes them with reduced motion', () => {
    const opening = announcement(goalFrame(0.65));
    expect(opening).toContain('goal-cut');
    expect(opening).not.toContain('BACK TO IT!');
    const closing = announcement(goalFrame(GOAL_PRESENTATION.transitionMiddleSeconds));
    expect(closing).toContain('restart-wipe');
    expect(closing).toContain('BACK TO IT!');
    expect(closing).not.toContain('goal-strip');
    expect(announcement(goalFrame(0.65), record, true)).not.toContain('restart-wipe');
    expect(
      announcement(goalFrame(GOAL_PRESENTATION.transitionMiddleSeconds), record, true),
    ).not.toContain('restart-wipe');
  });

  it('credits an own goal without describing the opposing last toucher as the scorer', () => {
    const ownGoal = structuredClone(record);
    const event = ownGoal.events.find((event) => event.id === firstGoal.id)!;
    event.playerId = ownGoal.initial.players.find((player) => player.team !== event.team)!.id;
    const markup = announcement(goalFrame(4), ownGoal);
    expect(markup).toContain('Own goal');
    expect(markup).not.toContain('scores!');
  });

  it('shows kickoff at the whistle boundary and lets the short callout expire during live play', () => {
    const whistle = record.events.find(
      (event) => event.type === 'restart_ready' && event.detail === 'kickoff',
    )!;
    expect(announcement(sample(record, (whistle.tick - 1) / TICK_RATE))).toBe('');
    expect(announcement(sample(record, whistle.tick / TICK_RATE))).toContain('LET’S PLAY!');
    expect(announcement(sample(record, (whistle.tick + TICK_RATE) / TICK_RATE))).not.toContain(
      'LET’S PLAY!',
    );
  });
});
