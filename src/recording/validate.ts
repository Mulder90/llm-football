import { z } from 'zod';
import {
  modelOrderSchema,
  pitchTargetSchema,
  playerIdSchema,
  teamSchema,
  tacticalMemorySchema,
  validateTacticalMemory,
} from '../protocol/schema.ts';
import { BALL_CONTROL, ENGINE_VERSION, MATCH_TIMING, KEEPER } from '../sim/rules.ts';
import { inPenaltyArea } from '../sim/state.ts';
import type { Recording } from './record.ts';

export const MAXIMUM_RECORDING_BYTES = 80 * 1024 * 1024;
const tick = z.int().min(0).max(72_000);
const actionTick = z.int().min(-1000).max(72_000);
const text = z.string().max(1000);
const point = z.strictObject({ x: z.number(), y: z.number() });
const point3 = point.extend({ z: z.number() });
const score = z.strictObject({ coral: z.int().nonnegative(), cyan: z.int().nonnegative() });
const restartType = z.enum([
  'kickoff',
  'throw_in',
  'corner',
  'goal_kick',
  'free_kick',
  'indirect_free_kick',
  'penalty',
]);
const restart = z.strictObject({
  type: restartType,
  team: teamSchema,
  position: pitchTargetSchema,
  takerId: playerIdSchema,
});
const phase = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('open_play'), sinceTick: tick }),
  z.strictObject({ type: z.literal('restart_setup'), sinceTick: tick, readyTick: tick, restart }),
  z.strictObject({
    type: z.literal('restart_ready'),
    sinceTick: tick,
    deadlineTick: tick,
    restart,
  }),
  z.strictObject({ type: z.literal('halftime'), sinceTick: tick, endsAtTick: tick }),
  z.strictObject({
    type: z.literal('full_time'),
    sinceTick: tick,
    reason: z.enum(['completed', 'abandoned']),
  }),
]);
// Canonical engine orders may omit loft; strict model output always supplies it.
const order = z
  .union([
    modelOrderSchema,
    z.strictObject({
      type: z.enum(['kick', 'shoot']),
      playerId: playerIdSchema,
      target: pitchTargetSchema,
      speed: z.number().min(BALL_CONTROL.minimumKickSpeed).max(BALL_CONTROL.maximumKickSpeed),
      loft: z.number().min(0).max(BALL_CONTROL.maximumLoftSpeed).optional(),
    }),
    z.strictObject({
      type: z.literal('move'),
      playerId: playerIdSchema,
      target: pitchTargetSchema,
      pace: z.number().gt(0).max(1),
    }),
  ])
  .refine(
    (order) =>
      order.type !== 'distribute' ||
      (order.speed <= KEEPER.deliveries[order.delivery].maximumSpeed &&
        order.loft <= KEEPER.deliveries[order.delivery].maximumLoft),
    { message: 'Distribution exceeds its delivery bounds' },
  );
const batch = z.strictObject({
  version: z.literal(1),
  matchId: z.string().min(1).max(100),
  decisionId: tick,
  team: teamSchema,
  tick,
  orders: z.array(order).max(11),
});
const event = z.strictObject({
  id: z.int().nonnegative(),
  tick,
  type: z.enum([
    'kick',
    'shot',
    'receive',
    'interception',
    'order_failed',
    'ball_out',
    'goal',
    'save',
    'keeper_pickup',
    'keeper_release',
    'keeper_violation',
    'block',
    'post',
    'tackle',
    'foul',
    'yellow_card',
    'red_card',
    'offside',
    'restart_awarded',
    'restart_ready',
    'restart_taken',
    'restart_violation',
    'halftime',
    'full_time',
    'abandoned',
  ]),
  playerId: playerIdSchema.nullable(),
  detail: text,
  team: teamSchema.optional(),
  delivery: z.enum(['roll', 'throw', 'punt', 'put_down']).optional(),
});
const player = z.strictObject({
  id: playerIdSchema,
  team: teamSchema,
  number: z.int().min(1).max(11),
  role: z.enum(['keeper', 'outfield']),
  yellowCards: z.int().min(0).max(2),
  dismissed: z.boolean(),
  position: point,
  velocity: point,
  facing: point,
  active: z.strictObject({ order, expires: tick, issued: tick }).nullable(),
  lastKick: actionTick,
  lastTackleTick: actionTick,
  lastSaveTick: actionTick,
  distance: z.number().nonnegative(),
});
const handControl = z
  .strictObject({
    sinceTick: tick,
    sincePlayingTick: tick,
    kind: z.enum(['catch', 'pickup']),
    height: z.number().min(0).max(KEEPER.guardingHeight),
  })
  .nullable();
