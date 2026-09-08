import type { Team } from '../sim/types.ts';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
};
export type ControllerConfig = {
  provider: 'openai' | 'gemini';
  model: string;
  settings: Record<string, string | number>;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};
export type ProviderUsd = Record<ControllerConfig['provider'], number>;
export type RequestReceipt = {
  decisionId: number;
  tick: number;
  team: Team;
  attempt: number;
  status: 'accepted' | 'rejected' | 'error';
  failure: string | null;
  feedback: string | null;
  responseText: string | null;
  latencyMs: number;
  responseId: string | null;
  resolvedModel: string | null;
  usage: TokenUsage | null;
  estimatedUsd: number;
};
export type GenerationProvenance = {
  protocolVersion: 1;
  rulebook: string;
  responseSchema?: string;
  controllers: Record<Team, ControllerConfig>;
  limits: {
    maximumDecisions: number;
    maximumRequests: number;
    maximumRetries: number;
    maximumOutputTokens: number;
    maximumInputBytes: number;
    maximumEstimatedUsd: number;
    maximumEstimatedUsdByProvider?: Partial<ProviderUsd>;
    maximumWallSeconds: number;
    decisionIntervalTicks: number;
  };
  status: 'running' | 'complete' | 'incomplete';
  stopReason: string | null;
  wallSeconds: number;
  requests: RequestReceipt[];
  estimatedUsd: number;
};
