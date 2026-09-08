import { useEffect, useRef, useState } from 'react';
import { sample } from '../recording/record.ts';
import { DecisionInspector } from './DecisionInspector.tsx';
import type { InspectorTab } from './DecisionInspector.tsx';
import { Pitch } from './Pitch.tsx';
import { PlaybackControls } from './PlaybackControls.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import { usePlayback } from './usePlayback.ts';
import { formatTime, recordingLabel } from './format.ts';
import { useRecordings } from './useRecordings.ts';
import { useSound } from './useSound.ts';
import { useControlsVisibility } from './useControlsVisibility.ts';

const DOWNLOAD_URL_LIFETIME_MS = 1000;
export function App() {
  const library = useRecordings();
  return <BroadcastPage key={library.recording.initial.matchId} library={library} />;
}
function BroadcastPage({ library }: { library: ReturnType<typeof useRecordings> }) {
  const { recording } = library;
  const [notice, setNotice] = useState('');
  const sound = useSound(setNotice);
  const playback = usePlayback(recording, () => void sound.unlockFromGesture());
  const frame = sample(recording, playback.recordingSeconds);
  const broadcastRef = useRef<HTMLElement>(null);
  const inspectorTrigger = useRef<HTMLButtonElement>(null);
  const [showPlayerNumbers, setShowPlayerNumbers] = useState(false);
  const [wholePitch, setWholePitch] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [panel, setPanel] = useState<InspectorTab | null>(null);
  const controlsVisibility = useControlsVisibility(playback.isPlaying, panel !== null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  function closeInspector() {
    setPanel(null);
    inspectorTrigger.current?.focus();
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', updateMotion);
    return () => preference.removeEventListener('change', updateMotion);
  }, []);
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await broadcastRef.current?.requestFullscreen();
    } catch {
      setNotice('Fullscreen is unavailable in this browser.');
    }
  }
  function downloadRecording() {
    const file = new Blob([JSON.stringify(recording)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${recording.initial.matchId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), DOWNLOAD_URL_LIFETIME_MS);
  }
  return (
    <main className={`broadcast-app ${panel ? 'with-inspector' : ''}`} ref={broadcastRef}>
      <section className="watch-area" aria-label="Match broadcast">
        <div className="stadium-wrap" ref={controlsVisibility.surfaceRef}>
          <Pitch
            recording={recording}
            timeline={playback.timeline}
            playhead={playback.playhead}
            isPlaying={playback.isPlaying}
            speed={playback.speed}
            showPlayerNumbers={showPlayerNumbers}
            wholePitch={wholePitch}
            reducedMotion={reducedMotion}
            selectedPlayer={panel === 'decisions' ? selectedPlayer : null}
            seekRevision={playback.seekRevision}
            onAdvance={playback.onAdvance}
            audio={sound.audio}
          />
          <Scoreboard recording={recording} frame={frame} hasEnded={playback.hasEnded} />
          <button
            className="inside-match-button"
            ref={inspectorTrigger}
            onClick={() => setPanel(panel ? null : 'decisions')}
            aria-expanded={panel !== null}
            aria-controls="decision-inspector"
          >
            <span aria-hidden="true">☷</span> Inside the match
          </button>
          {!playback.isPlaying && playback.seconds === 0 && (
            <button
              className="start-overlay"
              onClick={playback.togglePlayback}
              disabled={library.loading}
            >
              <span className="play-disc">▶</span>
              <span>
                {library.loading ? 'Getting the match ready…' : 'Watch the match'}
                <small>
                  {formatTime(playback.durationSeconds)} · {recordingLabel(recording)}
                </small>
              </span>
            </button>
          )}
          {playback.hasEnded && (
            <div className="end-overlay">
              <span>
                {frame.phase.type === 'full_time' && frame.phase.reason === 'completed'
                  ? 'FULL TIME'
                  : 'END OF RECORDING'}
              </span>
              <strong>
                {frame.score.coral} — {frame.score.cyan}
              </strong>
              <p>
                {recording.teams.coral.name} · {recording.teams.cyan.name}
              </p>
              <button onClick={playback.replay}>↻ Watch again</button>
            </div>
          )}
          {(notice || library.loadError || library.loading) && (
            <p className="notice" role="status">
              {notice || library.loadError || 'Loading match…'}
            </p>
          )}
          <PlaybackControls
            containerRef={controlsVisibility.controlsRef}
            hidden={controlsVisibility.hidden}
            playback={playback}
            showPlayerNumbers={showPlayerNumbers}
            wholePitch={wholePitch || reducedMotion}
            reducedMotion={reducedMotion}
            onToggleWholePitch={() => setWholePitch((visible) => !visible)}
            isFullscreen={isFullscreen}
            onToggleNumbers={() => setShowPlayerNumbers((visible) => !visible)}
            onToggleFullscreen={() => void toggleFullscreen()}
            sound={sound}
          />
        </div>
      </section>
      {panel && (
        <DecisionInspector
          recording={recording}
          frame={frame}
          tab={panel}
          onTab={setPanel}
          onClose={closeInspector}
          isPlaying={playback.isPlaying}
          onTogglePlayback={playback.togglePlayback}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={(id) => setSelectedPlayer((selected) => (selected === id ? null : id))}
          matches={library.matches}
          loading={library.loading}
          onSelectFixture={(id) => void library.selectRecording(id)}
          onImport={(file) => void library.importRecording(file)}
          onDownload={downloadRecording}
        />
      )}
    </main>
  );
}
