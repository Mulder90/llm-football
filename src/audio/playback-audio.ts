import type { MatchEvent } from '../sim/types.ts';

const AUDIO = {
  maximumVoices: 12,
  maximumEventsPerFrame: 4,
  ambienceGain: 0.018,
  effectGain: 0.18,
} as const;
const SIGNIFICANT_EVENTS = new Set(['goal', 'restart_ready', 'halftime', 'full_time']);

/** Seeking is handled by resetting the cursor, never by replaying historical events. */
export function crossedAudioEvents(
  events: MatchEvent[],
  previousTick: number,
  tick: number,
  speed: number,
): MatchEvent[] {
  if (tick <= previousTick) return [];
  return events
    .filter((event) => {
      // A goal's new score is visible after the incident's fixed step completes.
      const audibleTick = event.tick + (event.type === 'goal' ? 1 : 0);
      return (
        audibleTick > previousTick &&
        audibleTick <= tick &&
        (speed <= 2 || SIGNIFICANT_EVENTS.has(event.type))
      );
    })
    .slice(-AUDIO.maximumEventsPerFrame);
}
function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let seed = 7919;
  for (let index = 0; index < samples.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[index] = seed / 2147483648 - 1;
  }
  return buffer;
}
export class PlaybackAudio {
  private context = new AudioContext();
  private master = this.context.createGain();
  private ambience = this.context.createGain();
  private voices = new Set<AudioScheduledSourceNode>();
  private cursor: number | null = null;
  private revision = -1;
  private enabled = false;
  private volume = 0.45;
  private currentGain = 0;
  constructor() {
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    const crowd = this.context.createBufferSource();
    crowd.buffer = noiseBuffer(this.context, 3);
    crowd.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 470;
    filter.Q.value = 0.4;
    crowd.connect(filter).connect(this.ambience).connect(this.master);
    this.ambience.gain.value = AUDIO.ambienceGain;
    crowd.start();
  }
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) await this.context.resume();
    this.enabled = enabled;
    if (!enabled) this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
  }
  setVolume(volume: number): void {
    this.volume = volume;
  }
  private voice(
    source: AudioScheduledSourceNode,
    envelope: GainNode,
    duration: number,
    gain: number,
    delay = 0,
  ) {
    if (this.voices.size >= AUDIO.maximumVoices) return;
    const start = this.context.currentTime + delay;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + Math.min(0.015, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    envelope.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      envelope.disconnect();
    };
  }
  private tone(frequency: number, endFrequency: number, duration: number, gain: number, delay = 0) {
    const source = this.context.createOscillator();
    source.type = 'sine';
    source.frequency.setValueAtTime(frequency, this.context.currentTime + delay);
    source.frequency.exponentialRampToValueAtTime(
      endFrequency,
      this.context.currentTime + delay + duration,
    );
    const envelope = this.context.createGain();
    source.connect(envelope);
    this.voice(source, envelope, duration, gain, delay);
  }
  private rush(duration: number, gain: number, frequency: number) {
    const source = this.context.createBufferSource();
    source.buffer = noiseBuffer(this.context, duration);
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.5;
    const envelope = this.context.createGain();
    source.connect(filter).connect(envelope);
    this.voice(source, envelope, duration, gain);
  }
  private play(event: MatchEvent) {
    switch (event.type) {
      case 'kick':
      case 'shot':
        this.tone(120, 48, 0.09, AUDIO.effectGain);
        break;
      case 'tackle':
      case 'block':
      case 'save':
        this.rush(0.13, 0.13, 480);
        break;
      case 'post':
        this.tone(740, 560, 0.25, 0.11);
        break;
      case 'restart_ready':
      case 'foul':
      case 'offside':
        this.tone(2450, 2650, 0.18, 0.055);
        break;
      case 'halftime':
      case 'full_time':
        for (const delay of [0, 0.3, 0.6]) this.tone(2450, 2630, 0.2, 0.06, delay);
        break;
      case 'goal':
        this.rush(1.8, 0.4, 800);
        [523.25, 659.25, 783.99].forEach((frequency, index) =>
          this.tone(frequency, frequency, 0.28, 0.075, index * 0.11),
        );
        break;
    }
  }
  advance(
    events: MatchEvent[],
    tick: number,
    playing: boolean,
    speed: number,
    seekRevision: number,
  ) {
    const audible = playing && this.enabled && !document.hidden;
    const nextGain = audible ? this.volume : 0;
    if (nextGain !== this.currentGain) {
      this.master.gain.setTargetAtTime(nextGain, this.context.currentTime, 0.025);
      this.currentGain = nextGain;
    }
    if (this.cursor === null || this.revision !== seekRevision || !audible || tick < this.cursor) {
      if (this.revision !== seekRevision || !audible)
        for (const source of this.voices) source.stop();
      this.cursor = tick;
      this.revision = seekRevision;
      return;
    }
    for (const event of crossedAudioEvents(events, this.cursor, tick, speed)) this.play(event);
    this.cursor = tick;
  }
  dispose(): void {
    void this.context.close();
  }
}
