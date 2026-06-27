import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  type CreateParty,
  CreatePartySchema,
  type ListPartiesQuery,
  ListPartiesQuerySchema,
  type Party,
} from '@controle-credito/contracts';
import { CurrentAccount } from '../common/decorators/index.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuthGuard } from '../identity/guards/auth.guard.js';
import { PartiesService } from './parties.service.js';

/**
 * Endpoints de parties (tomadores).
 *
 *   POST /parties  - criar tomador (AuthGuard global exige conta)
 *   GET  /parties  - listar tomadores do account (filtros via query)
 *
 * AuthGuard global (APP_GUARD) ja' protege. accountId vem do JWT via
 * @CurrentAccount(). Cross-account impossivel: RLS filtra no DB.
 *
 * Validacao: ZodValidationPipe em body e query. Erros -> 422 com `issues`.
 * Auditoria: AuditLoggerInterceptor global grava POSTs automaticamente
 * (action="POST /parties", resource_type="parties").
 */
@Controller('parties')
@UseGuards(AuthGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Post()
  async create(
    @CurrentAccount() accountId: string,
    @Body(new ZodValidationPipe(CreatePartySchema)) body: CreateParty,
  ): Promise<Party> {
    return this.partiesService.create(accountId, body);
  }

  @Get()
  async list(
    @CurrentAccount() accountId: string,
    @Query(new ZodValidationPipe(ListPartiesQuerySchema)) query: ListPartiesQuery,
  ): Promise<Party[]> {
    return this.partiesService.list(accountId, query);
  }
}
