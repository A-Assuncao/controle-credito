import { Injectable } from '@nestjs/common';
import { type Party, type CreateParty, type ListPartiesQuery } from '@controle-credito/contracts';
import { PartiesRepository, type PartyRow } from './parties.repository.js';

/**
 * Camada de service para parties (tomadores).
 *
 * Responsabilidades:
 * - chamar o repository dentro do account context
 * - mapear PartyRow (snake_case) -> Party (camelCase, contrato HTTP)
 *
 * NAO faz validacao: ZodValidationPipe ja' validou o input no controller.
 * NAO faz audit: AuditLoggerInterceptor global grava POSTs automaticamente.
 */
@Injectable()
export class PartiesService {
  constructor(private readonly parties: PartiesRepository) {}

  /**
   * Cria um tomador. O account_id vem do JWT (sempre single-tenant).
   */
  async create(accountId: string, input: CreateParty): Promise<Party> {
    const row = await this.parties.create(accountId, input);
    return this.toDto(row);
  }

  /**
   * Lista tomadores do account corrente com filtros e paginacao.
   */
  async list(accountId: string, query: ListPartiesQuery): Promise<Party[]> {
    const rows = await this.parties.list(accountId, query);
    return rows.map((row) => this.toDto(row));
  }

  private toDto(row: PartyRow): Party {
    return {
      id: row.id,
      name: row.name,
      document: row.document,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