const state = z.strictObject({
  version: z.literal(ENGINE_VERSION),
  matchId: z.string().min(1).max(100),
  tick,
  playingTicks: tick,
  half: z.union([z.literal(1), z.literal(2)]),
  phase,
  halfPlayingTicks: tick,
  firstKickoffTeam: teamSchema,
  score,
  seed: z.int().min(1).max(0xffffffff),
  decisionId: tick,
  players: z.array(player).length(22),
  ball: z.strictObject({
    position: point3,
    velocity: point3,
    owner: playerIdSchema.nullable(),
    handControl,
    handling: z.strictObject({
      deliberateKick: z.strictObject({ playerId: playerIdSchema, team: teamSchema }).nullable(),
      directThrowInTeam: teamSchema.nullable(),
      releasedBy: playerIdSchema.nullable(),
      directThrowBy: playerIdSchema.nullable(),
    }),
    lastTouch: playerIdSchema.nullable(),
    kickedAt: actionTick,
    restartTouch: z
      .strictObject({ type: restartType, team: teamSchema, takerId: playerIdSchema })
      .nullable(),
  }),
  offside: z
    .strictObject({ team: teamSchema, touchTick: tick, playerIds: z.array(playerIdSchema).max(10) })
    .nullable(),
  events: z.array(event).max(30000),
});
const frame = z.strictObject({
  tick,
  playingTicks: tick,
  half: z.union([z.literal(1), z.literal(2)]),
  phase,
  score,
  players: z
    .array(
      z.strictObject({
        position: point,
        velocity: point,
        facing: point,
        lastKickTick: actionTick,
        lastTackleTick: actionTick,
        lastSaveTick: actionTick,
        guarding: z.boolean(),
        yellowCards: z.int().min(0).max(2),
        dismissed: z.boolean(),
        distanceTravelled: z.number().nonnegative(),
      }),
    )
    .length(22),
  ball: point3,
  owner: playerIdSchema.nullable(),
  handControl,
});
const tokens = z.int().nonnegative();
const controller = z.strictObject({
  provider: z.enum(['openai', 'gemini']),
  model: text,
  settings: z.record(z.string().max(100), z.union([z.string().max(100), z.number()])),
  inputUsdPerMillion: z.number().nonnegative(),
  outputUsdPerMillion: z.number().nonnegative(),
});
const provenance = z.strictObject({
  protocolVersion: z.literal(1),
  rulebook: z.string().max(16000),
  responseSchema: z.string().max(16000).optional(),
  controllers: z.strictObject({ coral: controller, cyan: controller }),
  limits: z.strictObject({
    maximumDecisions: tokens,
    maximumRequests: tokens,
    maximumRetries: tokens,
    maximumOutputTokens: tokens,
    maximumInputBytes: tokens,
    maximumEstimatedUsd: z.number().nonnegative(),
    maximumEstimatedUsdByProvider: z
      .strictObject({
        openai: z.number().nonnegative().optional(),
        gemini: z.number().nonnegative().optional(),
      })
      .optional(),
    maximumWallSeconds: tokens,
    decisionIntervalTicks: tokens,
  }),
  status: z.enum(['running', 'complete', 'incomplete']),
  stopReason: text.nullable(),
  wallSeconds: z.number().nonnegative(),
  estimatedUsd: z.number().nonnegative(),
  requests: z
    .array(
      z.strictObject({
        decisionId: tick,
        tick,
        team: teamSchema,
        attempt: tokens,
        status: z.enum(['accepted', 'rejected', 'error']),
        failure: text.nullable(),
        feedback: text.nullable(),
        responseText: z.string().max(16384).nullable(),
        latencyMs: tokens,
        responseId: text.nullable(),
        resolvedModel: text.nullable(),
        usage: z
          .strictObject({
            inputTokens: tokens,
            outputTokens: tokens,
            reasoningTokens: tokens,
            cachedInputTokens: tokens,
          })
          .nullable(),
        estimatedUsd: z.number().nonnegative(),
      }),
    )
    .max(8000),
});
const recordingSchema = z.strictObject({
  format: z.literal('ai-football-recording'),
  version: z.literal(2),
  engine: z.literal(ENGINE_VERSION),
  kind: z.enum(['fixture', 'llm']),
  title: text,
  description: text,
  teams: z.record(
    teamSchema,
    z.strictObject({ name: z.string().max(80), controller: z.string().max(100) }),
  ),
  initial: state,
  decisions: z
    .array(
      z.strictObject({
        tick,
        batches: z.tuple([batch, batch]),
        fallback: z.array(teamSchema).max(2),
        notes: z
          .record(
            teamSchema,
            z.strictObject({
              intent: z.string().max(160),
              memory: tacticalMemorySchema.nullable(),
            }),
          )
          .optional(),
        observations: z.record(teamSchema, z.string().max(32768)).optional(),
      }),
    )
    .max(4000),
  frames: z.array(frame).min(1).max(60000),
  events: z.array(event).max(30000),
  finalHash: z.string().regex(/^[0-9a-f]{8}$/),
  durationTicks: tick,
  generation: provenance.optional(),
});

