import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { sample } from '../recording/record.ts';
import type { Recording } from '../recording/record.ts';
import { createStadium, drawCrowd } from '../render/stadium.ts';
import { STADIUM_SIZE } from '../render/layout.ts';
import { drawPlayers } from '../render/players.ts';
import { createRefereeTrack, drawReferee } from '../render/referee.ts';
import { drawGoalEffects } from '../render/goal-effects.ts';
import { drawDecisionFocus } from '../render/decision-focus.ts';
import { TICK_RATE } from '../sim/rules.ts';
import { recordingSecondsAt } from '../render/presentation-time.ts';
import type { PresentationTimeline } from '../render/presentation-time.ts';
import type { PlaybackAudio } from '../audio/playback-audio.ts';
import { cameraAt } from '../render/camera.ts';
import { atmosphereAt, createFootballMoments } from '../render/match-atmosphere.ts';
import { actionAccentAt, drawActionAccent, drawCarryAccents } from '../render/action-accents.ts';
import { drawSidelines } from '../render/sideline.ts';
import { kickoffFrame } from '../render/kickoff.ts';
import { celebrationFrame } from '../render/celebration.ts';
import { MatchMoment } from './MatchMoment.tsx';

const PRESENTATION_TIMING = {
  millisecondsPerSecond: 1000,
  maximumFrameGapSeconds: 0.25,
  controlsUpdateIntervalMs: 100,
} as const;

type PitchProps = {
  recording: Recording;
  timeline: PresentationTimeline;
  playhead: RefObject<number>;
  isPlaying: boolean;
  speed: number;
  showPlayerNumbers: boolean;
  wholePitch: boolean;
  reducedMotion: boolean;
  selectedPlayer: string | null;
  seekRevision: number;
  onAdvance: (seconds: number, ended: boolean) => void;
  audio: RefObject<PlaybackAudio | null>;
};

export function Pitch({
  recording,
  timeline,
  playhead,
  isPlaying,
  speed,
  showPlayerNumbers,
  wholePitch,
  reducedMotion,
  selectedPlayer,
  seekRevision,
  onAdvance,
  audio,
}: PitchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  // Animated lettering follows Canvas cadence locally; the score and inspector stay at 10 Hz.
  const [overlayFrame, setOverlayFrame] = useState(() =>
    sample(recording, recordingSecondsAt(timeline, playhead.current)),
  );
  const refereeTrack = useMemo(() => createRefereeTrack(recording), [recording]);
  const footballMoments = useMemo(() => createFootballMoments(recording), [recording]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d')!;
    backgroundRef.current ??= createStadium();
    const background = backgroundRef.current;
    const { durationSeconds } = timeline;
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

      const frame = sample(recording, recordingSecondsAt(timeline, playhead.current));
      setOverlayFrame(frame);
      const presentation = celebrationFrame(
        recording,
        kickoffFrame(recording, frame, reducedMotion),
        reducedMotion,
      );
      const camera = cameraAt(recording, frame, wholePitch, reducedMotion, presentation);
      const atmosphere = atmosphereAt(recording, frame, footballMoments);
      context.save();
      context.translate(STADIUM_SIZE.width / 2, STADIUM_SIZE.height / 2);
      context.scale(camera.zoom, camera.zoom);
      context.translate(-camera.x, -camera.y);
      context.drawImage(background, 0, 0);
      drawCrowd(context, frame, reducedMotion, playhead.current * TICK_RATE, atmosphere);
      drawSidelines(context, frame, atmosphere, playhead.current * TICK_RATE, reducedMotion);
      drawCarryAccents(context, recording, frame, reducedMotion);
      drawReferee(context, frame, refereeTrack, reducedMotion);
      const presentedFrame = drawPlayers(
        context,
        frame,
        recording,
        showPlayerNumbers,
        reducedMotion,
        playhead.current * TICK_RATE,
        footballMoments,
        presentation,
      );
      drawGoalEffects(context, frame, recording, reducedMotion, presentation);
      drawActionAccent(context, actionAccentAt(recording, frame, footballMoments), reducedMotion);
      drawDecisionFocus(context, presentedFrame, recording, selectedPlayer);
      context.restore();
      audio.current?.advance(
        recording.events,
        frame.tick,
        isPlaying,
        speed,
        seekRevision,
        frame.phase.type,
      );

      const hasEnded = playhead.current === durationSeconds;
      const controlsNeedUpdate =
        timestamp - lastControlsUpdate > PRESENTATION_TIMING.controlsUpdateIntervalMs;
      if (controlsNeedUpdate || hasEnded) {
        onAdvance(playhead.current, hasEnded);
        lastControlsUpdate = timestamp;
      }
      if (isPlaying && !hasEnded && !document.hidden)
        animationFrameId = requestAnimationFrame(draw);
    }

    // Returning to a tab resumes at the existing playhead without catching up.
    const resetTiming = () => {
      cancelAnimationFrame(animationFrameId);
      previousTimestamp = null;
      // Hidden tabs may stop rAF entirely; silence audio here instead of waiting for a frame.
      if (document.hidden) {
        const frame = sample(recording, recordingSecondsAt(timeline, playhead.current));
        audio.current?.advance(
          recording.events,
          frame.tick,
          false,
          speed,
          seekRevision,
          frame.phase.type,
        );
      } else animationFrameId = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', resetTiming);
    if (!document.hidden) animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', resetTiming);
    };
  }, [
    recording,
    timeline,
    refereeTrack,
    footballMoments,
    playhead,
    isPlaying,
    speed,
    showPlayerNumbers,
    wholePitch,
    reducedMotion,
    selectedPlayer,
    seekRevision,
    onAdvance,
    audio,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={STADIUM_SIZE.width}
        height={STADIUM_SIZE.height}
        aria-label="Top-down football pitch with robot players and a referee. Teams swap ends at halftime."
        role="img"
      />
      <MatchMoment recording={recording} frame={overlayFrame} reducedMotion={reducedMotion} />
    </>
  );
}
