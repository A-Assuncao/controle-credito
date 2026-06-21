import { z } from 'zod';

/**
 * Auditoria: a API grava; o web consulta.
 * NUNCA exponha plaintext de CPF/telefone aqui.
 */
export const AuditLogEntrySchema = z.object({
  id: z.number().int().positive(),
  accountId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  correlationId: z.string().uuid().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const AuditLogQuerySchema = z.object({
  /** Filter by action (e.g. "login", "user.update") */
  action: z.string().optional(),
  /** ISO datetime lower bound */
  from: z.string().datetime().optional(),
  /** ISO datetime upper bound */
  to: z.string().datetime().optional(),
  /** Page size, default 50, max 200 */
  limit: z.number().int().min(1).max(200).default(50),
  /** Offset */
  offset: z.number().int().min(0).default(0),
});
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;