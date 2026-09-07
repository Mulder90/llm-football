import { useEffect, useRef, useState } from 'react';
import { createPassingFixture } from '../fixtures/passing.ts';
import { sample } from '../recording/record.ts';
import { DecisionInspector, EventStrip } from './DecisionInspector.tsx';
import { Pitch } from './Pitch.tsx';
import { PlaybackControls } from './PlaybackControls.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import { usePlayback } from './usePlayback.ts';

const DOWNLOAD_URL_LIFETIME_MS = 1000;

export function App() {
  const [recording] = useState(createPassingFixture);
  const playback = usePlayback(recording);
  const frame = sample(recording, playback.seconds);
  const broadcastRef = useRef<HTMLElement>(null);
  const [showPlayerNumbers, setShowPlayerNumbers] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notice, setNotice] = useState('');

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
      setNotice('Fullscreen is unavailable in this browser. Playback remains available below.');
    }
  }

  function downloadRecording() {
    const file = new Blob([JSON.stringify(recording)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'passing-fixture.json';
    link.click();
    // Give the browser time to acquire the Blob before revoking its temporary URL.
    setTimeout(() => URL.revokeObjectURL(downloadUrl), DOWNLOAD_URL_LIFETIME_MS);
  }

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="AI Football home">
          <span className="pitch-mark" /> AI FOOTBALL{' '}
          <span className="wordmark-tag">AN OPEN EXPERIMENT</span>
        </a>
        <span className="header-note">
          <span className="status-dot" /> THE ENGINE ROOM
        </span>
        <a
          href="https://github.com/Mulder90/llm-football"
          target="_blank"
          rel="noreferrer"
          className="source-link"
        >
          Source code <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">ELEVEN A SIDE. A DIFFERENT KIND OF INTELLIGENCE.</p>
            <h1>
              The beautiful experiment<span>.</span>
            </h1>
            <p className="lede">A little stadium. Two teams. Every decision on the pitch.</p>
          </div>
          <div className="edition">
            <span>FOOTBALL LAB</span>
            <b>001</b>
          </div>
        </div>
        <section className="broadcast" aria-label="Match broadcast" ref={broadcastRef}>
          <div className="match-bar">
            <span className="fixture-badge">
              <span /> DEVELOPMENT FIXTURE
            </span>
            <span className="venue">
              NORTH GARDEN <i /> EVENING SESSION
            </span>
            <span className="recorded">RECORDED PLAYBACK</span>
          </div>
          <Scoreboard recording={recording} frame={frame} hasEnded={playback.hasEnded} />
          <div className="stadium-wrap">
            <Pitch
              recording={recording}
              playhead={playback.playhead}
              isPlaying={playback.isPlaying}
              speed={playback.speed}
              showPlayerNumbers={showPlayerNumbers}
              seekRevision={playback.seekRevision}
              onAdvance={playback.onAdvance}
            />
            {!playback.isPlaying && playback.seconds === 0 ? (
              <button className="start-overlay" onClick={playback.togglePlayback}>
                <span className="play-disc">▶</span>
                <span>
                  Watch the first exchange
                  <small>{playback.durationSeconds} seconds · scripted development fixture</small>
                </span>
              </button>
            ) : null}
            {playback.hasEnded ? (
              <div className="end-overlay">
                <span>THE FIRST EXCHANGE</span>
                <strong>Every touch, accounted for.</strong>
                <button onClick={playback.replay}>↻ Watch again</button>
              </div>
            ) : null}
          </div>
          {notice ? <p role="status">{notice}</p> : null}
          <PlaybackControls
            playback={playback}
            showPlayerNumbers={showPlayerNumbers}
            showInspector={showInspector}
            isFullscreen={isFullscreen}
            onToggleNumbers={() => setShowPlayerNumbers((visible) => !visible)}
            onToggleInspector={() => setShowInspector((visible) => !visible)}
            onToggleFullscreen={() => void toggleFullscreen()}
          />
          <EventStrip recording={recording} frame={frame} />
          {showInspector ? <DecisionInspector recording={recording} frame={frame} /> : null}
        </section>
        <section className="match-notes" aria-label="About this recording">
          <div>
            <p className="eyebrow">FROM THE TOUCHLINE</p>
            <h3>{recording.title}</h3>
            <p>
              Pass, move, find the space. A first look at the football engine, with all 22 players
              on the pitch and every touch preserved in the replay.
            </p>
            <div className="note-tags">
              <span>11 VS 11</span>
              <span>TOP-DOWN PIXEL ART</span>
              <span>DETERMINISTIC ENGINE</span>
            </div>
          </div>
          <div className="record-note">
            <span className="note-icon">◈</span>
            <div>
              <h4>A fixture, for now.</h4>
              <p>
                These are scripted teams. LLM-controlled matches arrive once the football mechanics
                and referee are ready.
              </p>
              <button className="download-link" onClick={downloadRecording}>
                Download the match record <span>↗</span>
              </button>
            </div>
          </div>
        </section>
      </main>
      <footer>
        <span>
          <span className="pitch-mark small" /> BUILT FOR THE LOVE OF THE GAME
        </span>
        <span>AI FOOTBALL · WORK IN PROGRESS</span>
      </footer>
    </>
  );
}
