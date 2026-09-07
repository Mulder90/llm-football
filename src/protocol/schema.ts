import { z } from 'zod';
import { BALL_CONTROL, FIELD, PLAYERS_PER_TEAM } from '../sim/rules.ts';
import { validateBatch } from '../sim/orders.ts';
import type { Batch, MatchState, Team } from '../sim/types.ts';

export const PROTOCOL_LIMITS = {
  memoryCharacters: 500,
  intentCharacters: 160,
  recentEvents: 12,
} as const;
export const teamSchema = z.enum(['coral', 'cyan']);
export const playerIdSchema = z.string().regex(/^(coral|cyan)-(?:[1-9]|10|11)$/);
export const pitchTargetSchema = z.strictObject({
  x: z.number().min(0).max(FIELD.length),
  y: z.number().min(0).max(FIELD.width),
});
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
  memory: z.string().max(PROTOCOL_LIMITS.memoryCharacters),
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

export type ModelDecision = { batch: Batch; intent: string; memory: string };
export function parseModelDecision(raw: unknown, state: MatchState, team: Team): ModelDecision {
  const response = modelResponseSchema.safeParse(raw);
  if (!response.success) {
    const issue = response.error.issues[0]!;
    throw new Error(`Invalid response at ${issue.path.join('.')}: ${issue.message}`);
  }
  return { ...response.data, batch: validateBatch(response.data.batch, state, team) };
}
