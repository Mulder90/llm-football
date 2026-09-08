import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackAudio, crossedAudioEvents } from '../src/audio/playback-audio.ts';
import {
  createSoundSamples,
  eventSoundCues,
  SOUND_DURATIONS,
} from '../src/audio/stadium-sounds.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import type { MatchEvent } from '../src/sim/types.ts';
import type { SynthesizedSound } from '../src/audio/stadium-sounds.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { awardRestart, prepareRestartDelivery } from '../src/sim/restarts.ts';
import { REFEREE, TICK_RATE } from '../src/sim/rules.ts';
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
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  connect(target: unknown) {
    return target;
  }
  disconnect() {}
}
class TestSource {
  buffer: unknown = null;
  loop = false;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  starts: number[] = [];
  durations: (number | undefined)[] = [];
  offsets: (number | undefined)[] = [];
  stops: number[] = [];
  connect(target: TestGain) {
    return target;
  }
  disconnect() {}
  start(time: number, offset?: number, duration?: number) {
    this.starts.push(time);
    this.durations.push(duration);
    this.offsets.push(offset);
  }
  stop(time: number) {
    this.stops.push(time);
  }
}
class TestPanner {
  pan = { value: 0 };
  connect(target: unknown) {
    return target;
  }
  disconnect() {}
}
class TestContext {
  currentTime = 0;
  destination = {};
  sources: TestSource[] = [];
  gains: TestGain[] = [];
  panners: TestPanner[] = [];
  createGain() {
    const gain = new TestGain();
    this.gains.push(gain);
    return gain;
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
  createStereoPanner() {
    const panner = new TestPanner();
    this.panners.push(panner);
    return panner;
  }
  async resume() {}
  async close() {}
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({ recorded: true, duration: 7.1 }));
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

