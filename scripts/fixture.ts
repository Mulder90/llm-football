import { mkdir, writeFile } from 'node:fs/promises';
import { createPassingFixture } from '../src/fixtures/passing.ts';
import { TICK_RATE } from '../src/sim/rules.ts';
import { verifyRecording } from '../src/recording/record.ts';

const record = createPassingFixture();
verifyRecording(record);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/passing-fixture.json', JSON.stringify(record));
console.log(
  JSON.stringify(
    {
      file: 'artifacts/passing-fixture.json',
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
