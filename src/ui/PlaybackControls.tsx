import type { CSSProperties, Ref } from 'react';
import type { Playback } from './usePlayback.ts';
import { formatTime } from './format.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { useSound } from './useSound.ts';

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 4];

type ControlsProps = {
  containerRef?: Ref<HTMLDivElement>;
  hidden?: boolean;
  playback: Playback;
  showPlayerNumbers: boolean;
  wholePitch: boolean;
  reducedMotion: boolean;
  onToggleWholePitch: () => void;
  isFullscreen: boolean;
  onToggleNumbers: () => void;
  onToggleFullscreen: () => void;
  sound: ReturnType<typeof useSound>;
};

export function PlaybackControls({
  containerRef,
  hidden = false,
  playback,
  showPlayerNumbers,
  wholePitch,
  reducedMotion,
  onToggleWholePitch,
  isFullscreen,
  onToggleNumbers,
  onToggleFullscreen,
  sound,
}: ControlsProps) {
  const playLabel = playback.isPlaying ? 'Pause' : playback.hasEnded ? 'Replay' : 'Play';
  const playIcon = playback.isPlaying ? 'Ⅱ' : playback.hasEnded ? '↻' : '▶';
  const progressStyle = {
    '--progress': `${(playback.seconds / playback.durationSeconds) * 100}%`,
  } as CSSProperties;
  const sliderMaximum = Math.round(playback.durationSeconds * TICK_RATE);

  return (
    <div
      className={`transport${hidden ? ' transport-hidden' : ''}`}
      ref={containerRef}
      inert={hidden}
      aria-hidden={hidden || undefined}
    >
      <div className="timeline">
        <input
          aria-label="Replay position"
          type="range"
          min={0}
          max={sliderMaximum}
          step={1}
          value={Math.round(playback.seconds * TICK_RATE)}
          aria-valuetext={`${formatTime(playback.seconds)} of ${formatTime(playback.durationSeconds)}`}
          onChange={(event) => {
            const position = Number(event.target.value);
            playback.seekTo(
              position === sliderMaximum ? playback.durationSeconds : position / TICK_RATE,
            );
          }}
          style={progressStyle}
        />
      </div>
      <div className="control-row">
        <div className="control-group">
          <button className="play-button" aria-label={playLabel} onClick={playback.togglePlayback}>
            {playIcon}
          </button>
          <button
            className="icon-button rewind"
            aria-label="Rewind five seconds"
            onClick={playback.rewind}
          >
            ↶<small>5</small>
          </button>
          <span className="playback-time">
            {formatTime(playback.seconds)} <span>/ {formatTime(playback.durationSeconds)}</span>
          </span>
        </div>
        <div className="control-group">
          <button
            className="icon-button sound-button"
            aria-label={sound.muted ? 'Unmute stadium sound' : 'Mute stadium sound'}
            onClick={() => void sound.toggleMute()}
          >
            {sound.muted ? '♩' : '♫'}
          </button>
          <details className="viewing-options">
            <summary aria-label="Viewing options">•••</summary>
            <div className="viewing-options-panel">
              <button
                className={`text-button ${wholePitch ? 'selected' : ''}`}
                onClick={onToggleWholePitch}
                aria-pressed={wholePitch}
                disabled={reducedMotion}
              >
                Whole pitch <span>{wholePitch ? 'On' : 'Off'}</span>
              </button>
              {reducedMotion ? (
                <p className="viewing-option-note">
                  Camera motion is off with your device's reduced-motion setting.
                </p>
              ) : null}
              <label className="speed-label">
                Playback speed
                <select
                  value={playback.speed}
                  onChange={(event) => playback.setSpeed(Number(event.target.value))}
                >
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}×
                    </option>
                  ))}
                </select>
              </label>
              <label className="volume-label">
                Stadium volume
                <input
                  className="volume-control"
                  aria-label="Stadium volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={sound.volume}
                  onChange={(event) => sound.changeVolume(Number(event.target.value))}
                />
              </label>
              <button
                className={`text-button ${showPlayerNumbers ? 'selected' : ''}`}
                onClick={onToggleNumbers}
                aria-pressed={showPlayerNumbers}
              >
                Player numbers <span>{showPlayerNumbers ? 'On' : 'Off'}</span>
              </button>
              <button className="text-button" onClick={onToggleFullscreen}>
                {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}{' '}
                <span aria-hidden="true">⛶</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
