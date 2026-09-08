import { existsSync } from 'node:fs';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { scriptedSequenceControllers } from '../src/fixtures/sustained-play.ts';
import {
  planSequenceTrial,
  runSequenceTrial,
  sequenceModelControllers,
} from '../src/generation/sequence-trial.ts';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    mode: { type: 'string' },
    scenarios: { type: 'string' },
    repetitions: { type: 'string' },
    rounds: { type: 'string' },
    requests: { type: 'string' },
    'wall-seconds': { type: 'string' },
    usd: { type: 'string' },
    'openai-usd': { type: 'string' },
    'gemini-usd': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const name = z
  .string()
  .regex(/^[a-zA-Z0-9-]{1,80}$/)
  .parse(values.name ?? `sequences-${new Date().toISOString().replaceAll(/[^0-9]/g, '')}`);
const plan = planSequenceTrial({
  mode: values.mode,
  scenarios: values.scenarios?.split(','),
  repetitions: values.repetitions,
  rounds: values.rounds,
  requests: values.requests,
  wallSeconds: values['wall-seconds'],
  usd: values.usd,
  openaiUsd: values['openai-usd'],
  geminiUsd: values['gemini-usd'],
});
if (values['dry-run']) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
// Offline runs and every dry run neither load .env nor access provider credentials.
let models: ReturnType<typeof sequenceModelControllers> | null = null;
if (plan.mode === 'models') {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const openai = process.env.OPENAI_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  if (!openai || !gemini) throw new Error('Set OPENAI_API_KEY and GEMINI_API_KEY locally');
  models = sequenceModelControllers({ openai, gemini });
}
const folder = `artifacts/private/${name}`;
await mkdir('artifacts/private', { recursive: true });
const lock = await open('artifacts/private/generation.lock', 'wx').catch(() => {
  throw new Error('A generation lock exists. Stop the other run first.');
});
const abort = new AbortController();
process.once('SIGINT', () => abort.abort());
process.once('SIGTERM', () => abort.abort());
async function save(file: string, value: unknown) {
  await writeFile(`${folder}/${file}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${folder}/${file}.tmp`, `${folder}/${file}`);
}
try {
  await mkdir(folder); // A new name preserves all prior successes and failures.
  console.log(JSON.stringify({ name, plan }));
  const report = await runSequenceTrial({
    plan,
    controllersForScenario: (id) => models ?? scriptedSequenceControllers(id),
    signal: abort.signal,
    async onCheckpoint(report, recording) {
      if (recording) await save(report.activeRecordingFile!, recording);
      await save('report.json', report);
    },
    onProgress: (progress) => console.log(JSON.stringify(progress)),
  });
  const allCriteriaPassed =
    report.results.length === plan.plannedRuns &&
    report.results.every((result) => Object.values(result.criteria).every(Boolean));
  console.log(
    JSON.stringify({
      file: `${folder}/report.json`,
      status: report.status,
      stopReason: report.stopReason,
      allCriteriaPassed,
      runs: report.results.length,
      paidRequests: plan.mode === 'models' ? report.totals.requests : 0,
      ...report.totals,
    }),
  );
  if (report.status !== 'complete' || !allCriteriaPassed) process.exitCode = 1;
} finally {
  await lock.close();
  await rm('artifacts/private/generation.lock');
}
