import type { Recording } from '../recording/record.ts';

export function recordingLabel(recording: Recording): string {
  if (recording.kind === 'fixture') return 'Scripted practice';
  return recording.generation?.status === 'complete' ? 'Recorded match' : 'Unfinished match';
}

export function formatTime(seconds: number): string {
  const secondsPerMinute = 60;
  const minutes = Math.floor(seconds / secondsPerMinute)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = Math.floor(seconds % secondsPerMinute)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export function formatPlayerId(playerId: string): string {
  return playerId.replace('-', ' #');
}
