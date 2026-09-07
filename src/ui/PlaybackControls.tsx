import type { CSSProperties } from 'react';
import type { Playback } from './usePlayback.ts';
import { formatTime } from './format.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { useSound } from './useSound.ts';

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 4];

type ControlsProps = {
  playback: Playback;
  showPlayerNumbers: boolean;
  showInspector: boolean;
  isFullscreen: boolean;
  onToggleNumbers: () => void;
  onToggleInspector: () => void;
  onToggleFullscreen: () => void;
  sound: ReturnType<typeof useSound>;
};

export function PlaybackControls({
  playback,
  showPlayerNumbers,
  showInspector,
  isFullscreen,
  onToggleNumbers,
  onToggleInspector,
  onToggleFullscreen,
  sound,
}: ControlsProps) {
  const playLabel = playback.isPlaying ? 'Pause' : playback.hasEnded ? 'Replay' : 'Play';
  const playIcon = playback.isPlaying ? 'Ⅱ' : playback.hasEnded ? '↻' : '▶';
  const progressStyle = {
    '--progress': `${(playback.seconds / playback.durationSeconds) * 100}%`,
  } as CSSProperties;

  return (
    <div className="transport">
      <div className="timeline">
        <input
          aria-label="Replay position"
          type="range"
          min={0}
          max={Math.round(playback.durationSeconds * TICK_RATE)}
          step={1}
          value={Math.round(playback.seconds * TICK_RATE)}
          aria-valuetext={`${formatTime(playback.seconds)} of ${formatTime(playback.durationSeconds)}`}
          onChange={(event) => playback.seekTo(Number(event.target.value) / TICK_RATE)}
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
          <span className="control-divider" />
          <label className="speed-label">
            <span className="sr-only">Playback speed</span>
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
        </div>
        <div className="control-group">
          <button
            className="icon-button sound-button"
            aria-label={sound.muted ? 'Unmute stadium sound' : 'Mute stadium sound'}
            onClick={() => void sound.toggleMute()}
          >
            {sound.muted ? '♩' : '♫'}
          </button>
          {!sound.muted && (
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
          )}
          <button
            className={`text-button numbers ${showPlayerNumbers ? 'selected' : ''}`}
            onClick={onToggleNumbers}
            aria-pressed={showPlayerNumbers}
          >
            # <span>Players</span>
          </button>
          <button
            className={`text-button ${showInspector ? 'selected' : ''}`}
            aria-expanded={showInspector}
            aria-controls="decision-inspector"
            onClick={onToggleInspector}
          >
            ⌘ <span>Decisions</span>
          </button>
          <button
            className="icon-button fullscreen"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={onToggleFullscreen}
          >
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}
