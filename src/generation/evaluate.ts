import {
  createControllerScenarios,
  evaluateControllerScenario,
} from '../fixtures/controller-scenarios.ts';
import type { ControllerScenario } from '../fixtures/controller-scenarios.ts';
import { observe } from '../protocol/observation.ts';
import { rulebook } from '../protocol/rulebook.ts';
import { parseModelDecision, responseSchemaFor } from '../protocol/schema.ts';
import type { ModelDecision } from '../protocol/schema.ts';
import type { ControllerConfig, ProviderUsd, RequestReceipt } from '../recording/provenance.ts';
import { emptyBatch } from '../sim/orders.ts';
import { DEFAULT_LIMITS } from './run.ts';
import { ProviderError } from './providers.ts';
import type { ControllerRequest, TeamController } from './providers.ts';
import { budgetStopReason, estimateRequestUsd, reserveProviderUsd } from './budget.ts';

export type ScenarioResult = {
  scenarioId: string;
  repetition: number;
  controller: ControllerConfig;
  observation: string;
  receipts: RequestReceipt[];
  decision: ModelDecision | null;
  metrics: ReturnType<typeof evaluateControllerScenario>['metrics'] | null;
};
export type ControllerEvaluation = {
  format: 'ai-football-controller-evaluation';
  version: 1;
  rules: string;
  repetitions: number;
  maximumEstimatedUsd: number;
  maximumEstimatedUsdByProvider?: Partial<ProviderUsd>;
  estimatedUsd: number;
  estimatedUsdByProvider: ProviderUsd;
  status: 'running' | 'complete' | 'incomplete';
  stopReason: string | null;
  unavailableModels: string[];
  scenarios: ControllerScenario[];
  results: ScenarioResult[];
};

const MAXIMUM_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 45_000;

/** Each model receives identical bytes; only its own rejected reply can add repair feedback. */
async function evaluateOne(
  scenario: ControllerScenario,
  observation: string,
  controller: TeamController,
  repetition: number,
  rules: string,
  signal: AbortSignal,
) {
  const result: ScenarioResult = {
    scenarioId: scenario.id,
    repetition,
    controller: controller.config,
    observation,
    receipts: [],
    decision: null,
    metrics: null,
  };
  let feedback: string | null = null;
  let unavailable = false;
  for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS && !signal.aborted; attempt++) {
    const started = performance.now();
    const receipt: RequestReceipt = {
      decisionId: scenario.state.decisionId,
      tick: scenario.state.tick,
      team: scenario.team,
      attempt,
      status: 'error',
      failure: null,
      feedback,
      responseText: null,
      latencyMs: 0,
      responseId: null,
      resolvedModel: null,
      usage: null,
      estimatedUsd: estimateRequestUsd(
        controller.config,
        DEFAULT_LIMITS.maximumInputBytes,
        DEFAULT_LIMITS.maximumOutputTokens,
      ),
    };
    try {
      const request: ControllerRequest = {
        rules,
        observation,
        feedback,
        maximumOutputTokens: DEFAULT_LIMITS.maximumOutputTokens,
        responseSchema: responseSchemaFor(emptyBatch(scenario.state, scenario.team)),
      };
      const reply = await controller.request(
        request,
        AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      );
      receipt.responseId = reply.responseId;
      receipt.resolvedModel = reply.resolvedModel;
      receipt.responseText = reply.text.slice(0, 16384);
      receipt.usage = reply.usage;
      if (reply.usage)
        receipt.estimatedUsd = estimateRequestUsd(
          controller.config,
          reply.usage.inputTokens,
          reply.usage.outputTokens,
        );
      receipt.status = 'rejected';
      if (!reply.text) throw new Error('empty_refused_or_truncated_output');
      let payload: unknown;
      try {
        payload = JSON.parse(reply.text) as unknown;
      } catch {
        throw new Error('invalid_decision_json');
      }
      result.decision = parseModelDecision(payload, scenario.state, scenario.team);
      receipt.status = 'accepted';
    } catch (error) {
      feedback = error instanceof Error ? error.message.slice(0, 240) : 'controller_error';
      receipt.failure = feedback;
      unavailable = error instanceof ProviderError && !error.retryable;
    }
    receipt.latencyMs = Math.round(performance.now() - started);
    result.receipts.push(receipt);
    if (result.decision || unavailable) break;
  }
  // A rejected output has no football score. Never quietly replace it with a scripted action.
  if (result.decision)
    result.metrics = evaluateControllerScenario(scenario, result.decision.batch).metrics;
  return { result, unavailable };
}

