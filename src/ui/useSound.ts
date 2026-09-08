import { useEffect, useRef, useState } from 'react';
import { PlaybackAudio } from '../audio/playback-audio.ts';

export function useSound(onError: (message: string) => void) {
  const audio = useRef<PlaybackAudio | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.45);
  useEffect(
    () => () => {
      audio.current?.dispose();
      audio.current = null;
    },
    [],
  );
  async function toggleMute() {
    try {
      if (muted) {
        audio.current ??= new PlaybackAudio();
        audio.current.setVolume(volume);
      }
      await audio.current?.setEnabled(muted);
      setMuted(!muted);
    } catch {
      onError('Audio is unavailable in this browser.');
    }
  }
  async function unlockFromGesture() {
    if (muted) return;
    try {
      audio.current ??= new PlaybackAudio(); // Creation/resume stays inside the play gesture.
      audio.current.setVolume(volume);
      await audio.current.setEnabled(true);
    } catch {
      setMuted(true);
      onError('Audio is unavailable in this browser.');
    }
  }
  function changeVolume(value: number) {
    setVolume(value);
    audio.current?.setVolume(value);
  }
  return { audio, muted, volume, toggleMute, changeVolume, unlockFromGesture };
}
