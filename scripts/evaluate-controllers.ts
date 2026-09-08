import { existsSync } from 'node:fs';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { evaluateControllers } from '../src/generation/evaluate.ts';
import { geminiController, openaiController } from '../src/generation/providers.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    usd: { type: 'string', default: '1' },
    'openai-usd': { type: 'string' },
    'gemini-usd': { type: 'string' },
    repetitions: { type: 'string', default: '2' },
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
if (!process.env.OPENAI_API_KEY || !process.env.GEMINI_API_KEY)
  throw new Error('Set both provider keys in local .env; never use VITE_ prefixes');
const controllers = [
  openaiController(process.env.OPENAI_API_KEY),
  openaiController(process.env.OPENAI_API_KEY, 'gpt-5-mini'),
  geminiController(process.env.GEMINI_API_KEY),
  geminiController(process.env.GEMINI_API_KEY, 'gemini-3.8-flash'),
];
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
