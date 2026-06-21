import { z } from 'zod';
import { LoginRequestSchema, MfaVerifyRequestSchema } from '@controle-credito/contracts';

export const LoginBodySchema = LoginRequestSchema;
export type LoginBody = z.infer<typeof LoginBodySchema>;

/**
 * /auth/refresh recebe o refresh token no body (NAO no cookie nesta versao,
 * porque o cookie e' gerenciado pelo apps/web - o apps/api so valida e
 * devolve novo access).
 */
export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(20).max(200),
  userId: z.string().uuid(),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  mfaRequired: z.boolean(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * /auth/login retorna isto. O frontend armazena e usa no proximo access.
 * O MFA verify usa o mesmo response.
 */
export const MfaVerifyBodySchema = MfaVerifyRequestSchema;
export type MfaVerifyBody = z.infer<typeof MfaVerifyBodySchema>;
