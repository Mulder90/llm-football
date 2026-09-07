import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { parseRecording } from '../src/recording/validate.ts';
import { verifyRecording } from '../src/recording/record.ts';
import { z } from 'zod';

const input = process.argv[2];
if (!input) throw new Error('Usage: pnpm publish-recording artifacts/private/<match>/match.json');
const raw = await readFile(input, 'utf8');
const recording = parseRecording(JSON.parse(raw));
verifyRecording(recording);
const id = z
  .string()
  .regex(/^[a-zA-Z0-9-]{1,80}$/)
  .parse(recording.initial.matchId);
const catalogSchema = z.strictObject({
  version: z.literal(1),
  matches: z.array(
    z.strictObject({ id: z.string(), file: z.string(), title: z.string(), complete: z.boolean() }),
  ),
});
const catalog = catalogSchema.parse(
  JSON.parse(await readFile('public/matches/index.json', 'utf8')),
);
const file = `${id}.json.gz`;
await mkdir('public/matches', { recursive: true });
const compressed = gzipSync(raw, { level: 9 });
await writeFile(`public/matches/${file}`, compressed);
catalog.matches = [
  { id, file, title: recording.title, complete: recording.generation?.status === 'complete' },
  ...catalog.matches.filter((entry) => entry.id !== id),
];
await writeFile('public/matches/index.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(
  JSON.stringify({
    file: `public/matches/${file}`,
    originalBytes: Buffer.byteLength(raw),
    compressedBytes: compressed.byteLength,
    hash: recording.finalHash,
    status: recording.generation?.status,
  }),
);
