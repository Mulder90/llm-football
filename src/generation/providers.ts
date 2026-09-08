import { z } from 'zod';
import type { ControllerConfig, TokenUsage } from '../recording/provenance.ts';
import type { responseSchemaFor } from '../protocol/schema.ts';
import { userPrompt } from '../protocol/prompt.ts';

export type ControllerRequest = {
  rules: string;
  observation: string;
  feedback: string | null;
  maximumOutputTokens: number;
  responseSchema: ReturnType<typeof responseSchemaFor>;
};
export type ProviderReply = {
  text: string;
  usage: TokenUsage | null;
  responseId: string | null;
  resolvedModel: string | null;
};
export type TeamController = {
  config: ControllerConfig;
  request: (request: ControllerRequest, signal: AbortSignal) => Promise<ProviderReply>;
};

export class ProviderError extends Error {
  readonly retryable: boolean;
  constructor(code: string, retryable = true) {
    super(code);
    this.retryable = retryable;
  }
}
const tokenCount = z.int().nonnegative();
const openaiEnvelope = z.object({
  id: z.string(),
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }),
  ),
  usage: z
    .object({
      input_tokens: tokenCount,
      output_tokens: tokenCount,
      input_tokens_details: z.object({ cached_tokens: tokenCount }).optional(),
      output_tokens_details: z.object({ reasoning_tokens: tokenCount }).optional(),
    })
    .nullable()
    .optional(),
});
const geminiEnvelope = z.object({
  responseId: z.string().optional(),
  modelVersion: z.string().optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z
          .object({
            parts: z.array(
              z.object({ text: z.string().optional(), thought: z.boolean().optional() }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: tokenCount,
      candidatesTokenCount: tokenCount.optional(),
      thoughtsTokenCount: tokenCount.optional(),
      cachedContentTokenCount: tokenCount.optional(),
      totalTokenCount: tokenCount,
    })
    .optional(),
});

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      redirect: 'error',
    });
  } catch {
    throw new ProviderError(signal.aborted ? 'request_timeout_or_cancelled' : 'network_error');
  }
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = z.object({ error: z.object({ message: z.string() }) }).safeParse(errorBody);
    let message = detail.success ? detail.data.error.message : '';
    for (const credential of [
      headers.Authorization?.replace(/^Bearer /, ''),
      headers['x-goog-api-key'],
    ])
      if (credential) message = message.replaceAll(credential, '[redacted]');
    throw new ProviderError(
      `http_${response.status}: ${message.slice(0, 240)}`,
      response.status === 429 || response.status >= 500,
    );
  }
  // Only the redacted diagnostic message above is retained; never headers or whole error bodies.
  const responseText = await response.text();
  if (responseText.length > 1_000_000) throw new ProviderError('response_too_large', false);
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new ProviderError('invalid_provider_json');
  }
}

export function openaiController(apiKey: string, model = 'gpt-5-nano'): TeamController {
  const nano = model === 'gpt-5-nano' || model === 'gpt-5-nano-2025-08-07';
  const mini = model === 'gpt-5-mini' || model === 'gpt-5-mini-2025-08-07';
  if (!nano && !mini)
    throw new Error('OpenAI model has no reviewed adapter configuration and price');
  return {
    config: {
      provider: 'openai',
      model,
      settings: { reasoning: 'low', verbosity: 'low' },
      inputUsdPerMillion: nano ? 0.05 : 0.25,
      outputUsdPerMillion: nano ? 0.4 : 2,
    },
    async request(request, signal) {
      const raw = await postJson(
        'https://api.openai.com/v1/responses',
        { Authorization: `Bearer ${apiKey}` },
        {
          model,
          store: false,
          reasoning: { effort: 'low' },
          instructions: request.rules,
          input: [{ role: 'user', content: userPrompt(request.observation, request.feedback) }],
          max_output_tokens: request.maximumOutputTokens,
          text: {
            verbosity: 'low',
            format: {
              type: 'json_schema',
              name: 'football_decision',
              strict: true,
              schema: request.responseSchema,
            },
          },
        },
        signal,
      );
      const parsed = openaiEnvelope.safeParse(raw);
      if (!parsed.success) throw new ProviderError('invalid_openai_envelope');
      const response = parsed.data;
      const text =
        response.status === 'completed'
          ? response.output
              .flatMap((item) => item.content ?? [])
              .filter((part) => part.type === 'output_text')
              .map((part) => part.text ?? '')
              .join('')
          : '';
      return {
        text,
        responseId: response.id,
        resolvedModel: response.model,
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens ?? 0,
              cachedInputTokens: response.usage.input_tokens_details?.cached_tokens ?? 0,
            }
          : null,
      };
    },
  };
}

export function geminiController(apiKey: string, model = 'gemini-3.1-flash-lite'): TeamController {
  const lite = model === 'gemini-3.1-flash-lite';
  if (!lite && model !== 'gemini-3.8-flash')
    throw new Error('Gemini model has no reviewed adapter configuration and price');
  const thinkingLevel = lite ? 'MINIMAL' : 'LOW';
  const temperature = lite ? 0.4 : 1;
  return {
    config: {
      provider: 'gemini',
      model,
      settings: { thinkingLevel, temperature },
      // Use standard rates, conservatively ignoring Flash's temporary 2026 discount.
      inputUsdPerMillion: lite ? 0.25 : 1.5,
      outputUsdPerMillion: lite ? 1.5 : 7.5,
    },
    async request(request, signal) {
      const raw = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: request.rules }] },
          contents: [
            { role: 'user', parts: [{ text: userPrompt(request.observation, request.feedback) }] },
          ],
          generationConfig: {
            maxOutputTokens: request.maximumOutputTokens,
            temperature,
            thinkingConfig: { thinkingLevel },
            responseMimeType: 'application/json',
            responseJsonSchema: request.responseSchema,
          },
        },
        signal,
      );
      const parsed = geminiEnvelope.safeParse(raw);
      if (!parsed.success) throw new ProviderError('invalid_gemini_envelope');
      const response = parsed.data;
      const candidate = response.candidates?.[0];
      const usage = response.usageMetadata;
      return {
        text:
          candidate?.finishReason === 'STOP'
            ? (candidate.content?.parts ?? [])
                .filter((part) => !part.thought)
                .map((part) => part.text ?? '')
                .join('')
            : '',
        responseId: response.responseId ?? null,
        resolvedModel: response.modelVersion ?? null,
        usage: usage
          ? {
              inputTokens: usage.promptTokenCount,
              outputTokens: Math.max(
                usage.totalTokenCount - usage.promptTokenCount,
                (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
              ),
              reasoningTokens: usage.thoughtsTokenCount ?? 0,
              cachedInputTokens: usage.cachedContentTokenCount ?? 0,
            }
          : null,
      };
    },
  };
}
