import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogRepository } from './audit.repository.js';
import { AuthGuard } from '../identity/guards/auth.guard.js';
import { CurrentAccount } from '../common/decorators/index.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  AuditLogQuerySchema,
  type AuditLogEntry,
  type AuditLogQuery,
} from '@controle-credito/contracts';

/**
 * GET /accounts/me/audit - trilha de auditoria do usuario logado.
 *
 * Query params via ZodValidationPipe. Filtros: action, from, to, limit, offset.
 *
 * AuthGuard exige sessao. RLS garante que so' ve entradas do proprio account_id.
 * O schema `audit_log` NAO tem FK para accounts (LGPD: trilha sobrevive a conta).
 */
@Controller('accounts/me/audit')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditLogRepository) {}

  @Get()
  async list(
    @CurrentAccount() accountId: string,
    @Query(new ZodValidationPipe(AuditLogQuerySchema)) query: AuditLogQuery,
  ): Promise<{ items: AuditLogEntry[]; total: number; limit: number; offset: number }> {
    const [items, total] = await Promise.all([
      this.audit.list(accountId, query),
      this.audit.count(accountId, query),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }
}
