import { z } from 'zod';

/**
 * Schemas Zod para product_schemas (versionamento de produto financeiro).
 * EXE-002.3 (Sprint 3).
 *
 * Cada Contract referencia (id, version) CONGELADO. Mudanca de qualquer
 * campo = nova version (regra 14.3 do master-plan).
 *
 * v1: criacao ja' fica 'active' (workflow draft->active fica para v2).
 * version eh' gerada pelo backend (incrementa por id dentro do account).
 */

export const ProductSchemaStatusSchema = z.enum(['draft', 'active', 'deprecated']);
export type ProductSchemaStatus = z.infer<typeof ProductSchemaStatusSchema>;

export const ProductModalitySchema = z.enum([
  'fixed_installment',
  'interest_only',
  'bullet',
  'custom',
]);
export const ProductFrequencySchema = z.enum(['weekly', 'biweekly', 'monthly', 'custom']);
export const InterestTypeSchema = z.enum(['simple', 'compound']);
export const CapitalizationSchema = z.enum(['daily', 'monthly']);
export const EarlySettlementMethodSchema = z.enum(['prospectus', 'simple_deduction']);
export const RoundingPolicySchema = z.enum(['HALF_EVEN', 'HALF_UP', 'HALF_DOWN']);

/**
 * Parametros de juros. rate_per_period em decimal como string
 * (ex: "0.0299" = 2.99% a.p.).
 */
export const InterestParamsSchema = z.object({
  type: InterestTypeSchema,
  ratePerPeriod: z.string().regex(/^\d+(\.\d+)?$/),
  capitalization: CapitalizationSchema.optional(),
});
export type InterestParams = z.infer<typeof InterestParamsSchema>;

/**
 * Parametros de penalidade.
 * - fixed: % fixa de multa (decimal string)
 * - daily: % de mora diaria (decimal string)
 * - graceDays: dias de carencia antes de aplicar multa/mora
 */
export const PenaltyParamsSchema = z.object({
  fixed: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  daily: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  graceDays: z.number().int().min(0).default(0),
});
export type PenaltyParams = z.infer<typeof PenaltyParamsSchema>;

export const EarlySettlementParamsSchema = z.object({
  method: EarlySettlementMethodSchema,
  deductionRate: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
});
export type EarlySettlementParams = z.infer<typeof EarlySettlementParamsSchema>;

/**
 * Config JSONB do product_schema - shape completo do ProductSchema (domain).
 * Persistido como JSONB e reidratado pelo contracts.service para alimentar
 * o motor de calculo (generateSchedule).
 */
export const ProductSchemaConfigSchema = z.object({
  modality: ProductModalitySchema,
  frequency: ProductFrequencySchema,
  interest: InterestParamsSchema,
  penalty: PenaltyParamsSchema,
  earlySettlement: EarlySettlementParamsSchema,
  rounding: RoundingPolicySchema.default('HALF_EVEN'),
});
export type ProductSchemaConfig = z.infer<typeof ProductSchemaConfigSchema>;

/**
 * Schema de product_schema retornado pela API.
 */
export const ProductSchemaResourceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: ProductSchemaStatusSchema,
  name: z.string().min(1).max(200),
  effectiveFrom: z.string(), // ISO date YYYY-MM-DD
  config: ProductSchemaConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductSchemaResource = z.infer<typeof ProductSchemaResourceSchema>;

/**
 * Body para criar um product_schema (POST /product-schemas).
 * accountId vem do JWT. version gerada pelo backend.
 */
export const CreateProductSchemaSchema = z.object({
  name: z.string().min(1).max(200),
  config: ProductSchemaConfigSchema,
  effectiveFrom: z.string(), // ISO date YYYY-MM-DD
});
export type CreateProductSchema = z.infer<typeof CreateProductSchemaSchema>;

/**
 * Query string para GET /product-schemas.
 */
export const ListProductSchemasQuerySchema = z.object({
  status: ProductSchemaStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListProductSchemasQuery = z.infer<typeof ListProductSchemasQuerySchema>;
