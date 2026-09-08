import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTROLS_IDLE_MS, controlsIdleTimer } from '../src/ui/useControlsVisibility.ts';

afterEach(() => vi.useRealTimers());

describe('playback controls inactivity', () => {
  it('hides after inactivity, reveals immediately, and does not notify on every pointer move', () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    const controls = controlsIdleTimer(changed);
    controls.activity();
    for (let move = 0; move < 40; move++) {
      vi.advanceTimersByTime(50);
      controls.activity();
    }
    expect(changed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CONTROLS_IDLE_MS - 1);
    expect(controls.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(changed).toHaveBeenCalledExactlyOnceWith(true);
    controls.activity();
    expect(controls.hidden).toBe(false);
    expect(changed.mock.calls).toEqual([[true], [false]]);
    controls.dispose();
  });

  it('keeps controls visible while pinned and gives a full delay after the interaction ends', () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    const controls = controlsIdleTimer(changed);
    controls.activity();
    vi.advanceTimersByTime(CONTROLS_IDLE_MS);
    controls.pin(true);
    expect(controls.hidden).toBe(false);
    vi.advanceTimersByTime(CONTROLS_IDLE_MS * 3);
    controls.activity();
    vi.advanceTimersByTime(CONTROLS_IDLE_MS * 3);
    expect(changed.mock.calls).toEqual([[true], [false]]);
    controls.pin(false);
    vi.advanceTimersByTime(CONTROLS_IDLE_MS - 1);
    expect(controls.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(controls.hidden).toBe(true);
    controls.dispose();
  });

  it('cancels old timers when playback or the mounted recording changes', () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    const previous = controlsIdleTimer(changed);
    previous.activity();
    vi.advanceTimersByTime(CONTROLS_IDLE_MS - 10);
    previous.dispose();
    const current = controlsIdleTimer(changed);
    current.pin(true);
    vi.advanceTimersByTime(CONTROLS_IDLE_MS * 2);
    expect(changed).not.toHaveBeenCalled();
    current.dispose();
  });
});
