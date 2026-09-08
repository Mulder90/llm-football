import { afterEach, describe, expect, it, vi } from 'vitest';
import { createControllerScenarios } from '../src/fixtures/controller-scenarios.ts';
import { evaluateControllers } from '../src/generation/evaluate.ts';
import { budgetStopReason, reserveProviderUsd } from '../src/generation/budget.ts';
import { geminiController, openaiController, ProviderError } from '../src/generation/providers.ts';
import type { ControllerRequest, TeamController } from '../src/generation/providers.ts';
import type { Observation } from '../src/protocol/observation.ts';
import { stateHash } from '../src/recording/record.ts';
import { TICK_RATE } from '../src/sim/rules.ts';

function controller(request: TeamController['request']): TeamController {
  return { config: openaiController('unused').config, request };
}
function validReply(request: ControllerRequest) {
  const observation = JSON.parse(request.observation) as Observation;
  return {
    text: JSON.stringify({
      batch: { ...observation.responseIdentity, orders: [] },
      intent: 'Hold',
      memory: {
        plan: 'Hold',
        ballPlayerId: null,
        pass: null,
        assignments: [],
        threats: [],
        review: '',
      },
    }),
    usage: { inputTokens: 100, outputTokens: 100, reasoningTokens: 0, cachedInputTokens: 0 },
    responseId: 'offline',
    resolvedModel: 'offline',
  };
}
const signal = () => new AbortController().signal;

