import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackAudio, crossedAudioEvents } from '../src/audio/playback-audio.ts';
import {
  createSoundSamples,
  crossedDrumBeats,
  eventSoundCues,
  SOUND_DURATIONS,
} from '../src/audio/stadium-sounds.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import type { MatchEvent } from '../src/sim/types.ts';
import type { SynthesizedSound } from '../src/audio/stadium-sounds.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { awardRestart, prepareRestartDelivery } from '../src/sim/restarts.ts';
import { REFEREE } from '../src/sim/rules.ts';
import { createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';

function event(type: MatchEvent['type'], tick: number, id = tick, detail = ''): MatchEvent {
  return { id, type, tick, playerId: null, detail };
}

describe('stadium sound timing and design', () => {
  it('waits for physical action frames, but whistles at the recorded clock transition', () => {
    const kick = event('shot', 10);
    expect(crossedAudioEvents([kick], 9, 10.9, 1)).toEqual([]);
    expect(crossedAudioEvents([kick], 10.9, 11, 1)).toEqual([kick]);
    const recording = createFullMatchFixture();
    const end = recording.events.find((incident) => incident.type === 'full_time')!;
    expect(end.tick).toBe(recording.durationTicks);
    expect(crossedAudioEvents(recording.events, end.tick - 1, end.tick, 1)).toContain(end);
    const kickoff = recording.events.find((incident) => incident.type === 'restart_ready')!;
    expect(crossedAudioEvents(recording.events, kickoff.tick - 1, kickoff.tick, 1)).toContain(
      kickoff,
    );
    expect(eventSoundCues(event('restart_taken', 11, 11, 'kickoff'))).toEqual([]);
  });

  it.each(['timeout', 'dismissal'] as const)(
    'sounds %s abandonment on its actual terminal frame without anticipating it',
    (reason) => {
      const state = createMatch('abandoned-audio');
      if (reason === 'timeout') {
        awardRestart(state, 'kickoff', 'coral', { x: 52.5, y: 34 });
        prepareRestartDelivery(state);
        if (state.phase.type !== 'restart_ready') throw new Error('Expected ready kickoff');
        state.tick = state.phase.deadlineTick - 1;
      } else {
        const carrier = state.players.find((player) => player.id === 'coral-7')!;
        const tackler = state.players.find((player) => player.id === 'cyan-2')!;
        tackler.position = { x: carrier.position.x - 1, y: carrier.position.y };
        tackler.velocity = { x: REFEREE.excessiveClosingSpeed, y: 0 };
        for (const player of state.players
          .filter((player) => player.team === 'cyan' && player.id !== tackler.id)
          .slice(0, 4))
          player.dismissed = true;
        const cyan = emptyBatch(state, 'cyan');
        cyan.orders = [{ type: 'tackle', playerId: tackler.id, targetId: carrier.id }];
        applyDecision(state, emptyBatch(state, 'coral'), cyan);
      }
      step(state);
      expect(state.phase).toMatchObject({ type: 'full_time', reason: 'abandoned' });
      const incident = state.events.find((entry) => entry.type === 'abandoned')!;
      expect(state.tick - incident.tick).toBe(reason === 'timeout' ? 0 : 1);
      expect(
        crossedAudioEvents(state.events, state.tick - 1, state.tick - 0.01, 1, state.tick),
      ).not.toContain(incident);
      expect(
        crossedAudioEvents(state.events, state.tick - 0.01, state.tick, 1, state.tick),
      ).toContain(incident);
    },
  );

  it('uses distinct start, stop, interval and final whistle patterns without burying them in contacts', () => {
    const whistles = (incident: MatchEvent) =>
      eventSoundCues(incident).filter((cue) => cue.group === 'whistle');
    expect(whistles(event('restart_ready', 0, 0, 'kickoff'))).toHaveLength(1);
    expect(whistles(event('foul', 1))).toHaveLength(1);
    expect(whistles(event('halftime', 2))).toHaveLength(2);
    const final = whistles(event('full_time', 3));
    expect(final).toHaveLength(3);
    expect(final.every((cue) => cue.terminal)).toBe(true);
    expect(final.map((cue) => cue.delay)).toEqual([...final.map((cue) => cue.delay)].sort());
    const contacts = Array.from({ length: 20 }, (_, id) => event('kick', 5, id));
    const goal = event('goal', 5, 20);
    expect(crossedAudioEvents([...contacts, goal], 5, 6, 1)).toContain(goal);
    expect(crossedAudioEvents([...contacts, goal], 5, 6, 4)).toEqual([goal]);
  });

  it('never catches up a backlog of drums or changes their tempo at faster replay speeds', () => {
    // At 130 BPM, the next quarter-note bass hit falls at tick 27.6923…, not tick 28.
    expect(crossedDrumBeats(27, 27.69, 1)).toEqual([]);
    expect(crossedDrumBeats(27.69, 27.7, 1)).toHaveLength(1);
    expect(crossedDrumBeats(27.7, 28, 1)).toEqual([]);
    expect(crossedDrumBeats(27.69, 27.7, 2)).toEqual([]);
    expect(crossedDrumBeats(27.69, 27.7, 0.5)).toEqual([]);
    expect(crossedDrumBeats(28, 28, 1)).toEqual([]);
    expect(crossedDrumBeats(28, 0, 1)).toEqual([]);
    expect(crossedDrumBeats(0, 332.31, 1)).toEqual(crossedDrumBeats(332.3, 332.31, 1));
  });

  it('creates finite, repeatable clips with unclipped samples and quiet boundaries', () => {
    for (const sound of Object.keys(SOUND_DURATIONS) as SynthesizedSound[]) {
      const samples = createSoundSamples(sound, 24_000);
      expect(samples).toEqual(createSoundSamples(sound, 24_000));
      expect(Math.abs(samples[0]!)).toBe(0);
      expect(Math.abs(samples.at(-1)!)).toBe(0);
      let peak = 0;
      for (const value of samples) {
        if (!Number.isFinite(value)) throw new Error(`Non-finite ${sound} sample`);
        peak = Math.max(peak, Math.abs(value));
      }
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThan(1);
    }
  });
});

class TestGain {
  gain = {
    value: 0,
    setTargetAtTime: (value: number) => {
      this.gain.value = value;
    },
  };
  connect(target: unknown) {
    return target;
  }
  disconnect() {}
}
class TestSource {
  buffer: unknown = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops: number[] = [];
  connect(target: TestGain) {
    return target;
  }
  disconnect() {}
  start(time: number) {
    this.starts.push(time);
  }
  stop(time: number) {
    this.stops.push(time);
  }
}
class TestContext {
  currentTime = 0;
  destination = {};
  sources: TestSource[] = [];
  createGain() {
    return new TestGain();
  }
  createBuffer(_channels: number, length: number) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }
  createBufferSource() {
    const source = new TestSource();
    this.sources.push(source);
    return source;
  }
  async resume() {}
  async close() {}
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({ recorded: true }));
}

