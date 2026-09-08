import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackAudio, crossedAudioEvents } from '../src/audio/playback-audio.ts';
import {
  createSoundSamples,
  crossedDrumBeats,
  eventSoundCues,
  momentSoundCues,
  SOUND_DURATIONS,
} from '../src/audio/stadium-sounds.ts';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { sample } from '../src/recording/record.ts';
import {
  celebrationFrame,
  celebrationGesture,
  GOAL_PRESENTATION,
} from '../src/render/celebration.ts';
import type { MatchEvent } from '../src/sim/types.ts';
import type { SynthesizedSound } from '../src/audio/stadium-sounds.ts';
import { applyDecision, emptyBatch } from '../src/sim/orders.ts';
import { awardRestart, prepareRestartDelivery } from '../src/sim/restarts.ts';
import { REFEREE, TICK_RATE } from '../src/sim/rules.ts';
import { createMatch } from '../src/sim/state.ts';
import { step } from '../src/sim/step.ts';
import type { FootballMoment, MatchAtmosphere } from '../src/render/match-atmosphere.ts';

function event(type: MatchEvent['type'], tick: number, id = tick, detail = ''): MatchEvent {
  return { id, type, tick, playerId: null, detail };
}

function atmosphere(type: FootballMoment['type'], tick: number): MatchAtmosphere {
  return {
    attack: null,
    moment: {
      id: `${type}-${tick}`,
      tick,
      type,
      team: 'cyan',
      playerId: 'cyan-1',
      otherPlayerId: null,
      position: { x: 100, y: 34 },
    },
  };
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

  it('builds attack density and accents without changing tempo or losing headroom', () => {
    const phrase = (intensity: number) => {
      const cues = [];
      for (let tick = 1; tick <= 221; tick++)
        cues.push(...crossedDrumBeats(tick - 1, tick, 1, { team: 'coral', intensity }));
      return cues;
    };
    const calm = phrase(0);
    const attack = phrase(0.5);
    const pressure = phrase(1);
    expect(attack.length).toBeGreaterThan(calm.length);
    expect(pressure.length).toBeGreaterThan(attack.length);
    expect(Math.max(...pressure.map((cue) => cue.gain))).toBeLessThan(0.5);
    expect(pressure.every((cue) => cue.group === 'drum' && cue.pan === -0.25)).toBe(true);
    expect(crossedDrumBeats(27.69, 27.7, 1, { team: 'cyan', intensity: 1 })[0]!.pan).toBe(0.25);
    expect(crossedDrumBeats(27.69, 27.7, 4, { team: 'cyan', intensity: 1 })).toEqual([]);
  });

  it('gives a defender save, near miss and goal distinct short percussion responses', () => {
    const save = momentSoundCues(atmosphere('save', 11).moment!);
    const miss = momentSoundCues(atmosphere('near-miss', 11).moment!);
    const goal = momentSoundCues(atmosphere('goal', 11).moment!);
    expect(
      new Set([save, miss, goal].map((cues) => cues.map((cue) => cue.sound).join(','))).size,
    ).toBe(3);
    expect(save.every((cue) => cue.pan === 0.25 && cue.group === 'accent')).toBe(true);
    expect(momentSoundCues(atmosphere('good-pass', 11).moment!)).toEqual([]);
    expect(
      [...save, ...miss, ...goal].every((cue) => cue.delay < 0.6 && cue.sound.startsWith('drum-')),
    ).toBe(true);
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
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  starts: number[] = [];
  durations: (number | undefined)[] = [];
  stops: number[] = [];
  connect(target: TestGain) {
    return target;
  }
  disconnect() {}
  start(time: number, _offset?: number, duration?: number) {
    this.starts.push(time);
    this.durations.push(duration);
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
    audio.setVolume(0.2);
    expect(context.gains[0]!.gain.value).toBe(0.2); // No animation frame is needed after playback ends.
    await audio.setEnabled(false);
    expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
    audio.setVolume(0.8);
    expect(context.gains[0]!.gain.value).toBe(0);
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
    expect(context.sources.at(-1)!.buffer).toEqual({ recorded: true, duration: 7.1 });
    expect(context.sources.at(-1)!.playbackRate.value).toBe(1);
    audio.dispose();
  });

  it('fades a faster replay roar before kickoff, keeps natural pitch and cancels it on a speed change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
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
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
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

  it('accents the visible scorer landing once and does not sound a seek into that pose', async () => {
    const recording = createFullMatchFixture();
    const goal = recording.events.find((event) => event.type === 'goal')!;
    let landingAge = 0;
    while (
      landingAge < GOAL_PRESENTATION.durationTicks &&
      celebrationGesture(landingAge, true, 0, goal.team!).phase !== 'landing'
    )
      landingAge += 0.25;
    const at = (age: number) => {
      const frame = sample(recording, (goal.tick + 1 + age) / TICK_RATE);
      return { frame, celebration: celebrationFrame(recording, frame, false) };
    };
    const before = at(landingAge - 0.5);
    const landed = at(landingAge + 0.25);
    expect(landed.celebration.playerIds.has(landed.celebration.scorerId!)).toBe(true);
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    audio.advance([], before.frame.tick, true, 1, 0, 'restart_setup', null, before.celebration);
    audio.advance([], landed.frame.tick, true, 1, 0, 'restart_setup', null, landed.celebration);
    expect(context.sources).toHaveLength(2);
    audio.advance([], landed.frame.tick, true, 1, 0, 'restart_setup', null, landed.celebration);
    audio.advance([], landed.frame.tick, true, 1, 1, 'restart_setup', null, landed.celebration);
    expect(context.sources).toHaveLength(2);
    expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
    audio.dispose();
  });

  it.each([
    ['save', 3],
    ['near-miss', 1],
    ['goal', 4],
  ] as const)(
    'sounds a %s once at its visible boundary, with no replay on a held moment or seek',
    async (type, voices) => {
      const audio = new PlaybackAudio();
      await audio.setEnabled(true);
      const state = atmosphere(type, 11);
      audio.advance([], 9, true, 1, 0, 'open_play', state);
      audio.advance([], 10.99, true, 1, 0, 'open_play', state);
      expect(context.sources).toHaveLength(0);
      audio.advance([], 11, true, 1, 0, 'open_play', state);
      expect(context.sources).toHaveLength(voices);
      expect(context.panners.every((panner) => panner.pan.value === 0.25)).toBe(true);
      audio.advance([], 27.7, true, 1, 0, 'open_play', state);
      expect(context.sources).toHaveLength(voices); // The outcome briefly clears the drum bed.
      audio.advance([], 50, true, 1, 1, 'open_play', state);
      expect(context.sources).toHaveLength(voices);
      expect(context.sources.every((source) => source.stops.length === 1)).toBe(true);
      audio.dispose();
    },
  );

  it('keeps dense attack percussion within the overall voice cap', async () => {
    const audio = new PlaybackAudio();
    await audio.setEnabled(true);
    const state: MatchAtmosphere = { attack: { team: 'coral', intensity: 1 }, moment: null };
    audio.advance([], 0, true, 1, 0, 'open_play', state);
    // This fake context never ends a clip, exercising the hard cap under sustained pressure.
    for (let tick = 1; tick <= 2000; tick++)
      audio.advance([], tick, true, 1, 0, 'open_play', state);
    expect(context.sources).toHaveLength(18);
    audio.dispose();
  });
});
