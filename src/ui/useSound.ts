import { useEffect, useRef, useState } from 'react';
import { PlaybackAudio } from '../audio/playback-audio.ts';

export function useSound(onError: (message: string) => void) {
  const audio = useRef<PlaybackAudio | null>(null);
  const [muted, setMuted] = useState(true);
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
      audio.current ??= new PlaybackAudio(); // Created only inside a user gesture.
      await audio.current.setEnabled(muted);
      setMuted(!muted);
    } catch {
      onError('Audio is unavailable in this browser.');
    }
  }
  function changeVolume(value: number) {
    setVolume(value);
    audio.current?.setVolume(value);
  }
  return { audio, muted, volume, toggleMute, changeVolume };
}