describe('browser playback audio lifecycle', () => {
  let context: TestContext;
  const visibility = { hidden: false };
  beforeEach(() => {
    visibility.hidden = false;
    vi.stubGlobal('document', visibility);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal(
      'AudioContext',
      class extends TestContext {
        constructor() {
          super();
          context = this;
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has no continuous source, and silences pause, seek and hidden tabs without replaying old events', async () => {
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    expect(context.sources).toHaveLength(0);
    const events = [event('goal', 4), event('goal', 40)];
    audio.advance(events, 0, true, 1, 0);
    audio.advance(events, 5, true, 1, 0, 'restart_setup');
    expect(context.sources).toHaveLength(1); // No synthesized fallback when the cheer is absent.
    expect(context.sources[0]!.buffer).toBeTruthy();
    audio.advance(events, 5, false, 1, 0, 'restart_setup');
    expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
    audio.advance(events, 8, true, 1, 0, 'restart_setup');
    audio.advance(events, 50, true, 1, 1, 'restart_setup');
    expect(context.sources).toHaveLength(1);
    audio.advance(events, 0, true, 1, 2);
    audio.advance(events, 5, true, 1, 2, 'restart_setup');
    expect(context.sources).toHaveLength(2);
    visibility.hidden = true;
    audio.advance(events, 5, true, 1, 2, 'restart_setup');
    expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
    audio.advance(events, 50, true, 1, 2, 'restart_setup');
    visibility.hidden = false;
    audio.advance(events, 51, true, 1, 2, 'restart_setup');
    expect(context.sources).toHaveLength(2);
    audio.dispose();
  });

  it('lets the final whistle finish after automatic playback end, but still respects mute', async () => {
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    const events = [event('full_time', 100)];
    audio.advance(events, 99, true, 1, 0);
    audio.advance(events, 100, true, 1, 0, 'full_time');
    expect(context.sources).toHaveLength(3);
    audio.advance(events, 100, false, 1, 0, 'full_time');
    expect(context.sources.every((source) => source.stops.length === 0)).toBe(true);
    await audio.setEnabled(false);
    expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
    audio.dispose();
  });

  it('loads the local cheer once and plays natural voices only for goals without pitch shifting', async () => {
    const fetchAsset = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    vi.stubGlobal('fetch', fetchAsset);
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    await audio.setEnabled(false);
    await audio.setEnabled(true);
    expect(fetchAsset).toHaveBeenCalledOnce();
    const events = [event('save', 4, 10), event('goal', 20, 11)];
    audio.advance(events, 0, true, 1, 0);
    audio.advance(events, 5, true, 1, 0, 'restart_setup');
    expect(context.sources).toHaveLength(0); // Saves do not add synthetic claps or crowd voices.
    audio.advance(events, 21, true, 1, 0, 'restart_setup');
    expect(context.sources.at(-1)!.buffer).toEqual({ recorded: true });
    expect(context.sources.at(-1)!.playbackRate.value).toBe(1);
    audio.dispose();
  });
});
