import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { sample } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import { createStadium, drawCrowd } from '../render/stadium.ts';
import { STADIUM_SIZE } from '../render/layout.ts';
import { drawPlayers } from '../render/players.ts';
import { TICK_RATE } from '../sim/rules.ts';
import type { PlaybackAudio } from '../audio/playback-audio.ts';

const PRESENTATION_TIMING = {
  millisecondsPerSecond: 1000,
  maximumFrameGapSeconds: 0.25,
  controlsUpdateIntervalMs: 100,
} as const;

type PitchProps = {
  recording: Recording;
  playhead: RefObject<number>;
  isPlaying: boolean;
  speed: number;
  showPlayerNumbers: boolean;
  seekRevision: number;
  onAdvance: (seconds: number, ended: boolean) => void;
  audio: RefObject<PlaybackAudio | null>;
};

export function Pitch({
  recording,
  playhead,
  isPlaying,
  speed,
  showPlayerNumbers,
  seekRevision,
  onAdvance,
  audio,
}: PitchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d')!;
    backgroundRef.current ??= createStadium();
    const background = backgroundRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durationSeconds = recording.durationTicks / TICK_RATE;
    context.imageSmoothingEnabled = false;

    let animationFrameId = 0;
    let previousTimestamp: number | null = null;
    let lastControlsUpdate = 0;

    function draw(timestamp: number) {
      if (previousTimestamp !== null && isPlaying && !document.hidden) {
        const elapsedSeconds =
          (timestamp - previousTimestamp) / PRESENTATION_TIMING.millisecondsPerSecond;
        const boundedElapsed = Math.min(elapsedSeconds, PRESENTATION_TIMING.maximumFrameGapSeconds);
        playhead.current = Math.min(durationSeconds, playhead.current + boundedElapsed * speed);
      }
      previousTimestamp = timestamp;

      const frame = sample(recording, playhead.current);
      context.drawImage(background, 0, 0);
      drawCrowd(context, frame.tick, reducedMotion);
      drawPlayers(context, frame, recording, showPlayerNumbers, reducedMotion);
      audio.current?.advance(recording.events, frame.tick, isPlaying, speed, seekRevision);

      const hasEnded = playhead.current === durationSeconds;
      const controlsNeedUpdate =
        timestamp - lastControlsUpdate > PRESENTATION_TIMING.controlsUpdateIntervalMs;
      if (controlsNeedUpdate || hasEnded) {
        onAdvance(playhead.current, hasEnded);
        lastControlsUpdate = timestamp;
      }
      animationFrameId = requestAnimationFrame(draw);
    }

    // Returning to a tab resumes at the existing playhead without catching up.
    const resetTiming = () => {
      previousTimestamp = null;
    };
    document.addEventListener('visibilitychange', resetTiming);
    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', resetTiming);
    };
  }, [recording, playhead, isPlaying, speed, showPlayerNumbers, seekRevision, onAdvance, audio]);

  return (
    <canvas
      ref={canvasRef}
      width={STADIUM_SIZE.width}
      height={STADIUM_SIZE.height}
      aria-label="Top-down football pitch with 22 robot players. Teams swap ends at halftime."
      role="img"
    />
  );
}
