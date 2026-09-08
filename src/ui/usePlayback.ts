import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clamp } from '../sim/math.ts';
import type { Recording } from '../recording/record.ts';
import { createPresentationTimeline, recordingSecondsAt } from '../render/presentation-time.ts';

export const KEYBOARD_SEEK_SECONDS = 5;

export function usePlayback(recording: Recording, onPlay?: () => void) {
  const timeline = useMemo(() => createPresentationTimeline(recording), [recording]);
  const { durationSeconds } = timeline;
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
    if (!isPlaying) onPlay?.();
    setIsPlaying((playing) => !playing);
  }, [durationSeconds, seekTo, isPlaying, onPlay]);

  const replay = useCallback(() => {
    seekTo(0);
    onPlay?.();
    setIsPlaying(true);
  }, [seekTo, onPlay]);

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
          ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'A', 'SUMMARY'].includes(target.tagName))
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
    timeline,
    recordingSeconds: recordingSecondsAt(timeline, seconds),
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
