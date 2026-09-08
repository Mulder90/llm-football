import type { MatchEvent, MatchPhase } from '../sim/types.ts';
import {
  createSoundSamples,
  crossedDrumBeats,
  eventSoundCues,
  SOUND_DURATIONS,
} from './stadium-sounds.ts';
import type { SoundCue, SynthesizedSound } from './stadium-sounds.ts';

const MAXIMUM_VOICES = 18;
const MAXIMUM_EVENTS_PER_FRAME = 5;
const SOUND_SAMPLE_RATE = 24_000;
const SIGNIFICANT_EVENTS = new Set([
  'goal',
  'restart_ready',
  'foul',
  'offside',
  'ball_out',
  'halftime',
  'full_time',
  'abandoned',
]);
const CLOCK_EVENTS = new Set(['restart_ready', 'halftime', 'full_time']);

/** Seeks reset the cursor. Terminal clock events already belong to their recorded frame. */
export function crossedAudioEvents(
  events: MatchEvent[],
  previousTick: number,
  tick: number,
  speed: number,
  terminalTick?: number,
): MatchEvent[] {
  if (tick <= previousTick) return [];
  return events
    .filter((event) => {
      // Abandonment can happen during contact or after the clock increments.
      const audibleTick =
        event.type === 'abandoned'
          ? (terminalTick ?? event.tick + 1)
          : event.tick + (CLOCK_EVENTS.has(event.type) ? 0 : 1);
      return (
        audibleTick > previousTick &&
        audibleTick <= tick &&
        (speed <= 2 || SIGNIFICANT_EVENTS.has(event.type)) &&
        eventSoundCues(event).length > 0
      );
    })
    .sort(
      (first, second) =>
        Number(SIGNIFICANT_EVENTS.has(second.type)) - Number(SIGNIFICANT_EVENTS.has(first.type)),
    )
    .slice(0, MAXIMUM_EVENTS_PER_FRAME)
    .sort((first, second) => first.id - second.id);
}

type Voice = {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  group: SoundCue['group'];
  terminal: boolean;
};

export class PlaybackAudio {
  private context = new AudioContext();
  private master = this.context.createGain();
  private buffers = new Map<SynthesizedSound, AudioBuffer>();
  private goalCheer: AudioBuffer | null = null;
  private goalCheerLoad: Promise<void> | null = null;
  private assetAbort = new AbortController();
  private voices = new Set<Voice>();
  private cursor: number | null = null;
  private revision = -1;
  private enabled = false;
  private volume = 0.45;
  private currentGain = 0;
  private previousSpeed = 1;

  constructor() {
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (enabled) {
      const resumed = this.context.resume();
      // Prepare once during the play gesture, so a goal never synthesizes audio inside drawing.
      for (const sound of Object.keys(SOUND_DURATIONS) as SynthesizedSound[]) {
        if (this.buffers.has(sound)) continue;
        const samples = createSoundSamples(sound, SOUND_SAMPLE_RATE);
        const buffer = this.context.createBuffer(1, samples.length, SOUND_SAMPLE_RATE);
        buffer.getChannelData(0).set(samples);
        this.buffers.set(sound, buffer);
      }
      await resumed;
      this.goalCheerLoad ??= this.loadGoalCheer();
    } else {
      this.stopVoices();
      this.setGain(0);
    }
  }
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
  private async loadGoalCheer(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/goal-cheer.mp3`, {
        signal: this.assetAbort.signal,
      });
      if (!response.ok) return;
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      if (!this.assetAbort.signal.aborted) this.goalCheer = buffer;
    } catch {
      // Goals retain their whistle when the local cheer is unavailable.
    }
  }
  private setGain(value: number): void {
    if (value === this.currentGain) return;
    this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
    this.currentGain = value;
  }
  private stopVoices(group?: SoundCue['group']): void {
    for (const voice of this.voices) {
      if (group && voice.group !== group) continue;
      voice.envelope.gain.setTargetAtTime(0, this.context.currentTime, 0.006);
      voice.source.stop(this.context.currentTime + 0.03);
      this.voices.delete(voice);
    }
  }
  private playSound(cue: SoundCue, variation: number): void {
    const buffer = cue.sound === 'goal-cheer' ? this.goalCheer : this.buffers.get(cue.sound);
    if (!buffer) return;
    if (this.voices.size >= MAXIMUM_VOICES) this.stopVoices('contact');
    if (this.voices.size >= MAXIMUM_VOICES) return;
    const source = this.context.createBufferSource();
    const recordedCheer = cue.sound === 'goal-cheer';
    source.buffer = buffer;
    source.playbackRate.value = recordedCheer ? 1 : 1 + ((variation % 7) - 3) * 0.006;
    const envelope = this.context.createGain();
    envelope.gain.value = cue.gain;
    source.connect(envelope).connect(this.master);
    const voice: Voice = { source, envelope, group: cue.group, terminal: cue.terminal ?? false };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      envelope.disconnect();
    };
    source.start(this.context.currentTime + cue.delay);
  }
  private playEvent(event: MatchEvent): void {
    const cues = eventSoundCues(event);
    if (cues.some((cue) => cue.group === 'whistle')) this.stopVoices('whistle');
    if (cues.some((cue) => cue.group === 'crowd')) this.stopVoices('crowd');
    for (const cue of cues) this.playSound(cue, event.id);
  }

  advance(
    events: MatchEvent[],
    tick: number,
    playing: boolean,
    speed: number,
    seekRevision: number,
    phase: MatchPhase['type'] = 'open_play',
  ): void {
    const interrupted = !this.enabled || document.hidden;
    const seeking = this.revision !== seekRevision || (this.cursor !== null && tick < this.cursor);
    const finalWhistle = phase === 'full_time' && [...this.voices].some((voice) => voice.terminal);
    const audible = !interrupted && (playing || finalWhistle);
    this.setGain(audible ? this.volume : 0);
    if (this.cursor === null || seeking || interrupted || (!playing && !finalWhistle)) {
      this.stopVoices();
      this.cursor = tick;
      this.revision = seekRevision;
      return;
    }
    if (speed !== this.previousSpeed || phase !== 'open_play') this.stopVoices('drum');
    this.previousSpeed = speed;
    if (playing) {
      for (const event of crossedAudioEvents(
        events,
        this.cursor,
        tick,
        speed,
        phase === 'full_time' ? tick : undefined,
      ))
        this.playEvent(event);
      if (phase === 'open_play')
        for (const beat of crossedDrumBeats(this.cursor, tick, speed))
          this.playSound(beat, Math.floor(tick));
    }
    this.cursor = tick;
  }
  dispose(): void {
    this.assetAbort.abort();
    this.stopVoices();
    void this.context.close();
  }
}
