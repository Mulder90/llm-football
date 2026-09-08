import { z } from 'zod';
import { BALL_CONTROL, FIELD, PLAYERS_PER_TEAM } from '../sim/rules.ts';
import { validateBatch } from '../sim/orders.ts';
import type { Batch, MatchState, Player, Team } from '../sim/types.ts';

export const PROTOCOL_LIMITS = {
  planCharacters: 120,
  reviewCharacters: 120,
  threatCharacters: 80,
  opponentThreats: 2,
  intentCharacters: 160,
  recentEvents: 12,
} as const;
export const teamSchema = z.enum(['coral', 'cyan']);
export const playerIdSchema = z.string().regex(/^(coral|cyan)-(?:[1-9]|10|11)$/);
export const pitchTargetSchema = z.strictObject({
  x: z.number().min(0).max(FIELD.length),
  y: z.number().min(0).max(FIELD.width),
});
export const tacticalMemorySchema = z.strictObject({
  plan: z.string().max(PROTOCOL_LIMITS.planCharacters),
  ballPlayerId: playerIdSchema.nullable(),
  pass: z.strictObject({ receiverId: playerIdSchema, target: pitchTargetSchema }).nullable(),
  assignments: z
    .array(
      z.strictObject({
        playerId: playerIdSchema,
        role: z.enum(['width', 'support', 'run', 'cover', 'mark']),
        opponentId: playerIdSchema.nullable(),
      }),
    )
    .max(PLAYERS_PER_TEAM - 1),
  threats: z
    .array(
      z.strictObject({
        opponentId: playerIdSchema,
        concern: z.string().max(PROTOCOL_LIMITS.threatCharacters),
      }),
    )
    .max(PROTOCOL_LIMITS.opponentThreats),
  review: z.string().max(PROTOCOL_LIMITS.reviewCharacters),
});
export type TacticalMemory = z.infer<typeof tacticalMemorySchema>;
const playerFields = { playerId: playerIdSchema };
const kickFields = {
  ...playerFields,
  target: pitchTargetSchema,
  speed: z.number().min(BALL_CONTROL.minimumKickSpeed).max(BALL_CONTROL.maximumKickSpeed),
  loft: z.number().min(0).max(BALL_CONTROL.maximumLoftSpeed),
};
// Required loft (zero for ground passes) works with both providers' strict JSON schemas.
export const modelOrderSchema = z.union([
  z.strictObject({ type: z.literal('hold'), ...playerFields }),
  z.strictObject({
    type: z.literal('move'),
    ...playerFields,
    target: pitchTargetSchema,
    pace: z.number().min(0.01).max(1),
  }),
  z.strictObject({ type: z.literal('guard'), ...playerFields, target: pitchTargetSchema }),
  z.strictObject({ type: z.literal('kick'), ...kickFields }),
  z.strictObject({ type: z.literal('shoot'), ...kickFields }),
  z.strictObject({ type: z.literal('tackle'), ...playerFields, targetId: playerIdSchema }),
  z.strictObject({ type: z.literal('restart_taker'), ...playerFields }),
]);
export const modelResponseSchema = z.strictObject({
  batch: z.strictObject({
    version: z.literal(1),
    matchId: z.string().min(1).max(100),
    decisionId: z.int().nonnegative(),
    tick: z.int().nonnegative(),
    team: teamSchema,
    orders: z.array(modelOrderSchema).max(PLAYERS_PER_TEAM),
  }),
  intent: z.string().max(PROTOCOL_LIMITS.intentCharacters),
  memory: tacticalMemorySchema,
});
export const RESPONSE_JSON_SCHEMA = z.toJSONSchema(modelResponseSchema, { target: 'draft-7' });

export function responseSchemaFor(identity: Omit<Batch, 'orders'>) {
  return z.toJSONSchema(
    modelResponseSchema.extend({
      batch: modelResponseSchema.shape.batch.extend({
        matchId: z.literal(identity.matchId),
        decisionId: z.literal(identity.decisionId),
        tick: z.literal(identity.tick),
        team: z.literal(identity.team),
      }),
    }),
    { target: 'draft-7' },
  );
}

export type ModelDecision = { batch: Batch; intent: string; memory: TacticalMemory | null };
export function parseModelDecision(raw: unknown, state: MatchState, team: Team): ModelDecision {
  const response = modelResponseSchema.safeParse(raw);
  if (!response.success) {
    const issue = response.error.issues[0]!;
    throw new Error(`Invalid response at ${issue.path.join('.')}: ${issue.message}`);
  }
  validateTacticalMemory(
    response.data.memory,
    state.players.filter((player) => !player.dismissed),
    team,
  );
  return { ...response.data, batch: validateBatch(response.data.batch, state, team) };
}

/** Live decisions supply the active roster; historical notes may retain a player later dismissed. */
export function validateTacticalMemory(
  memory: TacticalMemory,
  roster: readonly Pick<Player, 'id' | 'team'>[],
  team: Team,
): void {
  const owns = (id: string) => roster.some((player) => player.id === id && player.team === team);
  const opposes = (id: string) => roster.some((player) => player.id === id && player.team !== team);
  const ownIds = [
    memory.ballPlayerId,
    memory.pass?.receiverId,
    ...memory.assignments.map((entry) => entry.playerId),
  ].filter((id): id is string => id != null);
  const opponentIds = [
    ...memory.assignments.map((entry) => entry.opponentId),
    ...memory.threats.map((entry) => entry.opponentId),
  ].filter((id): id is string => id != null);
  if (ownIds.some((id) => !owns(id)) || opponentIds.some((id) => !opposes(id)))
    throw new Error('Memory must reference teammates and opponents from the allowed roster');
  if (new Set(memory.assignments.map((entry) => entry.playerId)).size !== memory.assignments.length)
    throw new Error('Memory assignments must use distinct teammates');
  if (memory.pass && (!memory.ballPlayerId || memory.pass.receiverId === memory.ballPlayerId))
    throw new Error('A pass plan needs a ball player and a different receiver');
}
