import { useCallback, useEffect, useRef, useState } from 'react';
import { TICK_RATE } from '../sim/rules.ts';
import { clamp } from '../sim/math.ts';
import type { Recording } from '../recording/record.ts';

export const KEYBOARD_SEEK_SECONDS = 5;

export function usePlayback(recording: Recording) {
  const durationSeconds = recording.durationTicks / TICK_RATE;
  const playhead = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [seekRevision, setSeekRevision] = useState(0);
  const hasEnded = seconds >= durationSeconds;

  const seekTo = useCallback(
    (targetSeconds: number) => {
      playhead.current = clamp(targetSeconds, 0, durationSeconds);
      setSeconds(playhead.current);
      setSeekRevision((revision) => revision + 1);
    },
    [durationSeconds],
  );

  const togglePlayback = useCallback(() => {
    if (playhead.current >= durationSeconds) seekTo(0);
    setIsPlaying((playing) => !playing);
  }, [durationSeconds, seekTo]);

  const replay = useCallback(() => {
    seekTo(0);
    setIsPlaying(true);
  }, [seekTo]);

  const onAdvance = useCallback((playbackSeconds: number, ended: boolean) => {
    setSeconds(playbackSeconds);
    if (ended) setIsPlaying(false);
  }, []);

  const rewind = useCallback(() => {
    seekTo(playhead.current - KEYBOARD_SEEK_SECONDS);
  }, [seekTo]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'A'].includes(target.tagName))
      )
        return;

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayback();
          break;
        case 'ArrowRight':
          event.preventDefault();
          seekTo(playhead.current + KEYBOARD_SEEK_SECONDS);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          seekTo(playhead.current - KEYBOARD_SEEK_SECONDS);
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [seekTo, togglePlayback]);

  return {
    durationSeconds,
    playhead,
    isPlaying,
    seconds,
    speed,
    seekRevision,
    hasEnded,
    setSpeed,
    seekTo,
    togglePlayback,
    replay,
    onAdvance,
    rewind,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
