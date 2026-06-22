import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const MfaSetupResponseSchema = z.object({
  /** Base32 secret to be encoded into QR */
  secret: z.string(),
  /** otpauth URI for QR code generation */
  otpauthUrl: z.string(),
});
export type MfaSetupResponse = z.infer<typeof MfaSetupResponseSchema>;

export const MfaVerifyRequestSchema = z.object({
  /** 6-digit TOTP code */
  code: z.string().regex(/^\d{6}$/),
});
export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().max(254),
  /** Last 4 digits of phone used in account creation */
  phoneTail: z.string().regex(/^\d{4}$/),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  /** Token from email link */
  emailToken: z.string().min(20),
  /** SMS code */
  smsCode: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(200),
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;