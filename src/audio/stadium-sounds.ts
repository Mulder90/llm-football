import type { MatchEvent } from '../sim/types.ts';
import type { Team } from '../sim/types.ts';

export const SOUND_DURATIONS = {
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
  group: 'contact' | 'crowd' | 'whistle';
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
      return [
        cue('whistle-short', 0.18, 'whistle'),
        cue('goal-cheer', 0.34, 'crowd', 0.06, event.team ? supporterPan(event.team) : 0),
      ];
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

/** Original contacts and approved whistles. Crowd audio comes only from real recordings. */
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
      const pitchFall = 0.025;
      const phase = Math.PI * 2 * (70 * time + 65 * pitchFall * (1 - Math.exp(-time / pitchFall)));
      value =
        (Math.sin(phase) + Math.sin(phase * 1.52) * 0.04) * Math.exp(-time * 32) +
        softenedNoise * Math.exp(-time * 100) * 0.12;
    }
    samples[index] = value * edge;
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