export async function evaluateControllers(options: {
  controllers: TeamController[];
  repetitions: number;
  maximumEstimatedUsd: number;
  maximumEstimatedUsdByProvider?: Partial<ProviderUsd>;
  signal: AbortSignal;
  scenarios?: ControllerScenario[];
  onCheckpoint?: (report: ControllerEvaluation) => Promise<void>;
}): Promise<ControllerEvaluation> {
  const report: ControllerEvaluation = {
    format: 'ai-football-controller-evaluation',
    version: 1,
    rules: rulebook(),
    repetitions: options.repetitions,
    maximumEstimatedUsd: options.maximumEstimatedUsd,
    ...(options.maximumEstimatedUsdByProvider && {
      maximumEstimatedUsdByProvider: { ...options.maximumEstimatedUsdByProvider },
    }),
    estimatedUsd: 0,
    estimatedUsdByProvider: { openai: 0, gemini: 0 },
    status: 'running',
    stopReason: null,
    unavailableModels: [],
    scenarios: options.scenarios ?? createControllerScenarios(),
    results: [],
  };
  evaluation: for (const scenario of report.scenarios) {
    const observation = JSON.stringify(
      observe(
        scenario.state,
        scenario.team,
        scenario.memory,
        scenario.evaluationTicks,
        scenario.previousDecisionTick,
      ),
    );
    const inputBytes =
      Buffer.byteLength(
        report.rules +
          observation +
          JSON.stringify(responseSchemaFor(emptyBatch(scenario.state, scenario.team))),
      ) + 1024;
    if (inputBytes > DEFAULT_LIMITS.maximumInputBytes) {
      report.stopReason = 'input_limit';
      break;
    }
    for (let repetition = 1; repetition <= options.repetitions; repetition++) {
      if (options.signal.aborted) {
        report.stopReason = 'cancelled_or_wall_time_limit';
        break evaluation;
      }
      const controllers = options.controllers.filter(
        (controller) => !report.unavailableModels.includes(controller.config.model),
      );
      const reservation = reserveProviderUsd(
        controllers.map((controller) => controller.config),
        DEFAULT_LIMITS.maximumInputBytes,
        DEFAULT_LIMITS.maximumOutputTokens,
        MAXIMUM_ATTEMPTS,
      );
      const budgetFailure = budgetStopReason(
        report.estimatedUsdByProvider,
        reservation,
        report.maximumEstimatedUsd,
        report.maximumEstimatedUsdByProvider,
      );
      if (budgetFailure) {
        report.stopReason = budgetFailure;
        break evaluation;
      }
      const results = await Promise.all(
        controllers.map((controller) =>
          evaluateOne(scenario, observation, controller, repetition, report.rules, options.signal),
        ),
      );
      for (const { result, unavailable } of results) {
        report.results.push(result);
        const estimatedUsd = result.receipts.reduce(
          (total, receipt) => total + receipt.estimatedUsd,
          0,
        );
        report.estimatedUsd += estimatedUsd;
        report.estimatedUsdByProvider[result.controller.provider] += estimatedUsd;
        if (unavailable) report.unavailableModels.push(result.controller.model);
      }
      await options.onCheckpoint?.(report);
    }
  }
  report.stopReason ??= options.signal.aborted
    ? 'cancelled_or_wall_time_limit'
    : report.unavailableModels.length
      ? 'provider_unavailable'
      : null;
  report.status = report.stopReason ? 'incomplete' : 'complete';
  await options.onCheckpoint?.(report);
  return report;
}
