import { z } from 'zod';

/**
 * Contratos (schemas Zod) compartilhados entre api e web.
 * Regra: tipos do dominio sao derivados via z.infer, nunca duplicados.
 */

export const AccountStatusSchema = z.enum(['active', 'suspended', 'canceled']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const AccountSchema = z.object({
  id: z.string().uuid(),
  status: AccountStatusSchema,
  settings: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Account = z.infer<typeof AccountSchema>;