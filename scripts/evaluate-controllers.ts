import { existsSync, openAsBlob } from 'node:fs';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { evaluateControllers } from '../src/generation/evaluate.ts';
import { geminiController, openaiController } from '../src/generation/providers.ts';
import {
  createControllerScenarios,
  recordedPossessionScenario,
} from '../src/fixtures/controller-scenarios.ts';
import { readRecordingStream } from '../src/recording/validate.ts';
import { verifyRecording } from '../src/recording/record.ts';
import { teamSchema } from '../src/protocol/schema.ts';
import { requestInputBytes } from '../src/generation/budget.ts';
import { observe } from '../src/protocol/observation.ts';
import { rulebook } from '../src/protocol/rulebook.ts';
import { TICK_RATE } from '../src/sim/rules.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    usd: { type: 'string', default: '1' },
    'openai-usd': { type: 'string' },
    'gemini-usd': { type: 'string' },
    repetitions: { type: 'string', default: '2' },
    models: { type: 'string' },
    scenarios: { type: 'string' },
    recording: { type: 'string' },
    possessions: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const name = z
  .string()
  .regex(/^[a-zA-Z0-9-]{1,80}$/)
  .parse(values.name ?? `evaluation-${new Date().toISOString().replaceAll(/[^0-9]/g, '')}`);
const repetitions = z.coerce.number().int().min(1).max(3).parse(values.repetitions);
const maximumEstimatedUsd = z.coerce.number().positive().max(3).parse(values.usd);
const providerLimit = z.coerce.number().nonnegative().max(3).optional();
const openaiUsd = providerLimit.parse(values['openai-usd']);
const geminiUsd = providerLimit.parse(values['gemini-usd']);
const maximumEstimatedUsdByProvider = {
  ...(openaiUsd !== undefined && { openai: openaiUsd }),
  ...(geminiUsd !== undefined && { gemini: geminiUsd }),
};
const supportedModels = [
  'gpt-5-nano',
  'gpt-5-mini',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
] as const;
const models = z
  .array(z.enum(supportedModels))
  .min(1)
  .refine((models) => new Set(models).size === models.length, 'Choose each model once')
  .parse(values.models?.split(',') ?? supportedModels);
const controllers = models.map((model) => {
  const openai = model.startsWith('gpt-');
  const key = values['dry-run']
    ? 'unused'
    : process.env[openai ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'];
  if (!key) throw new Error(`Set ${openai ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'} locally`);
  return openai ? openaiController(key, model) : geminiController(key, model);
});
let scenarios = createControllerScenarios();
if (values.scenarios) {
  const selected = values.scenarios.split(',');
  scenarios = selected.map((id) => {
    const scenario = scenarios.find((scenario) => scenario.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    return scenario;
  });
  if (new Set(selected).size !== selected.length) throw new Error('Choose each scenario once');
}
if (Boolean(values.recording) !== Boolean(values.possessions))
  throw new Error('Use --recording PATH with --possessions TEAM:DECISION_INDEX,...');
if (values.recording && values.possessions) {
  const stream = (await openAsBlob(values.recording)).stream();
  const recording = await readRecordingStream(
    values.recording.endsWith('.gz') ? stream.pipeThrough(new DecompressionStream('gzip')) : stream,
  );
  verifyRecording(recording);
  for (const selection of values.possessions.split(',')) {
    const [team, index] = z
      .tuple([teamSchema, z.coerce.number().int().nonnegative()])
      .parse(selection.split(':'));
    scenarios.push(recordedPossessionScenario(recording, index, team));
  }
  if (new Set(scenarios.map((scenario) => scenario.id)).size !== scenarios.length)
    throw new Error('Choose each possession once');
}
if (values['dry-run']) {
  console.log(
    JSON.stringify(
      {
        controllers: controllers.map((controller) => controller.config),
        repetitions,
        cases: scenarios.map((scenario) => ({
          id: scenario.id,
          team: scenario.team,
          inputBytes: requestInputBytes(
            rulebook(),
            JSON.stringify(
              observe(
                scenario.state,
                scenario.team,
                scenario.memory,
                scenario.evaluationTicks,
                scenario.previousDecisionTick,
              ),
            ),
          ),
          playingSeconds: scenario.state.playingTicks / TICK_RATE,
        })),
        baseRequests: scenarios.length * controllers.length * repetitions,
        maximumEstimatedUsd,
        maximumEstimatedUsdByProvider,
      },
      null,
      2,
    ),
  );
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
try {
  await mkdir(folder);
  console.log(
    JSON.stringify({
      name,
      controllers: controllers.map((controller) => controller.config),
      repetitions,
      maximumEstimatedUsd,
      maximumEstimatedUsdByProvider,
    }),
  );
  const report = await evaluateControllers({
    controllers,
    scenarios,
    repetitions,
    maximumEstimatedUsd,
    maximumEstimatedUsdByProvider,
    signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15 * 60 * 1000)]),
    async onCheckpoint(report) {
      await writeFile(`${folder}/report.tmp`, JSON.stringify(report));
      await rename(`${folder}/report.tmp`, `${folder}/report.json`);
      console.log(
        JSON.stringify({
          status: report.status,
          cases: report.results.length,
          requests: report.results.reduce((n, result) => n + result.receipts.length, 0),
          estimatedUsd: report.estimatedUsd,
          estimatedUsdByProvider: report.estimatedUsdByProvider,
          lastScenario: report.results.at(-1)?.scenarioId,
        }),
      );
    },
  });
  console.log(
    JSON.stringify({
      file: `${folder}/report.json`,
      status: report.status,
      stopReason: report.stopReason,
      estimatedUsd: report.estimatedUsd,
      estimatedUsdByProvider: report.estimatedUsdByProvider,
      unavailableModels: report.unavailableModels,
    }),
  );
} finally {
  await lock.close();
  await rm('artifacts/private/generation.lock');
}
