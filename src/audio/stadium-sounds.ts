import type { MatchEvent } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { Team } from '../sim/types.ts';
import type { FootballMoment, MatchAtmosphere } from '../render/match-atmosphere.ts';

export const SOUND_DURATIONS = {
  'drum-low': 0.62,
  'drum-high': 0.4,
  kick: 0.11,
  post: 0.4,
  'whistle-short': 0.22,
  'whistle-long': 0.58,
} as const;
export type SynthesizedSound = keyof typeof SOUND_DURATIONS;
export type SoundCue = {
  sound: SynthesizedSound | 'goal-cheer';
  gain: number;
  delay: number;
  group: 'drum' | 'accent' | 'contact' | 'crowd' | 'whistle';
  terminal?: boolean;
  pan?: number;
};

const cue = (
  sound: SoundCue['sound'],
  gain: number,
  group: SoundCue['group'],
  delay = 0,
  pan?: number,
): SoundCue => ({
  sound,
  gain,
  group,
  delay,
  ...(pan === undefined ? {} : { pan }),
});

const supporterPan = (team: Team) => (team === 'coral' ? -0.25 : 0.25);

/** Short percussion responses; the recorded goal cheer and referee remain separate. */
export function momentSoundCues(moment: FootballMoment): SoundCue[] {
  const pan = supporterPan(moment.team);
  const accent = (sound: SynthesizedSound, gain: number, delay = 0) =>
    cue(sound, gain, 'accent', delay, pan);
  switch (moment.type) {
    case 'save':
      return [
        accent('drum-high', 0.24),
        accent('drum-high', 0.19, 0.12),
        accent('drum-low', 0.23, 0.28),
      ];
    case 'near-miss':
      return [accent('drum-low', 0.17)];
    case 'goal':
      return [
        accent('drum-low', 0.3),
        accent('drum-high', 0.23, 0.16),
        accent('drum-high', 0.25, 0.28),
        accent('drum-low', 0.32, 0.48),
      ];
    default:
      return [];
  }
}

/** Short, distinct referee patterns; only the final whistle survives automatic playback end. */
export function eventSoundCues(event: MatchEvent): SoundCue[] {
  switch (event.type) {
    case 'kick':
      return [cue('kick', 0.28, 'contact')];
    case 'shot':
      return [cue('kick', 0.33, 'contact')];
    case 'tackle':
      return [cue('kick', 0.15, 'contact')];
    case 'post':
      return [cue('post', 0.2, 'contact')];
    case 'foul':
    case 'offside':
    case 'ball_out':
      return [cue('whistle-short', 0.2, 'whistle')];
    case 'restart_ready':
      return event.detail === 'kickoff' ? [cue('whistle-long', 0.22, 'whistle')] : [];
    case 'goal':
      return [cue('whistle-short', 0.18, 'whistle'), cue('goal-cheer', 0.24, 'crowd', 0.06)];
    case 'halftime':
      return [cue('whistle-short', 0.21, 'whistle'), cue('whistle-long', 0.21, 'whistle', 0.36)];
    case 'full_time':
    case 'abandoned':
      return [
        cue('whistle-short', 0.22, 'whistle'),
        cue('whistle-short', 0.22, 'whistle', 0.34),
        cue('whistle-long', 0.22, 'whistle', 0.68),
      ].map((sound) => ({ ...sound, terminal: true }));
    default:
      return [];
  }
}

const DRUM_BPM = 130;
const DRUM_STEP_TICKS = (60 * TICK_RATE) / (DRUM_BPM * 4); // Keep fractional sixteenth-note timing.
const DRUM_PHRASE_STEPS = 32; // Two bars of 4/4.
const DRUM_PATTERN: Readonly<Record<number, { sound: SynthesizedSound; gain: number }>> = {
  0: { sound: 'drum-low', gain: 0.37 },
  4: { sound: 'drum-low', gain: 0.25 },
  8: { sound: 'drum-high', gain: 0.29 },
  16: { sound: 'drum-low', gain: 0.35 },
  20: { sound: 'drum-low', gain: 0.24 },
  24: { sound: 'drum-high', gain: 0.27 },
};
const ATTACK_SUBDIVISIONS: Readonly<Record<number, number>> = {
  6: 0.7,
  12: 0.35,
  14: 0.7,
  22: 0.7,
  28: 0.35,
  30: 0.7,
};