export function parseRecording(raw: unknown): Recording {
  const parsed = recordingSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new Error(
      `Unsupported or invalid recording at ${issue.path.join('.')}: ${issue.message}`,
    );
  }
  // Validation must not reorder state properties: the diagnostic hash uses canonical JSON order.
  const recording = raw as Recording;
  const ids = new Set(recording.initial.players.map((entry) => entry.id));
  if (
    ids.size !== 22 ||
    recording.initial.players.some(
      (entry) =>
        entry.id !== `${entry.team}-${entry.number}` ||
        (entry.role === 'keeper') !== (entry.number === 1),
    )
  )
    throw new Error('Recording roster identities are inconsistent');
  if (
    recording.initial.tick !== 0 ||
    recording.frames[0]!.tick !== 0 ||
    recording.frames.at(-1)!.tick !== recording.durationTicks
  )
    throw new Error('Recording is missing its start or final frame');
  const keeperIds = new Set(
    recording.initial.players
      .filter((player) => player.role === 'keeper')
      .map((player) => player.id),
  );
  const history = recording.initial.ball.handling;
  if (
    (history.deliberateKick &&
      !history.deliberateKick.playerId.startsWith(`${history.deliberateKick.team}-`)) ||
    [history.releasedBy, history.directThrowBy].some((id) => id !== null && !keeperIds.has(id))
  )
    throw new Error('Recording handling history is inconsistent');
  function validateHandControl(
    entry: Pick<
      Recording['frames'][number],
      'tick' | 'playingTicks' | 'half' | 'ball' | 'owner' | 'handControl' | 'phase'
    >,
    dismissed: boolean,
  ): void {
    const held = entry.handControl;
    const owner = recording.initial.players.find((player) => player.id === entry.owner);
    if (
      held &&
      (!owner ||
        !keeperIds.has(owner.id) ||
        dismissed ||
        entry.phase.type !== 'open_play' ||
        held.sinceTick > entry.tick ||
        held.sinceTick < entry.phase.sinceTick ||
        held.sincePlayingTick > entry.playingTicks ||
        held.sincePlayingTick > held.sinceTick ||
        entry.playingTicks - held.sincePlayingTick > KEEPER.maximumHoldTicks ||
        entry.ball.z !== KEEPER.handHeight ||
        (held.kind === 'pickup' && held.height > BALL_CONTROL.maximumFootControlHeight) ||
        !inPenaltyArea({ ...recording.initial, half: entry.half }, owner.team, entry.ball))
    )
      throw new Error('Recording hand possession is inconsistent');
  }
  validateHandControl(
    {
      ...recording.initial,
      owner: recording.initial.ball.owner,
      handControl: recording.initial.ball.handControl,
      ball: recording.initial.ball.position,
    },
    Boolean(
      recording.initial.players.find((player) => player.id === recording.initial.ball.owner)
        ?.dismissed,
    ),
  );
  let previousTick = -1;
  let playingTicks = 0;
  for (const entry of recording.frames) {
    const ownerIndex = recording.initial.players.findIndex((player) => player.id === entry.owner);
    validateHandControl(entry, Boolean(entry.players[ownerIndex]?.dismissed));
    if (
      entry.tick <= previousTick ||
      entry.tick > recording.durationTicks ||
      entry.playingTicks < playingTicks ||
      entry.playingTicks > entry.tick
    )
      throw new Error('Recording frame timeline is inconsistent');
    previousTick = entry.tick;
    playingTicks = entry.playingTicks;
  }
  previousTick = -1;
  for (const [index, decision] of recording.decisions.entries()) {
    if (
      decision.tick <= previousTick ||
      decision.tick >= recording.durationTicks ||
      decision.batches.some(
        (entry, side) =>
          entry.tick !== decision.tick ||
          entry.matchId !== recording.initial.matchId ||
          entry.decisionId !== recording.initial.decisionId + index ||
          entry.team !== (side === 0 ? 'coral' : 'cyan') ||
          entry.orders.some(
            (order) =>
              !order.playerId.startsWith(`${entry.team}-`) ||
              (['guard', 'pickup', 'put_down', 'distribute'].includes(order.type) &&
                !order.playerId.endsWith('-1')),
          ),
      )
    )
      throw new Error('Recording decision identity or timeline is inconsistent');
    previousTick = decision.tick;
    if (decision.notes)
      for (const team of ['coral', 'cyan'] as const) {
        const memory = decision.notes[team].memory;
        if (memory) validateTacticalMemory(memory, recording.initial.players, team);
      }
    if (decision.observations)
      for (const team of ['coral', 'cyan'] as const) {
        let observation: unknown;
        try {
          observation = JSON.parse(decision.observations[team]) as unknown;
        } catch {
          throw new Error('Invalid observation JSON');
        }
        const identity = z
          .object({
            responseIdentity: z.object({
              decisionId: z.literal(index + recording.initial.decisionId),
              tick: z.literal(decision.tick),
              team: z.literal(team),
              matchId: z.literal(recording.initial.matchId),
            }),
          })
          .safeParse(observation);
        if (!identity.success) throw new Error('Observation does not match its decision');
      }
  }
  previousTick = -1;
  for (const [index, entry] of recording.events.entries()) {
    if (entry.id !== index || entry.tick < previousTick || entry.tick > recording.durationTicks)
      throw new Error('Recording event timeline is inconsistent');
    if ((entry.type === 'keeper_release') !== (entry.delivery !== undefined))
      throw new Error('Keeper release requires a delivery and only releases may carry one');
    previousTick = entry.tick;
  }
  if (recording.kind === 'llm' && !recording.generation)
    throw new Error('Model recording is missing provenance');
  const last = recording.frames.at(-1)!;
  if (
    recording.generation?.status === 'complete' &&
    (last.phase.type !== 'full_time' ||
      last.phase.reason !== 'completed' ||
      last.half !== 2 ||
      last.playingTicks !== 2 * MATCH_TIMING.halfPlayingTicks)
  )
    throw new Error('Complete generation is missing both completed halves');
  if (recording.generation?.responseSchema) {
    try {
      JSON.parse(recording.generation.responseSchema);
    } catch {
      throw new Error('Invalid response schema JSON');
    }
  }
  return recording;
}

export async function readRecordingStream(stream: ReadableStream<Uint8Array>): Promise<Recording> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAXIMUM_RECORDING_BYTES)
        throw new Error('Recording exceeds the 80 MiB import limit');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error('Recording is not valid JSON');
  }
  return parseRecording(raw);
}
