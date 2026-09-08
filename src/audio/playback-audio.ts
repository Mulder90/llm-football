import type { MatchEvent, MatchPhase } from '../sim/types.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { createSoundSamples, eventSoundCues, SOUND_DURATIONS } from './stadium-sounds.ts';
import type { SoundCue, SynthesizedSound } from './stadium-sounds.ts';

const MAXIMUM_VOICES = 18;
const MAXIMUM_EVENTS_PER_FRAME = 5;
const SOUND_SAMPLE_RATE = 24_000;
const AMBIENCE_GAIN = 0.045;
type RecordedSound = 'goal-cheer' | 'stadium-ambience';
const SIGNIFICANT_EVENTS = new Set([
  'goal',
  'restart_ready',
  'foul',
  'keeper_violation',
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
  panner: StereoPannerNode | null;
  group: SoundCue['group'] | 'ambience';
  terminal: boolean;
};

export class PlaybackAudio {
  private context = new AudioContext();
  private master = this.context.createGain();
  private buffers = new Map<SynthesizedSound | RecordedSound, AudioBuffer>();
  private recordingsLoad: Promise<void[]> | null = null;
  private ambience: Voice | null = null;
  private assetAbort = new AbortController();
  private voices = new Set<Voice>();
  private cursor: number | null = null;
  private revision = -1;
  private enabled = false;
  private volume = 0.45;
  private audible = false;
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
      this.recordingsLoad ??= Promise.all([
        this.loadRecording('goal-cheer', 'goal-roar.m4a'),
        this.loadRecording('stadium-ambience', 'stadium-ambience.m4a'),
      ]);
    } else {
      this.audible = false;
      this.stopVoices();
      this.setGain(0);
    }
  }
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    // The final whistle may be playing after Canvas has stopped drawing.
    if (this.audible) this.setGain(this.volume);
  }
  private async loadRecording(sound: RecordedSound, filename: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/${filename}`, {
        signal: this.assetAbort.signal,
      });
      if (!response.ok) return;
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      if (!this.assetAbort.signal.aborted) this.buffers.set(sound, buffer);
    } catch {
      // Missing recordings stay silent; never replace the crowd with synthesized noise.
    }
  }
  private setGain(value: number): void {
    if (value === this.currentGain) return;
    this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
    this.currentGain = value;
  }
  private stopVoices(group?: Voice['group'], keepTerminal = false): void {
    for (const voice of this.voices) {
      if (group && voice.group !== group) continue;
      if (keepTerminal && voice.terminal) continue;
      voice.envelope.gain.setTargetAtTime(0, this.context.currentTime, 0.006);
      voice.source.stop(this.context.currentTime + 0.03);
      this.voices.delete(voice);
      if (this.ambience === voice) this.ambience = null;
    }
  }
  private registerVoice(voice: Voice): void {
    this.voices.add(voice);
    voice.source.onended = () => {
      this.voices.delete(voice);
      if (this.ambience === voice) this.ambience = null;
      voice.source.disconnect();
      voice.envelope.disconnect();
      voice.panner?.disconnect();
    };
  }
  private startAmbience(tick: number, speed: number, phase: MatchPhase['type']): void {
    if (speed !== 1 || phase === 'full_time') {
      this.stopVoices('ambience');
      return;
    }
    const buffer = this.buffers.get('stadium-ambience');
    if (this.ambience || !buffer) return;
    if (this.voices.size >= MAXIMUM_VOICES) this.stopVoices('contact');
    if (this.voices.size >= MAXIMUM_VOICES) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const envelope = this.context.createGain();
    envelope.gain.value = 0;
    envelope.gain.setTargetAtTime(AMBIENCE_GAIN, this.context.currentTime, 0.6);
    source.connect(envelope).connect(this.master);
    this.ambience = { source, envelope, panner: null, group: 'ambience', terminal: false };
    this.registerVoice(this.ambience);
    // A baked overlap smooths the join; seeks choose their own place at natural pitch.
    source.start(this.context.currentTime, (tick / TICK_RATE) % buffer.duration);
  }
  private playSound(cue: SoundCue, variation: number, speed = 1): void {
    const buffer = this.buffers.get(cue.sound);
    if (!buffer) return;
    if (this.voices.size >= MAXIMUM_VOICES) this.stopVoices('contact');
    if (this.voices.size >= MAXIMUM_VOICES) return;
    const source = this.context.createBufferSource();
    const recordedCheer = cue.sound === 'goal-cheer';
    source.buffer = buffer;
    source.playbackRate.value = recordedCheer ? 1 : 1 + ((variation % 7) - 3) * 0.006;
    const envelope = this.context.createGain();
    envelope.gain.value = cue.gain;
    const panner = cue.pan === undefined ? null : this.context.createStereoPanner();
    if (panner) panner.pan.value = cue.pan!;
    source.connect(envelope).connect(panner ?? this.master);
    panner?.connect(this.master);
    const voice: Voice = {
      source,
      envelope,
      panner,
      group: cue.group,
      terminal: cue.terminal ?? false,
    };
    this.registerVoice(voice);
    const startsAt = this.context.currentTime + cue.delay;
    if (recordedCheer) {
      // Preserve real voices' pitch, but release the roar before a faster replay restarts play.
      const duration = buffer.duration / Math.max(1, speed);
      const fadeSeconds = Math.min(0.65, duration / 3);
      envelope.gain.setValueAtTime(cue.gain, startsAt + duration - fadeSeconds);
      envelope.gain.linearRampToValueAtTime(0, startsAt + duration);
      source.start(startsAt, 0, duration);
    } else source.start(startsAt);
  }
  private playEvent(event: MatchEvent, speed: number): void {
    const cues = eventSoundCues(event);
    if (cues.some((cue) => cue.group === 'whistle')) this.stopVoices('whistle');
    if (cues.some((cue) => cue.group === 'crowd')) this.stopVoices('crowd');
    for (const cue of cues) this.playSound(cue, event.id, speed);
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
    this.audible = audible;
    this.setGain(audible ? this.volume : 0);
    if (!playing && finalWhistle) this.stopVoices(undefined, true);
    if (this.cursor === null || seeking || interrupted || (!playing && !finalWhistle)) {
      this.stopVoices();
      this.cursor = tick;
      this.revision = seekRevision;
      return;
    }
    if (speed !== this.previousSpeed) {
      this.stopVoices('crowd');
      this.stopVoices('ambience');
    }
    this.previousSpeed = speed;
    if (playing) {
      for (const event of crossedAudioEvents(
        events,
        this.cursor,
        tick,
        speed,
        phase === 'full_time' ? tick : undefined,
      ))
        this.playEvent(event, speed);
      this.startAmbience(tick, speed, phase);
    }
    this.cursor = tick;
  }
  dispose(): void {
    this.assetAbort.abort();
    this.stopVoices();
    void this.context.close();
  }
}