export function crossedDrumBeats(
  previousTick: number,
  tick: number,
  speed: number,
  attack: MatchAtmosphere['attack'] = null,
): SoundCue[] {
  if (tick <= previousTick || speed !== 1) return [];
  const step = Math.floor(tick / DRUM_STEP_TICKS);
  if (step <= Math.floor(previousTick / DRUM_STEP_TICKS)) return [];
  // Never burst through a backlog: only the newest crossed step can make a drum hit.
  const position = step % DRUM_PHRASE_STEPS;
  const phrase = Math.floor(step / DRUM_PHRASE_STEPS) % 4;
  const intensity = Math.max(0, Math.min(1, attack?.intensity ?? 0));
  // Keep the same equal-power path in calm play, so entering an attack cannot change routing gain.
  const pan = attack ? supporterPan(attack.team) : 0;
  const hit = (sound: SynthesizedSound, gain: number) =>
    cue(sound, gain * (1 + intensity * 0.18), 'drum', 0, pan);
  // A short rolling fill leads back to the accented bass hit every fourth phrase.
  if (phrase === 3 && [26, 28, 29, 30, 31].includes(position))
    return [hit('drum-high', 0.13 + (position - 26) * 0.025)];
  if (phrase === 2 && position === 20) return []; // Leave air before the next backbeat.
  const beat = DRUM_PATTERN[position];
  if (beat) return [hit(beat.sound, beat.gain * (phrase % 2 === 0 ? 1 : 0.92))];
  const threshold = ATTACK_SUBDIVISIONS[position];
  return threshold !== undefined && intensity >= threshold
    ? [hit('drum-high', 0.11 + intensity * 0.06)]
    : [];
}

/** Original percussion and whistles. No synthetic voices or continuously running crowd noise. */
export function createSoundSamples(sound: SynthesizedSound, sampleRate: number): Float32Array {
  const duration = SOUND_DURATIONS[sound];
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 7919;
  let softenedNoise = 0;
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    softenedNoise += (noise - softenedNoise) * 0.08;
    const edge = Math.min(1, time / 0.008, (duration - time) / 0.055);
    let value = 0;
    if (sound.startsWith('whistle-')) {
      const flutter = Math.sin(Math.PI * 2 * 37 * time);
      value =
        (Math.sin(Math.PI * 2 * 2850 * time + flutter * 0.16) * 0.7 +
          Math.sin(Math.PI * 2 * 4090 * time) * 0.2) *
        (0.85 + flutter * 0.15);
    } else if (sound === 'post') {
      value =
        (Math.sin(Math.PI * 2 * 810 * time) + Math.sin(Math.PI * 2 * 1357 * time) * 0.45) *
        Math.exp(-time * 11);
    } else {
      const low = sound === 'drum-low';
      const kick = sound === 'kick';
      const base = low ? 47 : kick ? 70 : 112;
      const drop = low ? 90 : 65;
      const pitchFall = kick ? 0.025 : 0.04;
      const phase =
        Math.PI * 2 * (base * time + drop * pitchFall * (1 - Math.exp(-time / pitchFall)));
      value =
        (Math.sin(phase) +
          Math.sin(phase * 1.52) * (kick ? 0.04 : 0.22) +
          Math.sin(phase * 2) * (kick ? 0 : 0.12)) *
          Math.exp(-time * (kick ? 32 : low ? 6.5 : 11)) +
        (kick ? softenedNoise : noise - softenedNoise) * Math.exp(-time * 100) * 0.12;
    }
    samples[index] = value * edge;
  }
  // A few quiet early reflections give space without a continuously running noise bed.
  if (sound.startsWith('drum-')) {
    const dry = samples.slice();
    for (const [delay, gain] of [
      [0.061, 0.2],
      [0.113, 0.12],
      [0.179, 0.07],
    ] as const) {
      const delaySamples = Math.round(delay * sampleRate);
      for (let index = delaySamples; index < samples.length; index++)
        samples[index]! += dry[index - delaySamples]! * gain;
    }
  }
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  if (peak > 0)
    for (let index = 0; index < samples.length; index++) {
      const remaining = (samples.length - index - 1) / sampleRate;
      samples[index] = (samples[index]! / peak) * 0.85 * Math.min(1, remaining / 0.04);
    }
  return samples;
}
