import type { Team } from '../sim/types.ts';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
};
export type ControllerConfig = {
  model: string;
  settings: Record<string, string | number>;
} & (
  | { provider: 'openai' | 'gemini'; inputUsdPerMillion: number; outputUsdPerMillion: number }
  | { provider: 'scripted'; inputUsdPerMillion: 0; outputUsdPerMillion: 0 }
);
export type ProviderUsd = Record<'openai' | 'gemini', number>;
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
    maximumPlayingTicks?: number;
  };
  status: 'running' | 'complete' | 'incomplete';
  stopReason: string | null;
  wallSeconds: number;
  requests: RequestReceipt[];
  estimatedUsd: number;
};
