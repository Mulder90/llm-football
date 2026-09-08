import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  createFootballSequence,
  scriptedSequenceControllers,
  SEQUENCE_IDS,
} from '../src/fixtures/sustained-play.ts';
import { evaluateSequence, SEQUENCE_LIMITS } from '../src/generation/sequences.ts';
import { requestInputBytes } from '../src/generation/budget.ts';
import { observe } from '../src/protocol/observation.ts';
import { rulebook } from '../src/protocol/rulebook.ts';
import { verifyRecording } from '../src/recording/record.ts';
import { TICK_RATE } from '../src/sim/rules.ts';

// Deliberately offline: this CLI neither loads .env nor constructs a provider adapter.
const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    scenarios: { type: 'string' },
    repetitions: { type: 'string', default: '1' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const name = z
  .string()
  .regex(/^[a-zA-Z0-9-]{1,80}$/)
  .parse(values.name ?? `sequences-${new Date().toISOString().replaceAll(/[^0-9]/g, '')}`);
const ids = z
  .array(z.enum(SEQUENCE_IDS))
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, 'Choose each scenario once')
  .parse(values.scenarios?.split(',') ?? SEQUENCE_IDS);
const repetitions = z.coerce.number().int().min(1).max(3).parse(values.repetitions);
const plannedRuns = ids.length * repetitions;
const plan = {
  mode: 'scripted',
  repetitions,
  plannedRuns,
  seed: 34891,
  maximumRoundsPerRun: SEQUENCE_LIMITS.maximumDecisions,
  baseRequestCeilingPerRun: 2 * SEQUENCE_LIMITS.maximumDecisions,
  requestCeilingWithRepairsPerRun: SEQUENCE_LIMITS.maximumRequests,
  totalRequestCeilingWithRepairs: plannedRuns * SEQUENCE_LIMITS.maximumRequests,
  estimatedUsd: 0,
  scenarios: ids.map((id) => {
    const scenario = createFootballSequence(id);
    return {
      id,
      playingSeconds: scenario.playingTicks / TICK_RATE,
      firstInputBytes: Object.fromEntries(
        (['coral', 'cyan'] as const).map((team) => [
          team,
          requestInputBytes(
            rulebook(),
            JSON.stringify(
              observe(
                scenario.initial,
                team,
                null,
                SEQUENCE_LIMITS.decisionIntervalTicks,
                0,
                scenario.playingTicks,
              ),
            ),
          ),
        ]),
      ),
    };
  }),
};
if (values['dry-run']) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
const folder = `artifacts/private/${name}`;
await mkdir('artifacts/private', { recursive: true });
const lock = await open('artifacts/private/generation.lock', 'wx').catch(() => {
  throw new Error('A generation lock exists. Stop the other run first.');
});
const abort = new AbortController();
process.once('SIGINT', () => abort.abort());
process.once('SIGTERM', () => abort.abort());
type Result = Omit<Awaited<ReturnType<typeof evaluateSequence>>, 'recording'> & {
  repetition: number;
  recordingFile: string;
  finalHash: string;
};
const report = {
  format: 'ai-football-sequence-evaluation',
  version: 1,
  plan,
  status: 'running' as 'running' | 'complete' | 'incomplete',
  stopReason: null as string | null,
  results: [] as Result[],
  activeRecordingFile: null as string | null,
};
async function save(file: string, value: unknown) {
  await writeFile(`${folder}/${file}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${folder}/${file}.tmp`, `${folder}/${file}.json`);
}
let folderCreated = false;
try {
  await mkdir(folder); // A new name preserves all prior successes and failures.
  folderCreated = true;
  await save('report', report);
  evaluation: for (const id of ids) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      if (abort.signal.aborted) {
        report.stopReason = 'cancelled';
        break evaluation;
      }
      const file = `${id}-${repetition}`;
      report.activeRecordingFile = `${file}.json`;
      await save('report', report);
      const { recording, ...result } = await evaluateSequence({
        scenario: createFootballSequence(id),
        controllers: scriptedSequenceControllers(id),
        signal: abort.signal,
        onCheckpoint: (recording) => save(file, recording),
      });
      verifyRecording(recording);
      report.results.push({
        ...result,
        repetition,
        recordingFile: `${file}.json`,
        finalHash: recording.finalHash,
      });
      report.activeRecordingFile = null;
      await save('report', report);
      console.log(
        JSON.stringify({
          id,
          repetition,
          status: result.status,
          criteria: result.criteria,
          rounds: result.execution.rounds,
          requests: result.execution.requests,
          hash: recording.finalHash,
        }),
      );
    }
  }
  report.status =
    report.results.length === plannedRuns &&
    report.results.every((result) => result.status === 'complete')
      ? 'complete'
      : 'incomplete';
  report.stopReason ??= report.status === 'complete' ? null : 'one_or_more_runs_incomplete';
  await save('report', report);
  const allCriteriaPassed =
    report.results.length === plannedRuns &&
    report.results.every((result) => Object.values(result.criteria).every(Boolean));
  console.log(
    JSON.stringify({
      file: `${folder}/report.json`,
      status: report.status,
      allCriteriaPassed,
      runs: report.results.length,
      paidRequests: 0,
      estimatedUsd: 0,
    }),
  );
  if (report.status !== 'complete' || !allCriteriaPassed) process.exitCode = 1;
} catch (error) {
  if (folderCreated) {
    report.status = 'incomplete';
    report.stopReason = `evaluation_error: ${error instanceof Error ? error.message.slice(0, 240) : 'unknown'}`;
    await save('report', report);
  }
  throw error;
} finally {
  await lock.close();
  await rm('artifacts/private/generation.lock');
}
