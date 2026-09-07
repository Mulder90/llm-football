import { useEffect, useRef, useState } from 'react';
import { sample } from '../recording/record.ts';
import { DecisionInspector, EventStrip } from './DecisionInspector.tsx';
import type { InspectorTab } from './DecisionInspector.tsx';
import { Pitch } from './Pitch.tsx';
import { PlaybackControls } from './PlaybackControls.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import { usePlayback } from './usePlayback.ts';
import { formatTime } from './format.ts';
import { MatchMoment } from './MatchMoment.tsx';
import { useRecordings } from './useRecordings.ts';
import { useSound } from './useSound.ts';

const DOWNLOAD_URL_LIFETIME_MS = 1000;
export function App() {
  const library = useRecordings();
  return <BroadcastPage key={library.recording.initial.matchId} library={library} />;
}
function BroadcastPage({ library }: { library: ReturnType<typeof useRecordings> }) {
  const { recording } = library;
  const playback = usePlayback(recording);
  const frame = sample(recording, playback.seconds);
  const broadcastRef = useRef<HTMLElement>(null);
  const inspectorTrigger = useRef<HTMLButtonElement>(null);
  const [showPlayerNumbers, setShowPlayerNumbers] = useState(false);
  const [panel, setPanel] = useState<InspectorTab | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const sound = useSound(setNotice);
  function closeInspector() {
    setPanel(null);
    inspectorTrigger.current?.focus();
  }

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
        <div className="broadcast-topline">
          <span>
            <i className="status-dot" /> NORTH GARDEN
          </span>
          <span>
            {recording.kind === 'llm'
              ? recording.generation?.status === 'complete'
                ? 'AI FOOTBALL'
                : 'LLM EXCERPT · INCOMPLETE'
              : 'DEVELOPMENT FIXTURE'}{' '}
            · RECORDED
          </span>
          <button
            ref={inspectorTrigger}
            onClick={() => setPanel(panel ? null : 'decisions')}
            aria-expanded={panel !== null}
            aria-controls="decision-inspector"
          >
            Behind the match <span aria-hidden="true">☷</span>
          </button>
        </div>
        <Scoreboard recording={recording} frame={frame} hasEnded={playback.hasEnded} />
        <div className="stadium-wrap">
          <Pitch
            recording={recording}
            playhead={playback.playhead}
            isPlaying={playback.isPlaying}
            speed={playback.speed}
            showPlayerNumbers={showPlayerNumbers}
            selectedPlayer={panel === 'decisions' ? selectedPlayer : null}
            seekRevision={playback.seekRevision}
            onAdvance={playback.onAdvance}
            audio={sound.audio}
          />
          <MatchMoment recording={recording} frame={frame} />
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
                  {formatTime(playback.durationSeconds)} ·{' '}
                  {recording.kind === 'llm'
                    ? 'LLM-controlled football'
                    : 'scripted development fixture'}
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
        </div>
        {(notice || library.loadError || library.loading) && (
          <p className="notice" role="status">
            {notice || library.loadError || 'Loading match…'}
          </p>
        )}
        <PlaybackControls
          playback={playback}
          showPlayerNumbers={showPlayerNumbers}
          showInspector={panel !== null}
          isFullscreen={isFullscreen}
          onToggleNumbers={() => setShowPlayerNumbers((visible) => !visible)}
          onToggleInspector={() => setPanel(panel ? null : 'decisions')}
          onToggleFullscreen={() => void toggleFullscreen()}
          sound={sound}
        />
        <EventStrip recording={recording} frame={frame} />
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