  async function withAmbience() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: url.endsWith('stadium-ambience.m4a'),
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    const audio = new PlaybackAudio();
    context.decodeAudioData.mockResolvedValue({ recorded: true, duration: 30 });
    await audio.setEnabled(true);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    return audio;
  }

  it('plays one very quiet natural-pitch crowd loop, with no percussion or duplicate sources', async () => {
    const audio = await withAmbience();
    expect(context.sources).toHaveLength(0); // Loading alone never starts audio.
    audio.advance([], 0, true, 1, 0);
    audio.advance([], 1, true, 1, 0);
    expect(context.sources).toHaveLength(1);
    const ambience = context.sources[0]!;
    expect(ambience.loop).toBe(true);
    expect(ambience.playbackRate.value).toBe(1);
    expect(context.gains[1]!.gain.value).toBeLessThan(0.05);
    for (let tick = 2; tick <= 2000; tick++) audio.advance([], tick, true, 1, 0);
    expect(context.sources).toHaveLength(1);
    audio.setVolume(0.2);
    expect(context.gains[0]!.gain.value).toBe(0.2);
    audio.dispose();
    expect(ambience.stops).toHaveLength(1);
  });

  it('stops the loop on pause, seek, mute, hidden tabs and speed changes, then resumes once', async () => {
    const audio = await withAmbience();
    audio.advance([], 0, true, 1, 0);
    audio.advance([], 1, true, 1, 0);
    audio.advance([], 1, false, 1, 0);
    expect(context.sources[0]!.stops).toHaveLength(1);
    audio.advance([], 120, true, 1, 1); // Seek resets without starting or replaying a cue.
    expect(context.sources).toHaveLength(1);
    audio.advance([], 121, true, 1, 1);
    expect(context.sources).toHaveLength(2);
    expect(context.sources[1]!.offsets[0]).toBeCloseTo(121 / TICK_RATE);
    audio.advance([], 122, true, 2, 1);
    audio.advance([], 124, true, 2, 1);
    expect(context.sources[1]!.stops).toHaveLength(1);
    expect(context.sources).toHaveLength(2);
    audio.advance([], 125, true, 1, 1);
    expect(context.sources).toHaveLength(3);
    visibility.hidden = true;
    audio.advance([], 125, true, 1, 1);
    expect(context.sources[2]!.stops).toHaveLength(1);
    visibility.hidden = false;
    audio.advance([], 126, true, 1, 1);
    expect(context.sources).toHaveLength(4);
    await audio.setEnabled(false);
    expect(context.sources[3]!.stops).toHaveLength(1);
    await audio.setEnabled(true);
    audio.advance([], 127, true, 1, 1);
    expect(context.sources).toHaveLength(5);
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    audio.dispose();
  });

  it('ends the stadium bed at full time while allowing only the approved final whistle tail', async () => {
    const audio = await withAmbience();
    const events = [event('full_time', 100)];
    audio.advance(events, 98, true, 1, 0);
    audio.advance(events, 99, true, 1, 0);
    const ambience = context.sources[0]!;
    audio.advance(events, 100, true, 1, 0, 'full_time');
    expect(ambience.stops).toHaveLength(1);
    expect(context.sources).toHaveLength(4);
    audio.advance(events, 100, false, 1, 0, 'full_time');
    expect(context.sources.slice(1).every((voice) => voice.stops.length === 0)).toBe(true);
    audio.dispose();
  });

  it('stays silent when recordings are unavailable, and silences pause, seek and hidden tabs without replaying old events', async () => {
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
    audio.setVolume(0.2);
    expect(context.gains[0]!.gain.value).toBe(0.2); // No animation frame is needed after playback ends.
    await audio.setEnabled(false);
    expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
    audio.setVolume(0.8);
    expect(context.gains[0]!.gain.value).toBe(0);
    audio.dispose();
  });

  it('loads the local cheer once and plays natural voices only for goals without pitch shifting', async () => {
    const fetchAsset = vi.fn(async (url: string) => ({
      ok: url.endsWith('goal-roar.m4a'),
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal('fetch', fetchAsset);
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    await audio.setEnabled(false);
    await audio.setEnabled(true);
    expect(fetchAsset).toHaveBeenCalledTimes(2); // One fetch for each local recording, across toggles.
    const events = [event('save', 4, 10), event('goal', 20, 11)];
    audio.advance(events, 0, true, 1, 0);
    audio.advance(events, 5, true, 1, 0, 'restart_setup');
    expect(context.sources).toHaveLength(0); // Saves do not add synthetic claps or crowd voices.
    audio.advance(events, 21, true, 1, 0, 'restart_setup');
    expect(context.sources.at(-1)!.buffer).toEqual({ recorded: true, duration: 7.1 });
    expect(context.sources.at(-1)!.playbackRate.value).toBe(1);
    audio.dispose();
  });

  it('fades a faster replay roar before kickoff, keeps natural pitch and cancels it on a speed change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: url.endsWith('goal-roar.m4a'),
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    const goal = { ...event('goal', 10), team: 'cyan' as const };
    audio.advance([goal], 9, true, 2, 0);
    audio.advance([goal], 11, true, 2, 0, 'restart_setup');
    const roar = context.sources.at(-1)!;
    expect(roar.playbackRate.value).toBe(1);
    expect(roar.durations).toEqual([3.55]);
    expect(context.panners.at(-1)!.pan.value).toBe(0.25);
    expect(context.gains.at(-1)!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 3.61);
    audio.advance([goal], 12, true, 1, 0, 'restart_setup');
    expect(roar.stops).toHaveLength(1);
    audio.dispose();
  });

  it('keeps only terminal whistles when a final-tick goal reaches automatic pause', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: url.endsWith('goal-roar.m4a'),
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    const events = [event('goal', 99, 1), event('full_time', 100, 2)];
    audio.advance(events, 99, true, 1, 0);
    audio.advance(events, 100, true, 1, 0, 'full_time');
    expect(context.sources).toHaveLength(5);
    const roar = context.sources[1]!;
    const finalWhistles = context.sources.slice(2);
    expect(roar.stops).toHaveLength(0);
    audio.advance(events, 100, false, 1, 0, 'full_time');
    expect(roar.stops).toHaveLength(1);
    expect(finalWhistles.every((voice) => voice.stops.length === 0)).toBe(true);
    audio.dispose();
  });
});
