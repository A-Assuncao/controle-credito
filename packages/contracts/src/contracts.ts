import { z } from 'zod';

/**
 * Schemas Zod para contracts (contratos de emprestimo).
 * EXE-002.3 (Sprint 3): CRUD de contratos + geracao de cronograma.
 *
 * Referencia: docs/master-plan.md secao 14.3 (invariantes de dominio)
 * e docs/financial-engine.md.
 */

export const ContractModalitySchema = z.enum([
  'fixed_installment',
  'interest_only',
  'bullet',
  'custom',
]);
export type ContractModality = z.infer<typeof ContractModalitySchema>;

export const ContractFrequencySchema = z.enum(['weekly', 'biweekly', 'monthly', 'custom']);
export type ContractFrequency = z.infer<typeof ContractFrequencySchema>;

export const ContractStatusSchema = z.enum(['active', 'completed', 'canceled', 'renegotiated']);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

/**
 * Schema de contract (contrato) retornado pela API.
 * `principal` e todos os valores monetarios em Cents (bigint serializado como number).
 */
export const ContractSchema = z.object({
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  productSchemaId: z.string().uuid(),
  productVersion: z.number().int().positive(),
  principal: z.number().int().positive(), // cents
  ratePerPeriod: z.string(), // decimal como string ("0.0299")
  periods: z.number().int().positive(),
  modality: ContractModalitySchema,
  frequency: ContractFrequencySchema,
  startDate: z.string(), // ISO date YYYY-MM-DD
  status: ContractStatusSchema,
  disbursedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Contract = z.infer<typeof ContractSchema>;

/**
 * Body para criar um contrato (POST /contracts).
 * O backend usa o motor de calculo (packages/domain) para gerar o cronograma.
 *
 * Para esta sprint (EXE-002.3), aceitamos apenas modalidade
 * 'fixed_installment' (Price) e 'interest_only' (So Juros). 'bullet' e 'custom'
 * sao reservados para v2.
 */
export const CreateContractSchema = z.object({
  partyId: z.string().uuid(),
  productSchemaId: z.string().uuid(),
  productVersion: z.number().int().positive(),
  modality: z.enum(['fixed_installment', 'interest_only']),
  frequency: ContractFrequencySchema,
  startDate: z.string(), // ISO date YYYY-MM-DD
  // Override do ProductSchema (opcional). Se nao fornecido, usa o do banco.
  // v2: pegar tudo do product_schemas.
  ratePerPeriod: z.string().regex(/^\d+(\.\d+)?$/), // decimal como string
  periods: z.number().int().positive().max(720), // max 60 anos se mensal
  principal: z.number().int().positive(), // cents
});
export type CreateContract = z.infer<typeof CreateContractSchema>;

/**
 * Query string para GET /contracts.
 */
export const ListContractsQuerySchema = z.object({
  status: ContractStatusSchema.optional(),
  partyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListContractsQuery = z.infer<typeof ListContractsQuerySchema>;

/**
 * Schema de installment (parcela) retornado pela API.
 * Gerado pelo motor de calculo (packages/domain) e persistido.
 */
export const InstallmentSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  number: z.number().int().positive(),
  dueDate: z.string(), // ISO date
  amount: z.number().int().nonnegative(), // cents
  principal: z.number().int().nonnegative(),
  interest: z.number().int().nonnegative(),
  balanceAfter: z.number().int().nonnegative(),
  status: z.enum(['open', 'paid', 'partial', 'overdue', 'renegotiated']),
  paidAmount: z.number().int().nonnegative(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Installment = z.infer<typeof InstallmentSchema>;
