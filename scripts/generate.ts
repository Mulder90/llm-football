import { existsSync } from 'node:fs';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { DEFAULT_LIMITS, generateMatch } from '../src/generation/run.ts';
import { geminiController, openaiController } from '../src/generation/providers.ts';
import { generationProviderUsd } from '../src/generation/budget.ts';
import { verifyRecording } from '../src/recording/record.ts';
import type { Recording } from '../src/recording/record.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const { values } = parseArgs({
  options: {
    smoke: { type: 'boolean', default: false },
    decisions: { type: 'string' },
    usd: { type: 'string' },
    'openai-usd': { type: 'string' },
    'gemini-usd': { type: 'string' },
    name: { type: 'string' },
    'wall-seconds': { type: 'string' },
  },
});
const env = z
  .object({
    OPENAI_API_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    OPENAI_MODEL: z.string().default('gpt-5-nano'),
    GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  })
  .safeParse(process.env);
if (!env.success)
  throw new Error('Set OPENAI_API_KEY and GEMINI_API_KEY in local .env; never use VITE_ prefixes');
const maximumDecisions = z.coerce
  .number()
  .int()
  .min(1)
  .max(2000)
  .parse(
    values.smoke
      ? 1
      : (values.decisions ??
          process.env.GENERATION_MAX_DECISIONS ??
          DEFAULT_LIMITS.maximumDecisions),
  );
const maximumRetries = values.smoke
  ? 0
  : z.coerce
      .number()
      .int()
      .min(0)
      .max(1)
      .parse(process.env.GENERATION_MAX_RETRIES_PER_TEAM_DECISION ?? DEFAULT_LIMITS.maximumRetries);
const providerLimit = z.coerce.number().nonnegative().max(20).optional();
const openaiUsd = providerLimit.parse(
  values['openai-usd'] ?? process.env.GENERATION_MAX_OPENAI_USD,
);
const geminiUsd = providerLimit.parse(
  values['gemini-usd'] ?? process.env.GENERATION_MAX_GEMINI_USD,
);
const maximumEstimatedUsdByProvider = {
  ...(openaiUsd !== undefined && { openai: openaiUsd }),
  ...(geminiUsd !== undefined && { gemini: geminiUsd }),
};
const limits = {
  ...DEFAULT_LIMITS,
  maximumDecisions,
  maximumRetries,
  maximumRequests: maximumDecisions * 2 * (maximumRetries + 1),
  maximumEstimatedUsdByProvider,
  maximumEstimatedUsd: z.coerce
    .number()
    .positive()
    .max(20)
    .parse(
      values.usd ?? process.env.GENERATION_MAX_ESTIMATED_USD ?? DEFAULT_LIMITS.maximumEstimatedUsd,
    ),
  maximumWallSeconds: z.coerce
    .number()
    .int()
    .min(30)
    .max(14400)
    .parse(values['wall-seconds'] ?? DEFAULT_LIMITS.maximumWallSeconds),
};
const matchId = z
  .string()
  .regex(/^[a-zA-Z0-9-]{1,80}$/)
  .parse(values.name ?? `llm-${new Date().toISOString().replaceAll(/[^0-9]/g, '')}`);
const controllers = {
  coral: openaiController(env.data.OPENAI_API_KEY, env.data.OPENAI_MODEL),
  cyan: geminiController(env.data.GEMINI_API_KEY, env.data.GEMINI_MODEL),
};
const folder = `artifacts/private/${matchId}`;
await mkdir('artifacts/private', { recursive: true });
const lock = await open('artifacts/private/generation.lock', 'wx').catch(() => {
  throw new Error('A generation lock exists. Stop the other run before starting another.');
});
const abort = new AbortController();
process.once('SIGINT', () => abort.abort());
process.once('SIGTERM', () => abort.abort());
async function save(recording: Recording) {
  await writeFile(`${folder}/match.tmp`, JSON.stringify(recording));
  await rename(`${folder}/match.tmp`, `${folder}/match.json`);
}
try {
  await mkdir(folder); // Never overwrite a prior match with the same ID.
  console.log(
    JSON.stringify({
      matchId,
      controllers: { coral: controllers.coral.config, cyan: controllers.cyan.config },
      limits,
    }),
  );
  const recording = await generateMatch({
    matchId,
    controllers,
    limits,
    signal: abort.signal,
    onCheckpoint: save,
    onProgress: (progress) => console.log(JSON.stringify(progress)),
  });
  const final = verifyRecording(recording);
  console.log(
    JSON.stringify({
      file: `${folder}/match.json`,
      status: recording.generation!.status,
      stopReason: recording.generation!.stopReason,
      playingSeconds: final.playingTicks / 60,
      phase: final.phase,
      score: final.score,
      hash: recording.finalHash,
      requests: recording.generation!.requests.length,
      estimatedUsd: recording.generation!.estimatedUsd,
      estimatedUsdByProvider: generationProviderUsd(recording.generation!),
    }),
  );
} finally {
  await lock.close();
  await rm('artifacts/private/generation.lock');
}
