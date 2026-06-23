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

/**
 * Schema de atualizacao da account (PATCH /accounts/me).
 * Campos imutaveis (id, status, createdAt) NAO estao aqui.
 * settings eh um jsonb livre - validamos apenas que eh um objeto.
 */
export const UpdateAccountSchema = z
  .object({
    fullName: z.string().min(1).max(200).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .strict();
export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;

/**
 * Resposta de GET /accounts/me. Inclui dados do user atual (full_name, email, mfa_enabled)
 * e dados da account (status, settings). NAO inclui campos sensiveis
 * (password_hash, mfa_secret_encrypted, last_session_revoked_at).
 */
export const MeResponseSchema = z.object({
  account: AccountSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    mfaEnabled: z.boolean(),
    lastLoginAt: z.string().datetime().nullable(),
  }),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
