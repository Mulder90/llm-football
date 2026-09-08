import { RESPONSE_JSON_SCHEMA } from '../protocol/schema.ts';
import type {
  ControllerConfig,
  GenerationProvenance,
  ProviderUsd,
} from '../recording/provenance.ts';

const SCHEMA_BYTES = Buffer.byteLength(JSON.stringify(RESPONSE_JSON_SCHEMA));
const REQUEST_OVERHEAD_BYTES = 1024;

/** Shared by dispatch and dry runs; reserve room for framing and repair feedback. */
export function requestInputBytes(rules: string, observation: string): number {
  return Buffer.byteLength(rules + observation) + SCHEMA_BYTES + REQUEST_OVERHEAD_BYTES;
}

export function estimateRequestUsd(
  controller: ControllerConfig,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * controller.inputUsdPerMillion + outputTokens * controller.outputUsdPerMillion) /
    1_000_000
  );
}

/** Include every concurrently dispatched model and its whole repair allowance. */
export function reserveProviderUsd(
  controllers: ControllerConfig[],
  maximumInputBytes: number,
  maximumOutputTokens: number,
  maximumAttempts: number,
): ProviderUsd {
  const reserved = { openai: 0, gemini: 0 };
  for (const controller of controllers)
    if (controller.provider !== 'scripted')
      reserved[controller.provider] +=
        maximumAttempts * estimateRequestUsd(controller, maximumInputBytes, maximumOutputTokens);
  return reserved;
}

export function budgetStopReason(
  spent: ProviderUsd,
  reserved: ProviderUsd,
  maximumEstimatedUsd: number,
  maximumEstimatedUsdByProvider: Partial<ProviderUsd> = {},
): string | null {
  if (spent.openai + spent.gemini + reserved.openai + reserved.gemini > maximumEstimatedUsd)
    return 'estimated_cost_limit';
  for (const provider of ['openai', 'gemini'] as const) {
    const limit = maximumEstimatedUsdByProvider[provider];
    if (limit !== undefined && spent[provider] + reserved[provider] > limit)
      return `${provider}_estimated_cost_limit`;
  }
  return null;
}

/** Derive costs from receipts so failed and cancelled requests remain in the totals. */
export function generationProviderUsd(provenance: GenerationProvenance): ProviderUsd {
  const spent = { openai: 0, gemini: 0 };
  for (const receipt of provenance.requests) {
    const provider = provenance.controllers[receipt.team].provider;
    if (provider !== 'scripted') spent[provider] += receipt.estimatedUsd;
  }
  return spent;
}