describe('controller comparisons', () => {
  it('reserves every concurrent request and repair before dispatch', async () => {
    const request = vi.fn(async (request: ControllerRequest) => validReply(request));
    const report = await evaluateControllers({
      controllers: [controller(request), controller(request)],
      repetitions: 1,
      maximumEstimatedUsd: 0.000001,
      signal: signal(),
    });
    expect(request).not.toHaveBeenCalled();
    expect(report.stopReason).toBe('estimated_cost_limit');
    expect(report.estimatedUsd).toBe(0);
  });

  it.each(['openai', 'gemini'] as const)(
    'sums all concurrent %s model reservations under one provider cap',
    async (provider) => {
      const request = vi.fn(async (request: ControllerRequest) => validReply(request));
      const first = controller(request);
      first.config = { ...first.config, provider };
      const second = { ...first, config: { ...first.config, model: 'another-model' } };
      const other = controller(request);
      other.config = {
        ...other.config,
        provider: provider === 'openai' ? 'gemini' : 'openai',
      };
      const report = await evaluateControllers({
        controllers: [first, second, other],
        repetitions: 1,
        maximumEstimatedUsd: 1,
        // Each model needs $0.0065536 including repair: one fits, both do not.
        maximumEstimatedUsdByProvider: { [provider]: 0.008 },
        signal: signal(),
      });
      expect(request).not.toHaveBeenCalled();
      expect(report.stopReason).toBe(`${provider}_estimated_cost_limit`);
      expect(report.estimatedUsdByProvider).toEqual({ openai: 0, gemini: 0 });
      expect(report.results).toHaveLength(0);
    },
  );

  it('stops the next comparison after one provider exhausts its cap, retaining repair costs', async () => {
    const request = vi.fn(async (request: ControllerRequest) => {
      const reply = validReply(request);
      return { ...reply, usage: null };
    });
    const openai = controller(request);
    const gemini = controller(async (request) => {
      const reply = validReply(request);
      return { ...reply, text: request.feedback ? reply.text : '{}', usage: null };
    });
    gemini.config = { ...gemini.config, provider: 'gemini' };
    const checkpoints: string[] = [];
    const report = await evaluateControllers({
      controllers: [openai, gemini],
      scenarios: createControllerScenarios().slice(0, 1),
      repetitions: 2,
      maximumEstimatedUsd: 1,
      maximumEstimatedUsdByProvider: { openai: 0.1, gemini: 0.0066 },
      signal: signal(),
      async onCheckpoint(report) {
        checkpoints.push(report.status);
      },
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(report.status).toBe('incomplete');
    expect(report.stopReason).toBe('gemini_estimated_cost_limit');
    expect(report.results).toHaveLength(2);
    expect(report.results.map((result) => result.receipts.length)).toEqual([1, 2]);
    expect(report.estimatedUsdByProvider.openai).toBeCloseTo(0.0032768, 10);
    expect(report.estimatedUsdByProvider.gemini).toBeCloseTo(0.0065536, 10);
    expect(report.estimatedUsd).toBeCloseTo(0.0098304);
    expect(checkpoints.at(-1)).toBe('incomplete');
  });

  it('compares identical observations, repairs privately and never mutates the scenario', async () => {
    const scenarios = createControllerScenarios().slice(0, 1);
    const initialHash = stateHash(scenarios[0]!.state);
    const firstCalls: ControllerRequest[] = [];
    const secondCalls: ControllerRequest[] = [];
    const first = controller(async (request) => {
      firstCalls.push(request);
      return validReply(request);
    });
    const second = controller(async (request) => {
      secondCalls.push(request);
      const reply = validReply(request);
      return secondCalls.length === 1 ? { ...reply, text: '{"invalid":true}' } : reply;
    });
    const report = await evaluateControllers({
      controllers: [first, second],
      scenarios,
      repetitions: 1,
      maximumEstimatedUsd: 1,
      signal: signal(),
    });
    expect(report.status).toBe('complete');
    expect(firstCalls).toHaveLength(1);
    expect(secondCalls).toHaveLength(2);
    expect(
      new Set([...firstCalls, ...secondCalls].map((request) => request.observation)).size,
    ).toBe(1);
    const observation = JSON.parse(firstCalls[0]!.observation) as Observation;
    expect(observation.secondsUntilNextScheduledDecision).toBe(
      scenarios[0]!.evaluationTicks / TICK_RATE,
    );
    expect(secondCalls[1]!.feedback).toContain('Invalid response');
    expect(firstCalls[0]!.feedback).toBeNull();
    expect(report.results.map((result) => result.metrics === null)).toEqual([false, false]);
    expect(stateHash(scenarios[0]!.state)).toBe(initialHash);
  });

  it('records unavailable models once with conservative missing-usage cost and no invented outcome', async () => {
    const request = vi.fn(async () => {
      throw new ProviderError('http_404: model unavailable', false);
    });
    const report = await evaluateControllers({
      controllers: [controller(request)],
      repetitions: 2,
      maximumEstimatedUsd: 1,
      signal: signal(),
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(report.stopReason).toBe('provider_unavailable');
    expect(report.results[0]!.metrics).toBeNull();
    expect(report.estimatedUsd).toBeGreaterThan(0);
  });
});

afterEach(() => vi.unstubAllGlobals());
it('sends the reviewed model-specific settings and caps to each real adapter', async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(init.body as string) as Record<string, unknown> });
    return new Response(
      JSON.stringify(
        url.includes('openai')
          ? { id: 'test', model: 'gpt-5-mini', status: 'completed', output: [] }
          : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] },
      ),
    );
  });
  const { RESPONSE_JSON_SCHEMA } = await import('../src/protocol/schema.ts');
  const request: ControllerRequest = {
    rules: 'rules',
    observation: '{}',
    feedback: null,
    maximumOutputTokens: 4096,
    responseSchema: RESPONSE_JSON_SCHEMA,
  };
  await openaiController('unused', 'gpt-5-mini').request(request, signal());
  await geminiController('unused', 'gemini-3.8-flash').request(request, signal());
  expect(requests[0]!.body).toMatchObject({
    model: 'gpt-5-mini',
    store: false,
    reasoning: { effort: 'low' },
    max_output_tokens: 4096,
    text: { format: { strict: true } },
  });
  expect(requests[1]!.url).toContain('/gemini-3.8-flash:generateContent');
  expect(requests[1]!.body).toMatchObject({
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'LOW' },
      temperature: 1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });
});

it('reserves Flash introductory prices against the provider ceiling without changing Lite', () => {
  const flash = geminiController('unused', 'gemini-3.8-flash').config;
  expect(flash.settings).toEqual({ thinkingLevel: 'LOW', temperature: 1 });
  // 10k input + 2k output, including one repair: ($0.0075 + $0.0075) × 2.
  const reservation = reserveProviderUsd([flash], 10_000, 2_000, 2);
  expect(reservation).toEqual({ openai: 0, gemini: 0.03 });
  const spent = { openai: 0, gemini: 0 };
  expect(budgetStopReason(spent, reservation, 1, { gemini: 0.03 })).toBeNull();
  expect(budgetStopReason(spent, reservation, 1, { gemini: 0.029999 })).toBe(
    'gemini_estimated_cost_limit',
  );
  expect(geminiController('unused').config).toMatchObject({
    model: 'gemini-3.1-flash-lite',
    settings: { thinkingLevel: 'MINIMAL', temperature: 0.4 },
    inputUsdPerMillion: 0.25,
    outputUsdPerMillion: 1.5,
  });
});
