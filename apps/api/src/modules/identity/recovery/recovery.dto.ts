import { z } from 'zod';

/**
 * POST /auth/forgot-password
 * Body: { email }
 *
 * Valida formato email. SEMPRE retorna 200 OK pra evitar enumeracao
 * de users (anti-reconhecimento). A diferenciacao entre "user existe"
 * e "user nao existe" so' acontece internamente (no service), baseada
 * no tempo de resposta e no envio (ou nao) do email.
 */
export const ForgotPasswordBodySchema = z.object({
  email: z.string().email().max(254),
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>;

/**
 * GET /auth/reset-password/validate?token=...
 *
 * Nao' tem body. Response: { valid: boolean, email?: string (mascarado) }
 */
export const ValidateTokenResponseSchema = z.object({
  valid: z.boolean(),
  // Email mascarado (ex: "u***@e***.com") - nunca expor email completo.
  email: z.string().optional(),
});
export type ValidateTokenResponse = z.infer<typeof ValidateTokenResponseSchema>;

/**
 * POST /auth/reset-password
 * Body: { token, newPassword }
 *
 * Senha forte: min 12 chars + 4 classes (upper, lower, digit, special).
 * Alinhado com NIST SP 800-63B e OWASP ASVS.
 */
export const StrongPasswordSchema = z
  .string()
  .min(12, 'Senha deve ter no minimo 12 caracteres')
  .max(128, 'Senha deve ter no maximo 128 caracteres')
  .refine((s) => /[A-Z]/.test(s), 'Senha deve conter pelo menos uma letra maiuscula')
  .refine((s) => /[a-z]/.test(s), 'Senha deve conter pelo menos uma letra minuscula')
  .refine((s) => /[0-9]/.test(s), 'Senha deve conter pelo menos um digito')
  .refine((s) => /[^A-Za-z0-9]/.test(s), 'Senha deve conter pelo menos um caractere especial');

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(20).max(100),
  newPassword: StrongPasswordSchema,
});
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;
