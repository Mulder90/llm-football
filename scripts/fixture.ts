import { mkdir, writeFile } from 'node:fs/promises';
import { createFullMatchFixture } from '../src/fixtures/full-match.ts';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { TICK_RATE } from '../src/sim/rules.ts';
import { verifyRecording } from '../src/recording/record.ts';

const isFullMatch = process.argv.includes('--full');
const record = isFullMatch ? createFullMatchFixture() : createPassingFixture();
const outputPath = isFullMatch
  ? 'artifacts/full-match-fixture.json'
  : 'artifacts/passing-fixture.json';
verifyRecording(record);
await mkdir('artifacts', { recursive: true });
await writeFile(outputPath, JSON.stringify(record));
console.log(
  JSON.stringify(
    {
      file: outputPath,
      phase: record.frames.at(-1)!.phase,
      playingSeconds: record.frames.at(-1)!.playingTicks / TICK_RATE,
      score: record.frames.at(-1)!.score,
      seconds: record.durationTicks / TICK_RATE,
      hash: record.finalHash,
      samples: record.frames.length,
      events: record.events.length,
      kicks: record.events.filter((event) => event.type === 'kick').length,
      interceptions: record.events.filter((event) => event.type === 'interception').length,
    },
    null,
    2,
  ),
);
