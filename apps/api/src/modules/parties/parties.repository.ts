import { Injectable } from '@nestjs/common';
import { withAccountContext } from '@controle-credito/infra';
import type { PartyStatus } from '@controle-credito/contracts';

/**
 * Repositorio de parties (tomadores). Toda query roda dentro do account_id
 * do request via withAccountContext - RLS policy filtra automaticamente.
 *
 * NAO ha metodo `create` em system context: a criacao de tomador eh'
 * SEMPRE feita por um usuario autenticado (single-tenant). Em um eventual
 * fluxo de onboarding onde o tomador vem de fora do tenant, isso deve
 * virar um caso explicito com withSystemContext + validacao forte.
 */
export interface PartyRow {
  id: string;
  account_id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: PartyStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PartiesRepository {
  /**
   * Cria um tomador dentro do account_id corrente. Campos opcionais (document,
   * email, phone, notes) ficam NULL se nao fornecidos - a CHECK constraint
   * no status garante default 'active'.
   */
  async create(
    accountId: string,
    input: {
      name: string;
      document?: string | undefined;
      email?: string | undefined;
      phone?: string | undefined;
      notes?: string | undefined;
    },
  ): Promise<PartyRow> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<PartyRow>(
        `INSERT INTO parties (account_id, name, document, email, phone, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          accountId,
          input.name,
          input.document ?? null,
          input.email ?? null,
          input.phone ?? null,
          input.notes ?? null,
        ],
      );
      const row = r.rows[0];
      if (row == null) throw new Error('failed to insert party');
      return row;
    });
  }

  /**
   * Busca um tomador por id dentro do account_id. Retorna null se nao
   * encontrado (ou se pertencer a outro tenant - RLS esconde).
   */
  async findById(accountId: string, partyId: string): Promise<PartyRow | null> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<PartyRow>(`SELECT * FROM parties WHERE id = $1 LIMIT 1`, [
        partyId,
      ]);
      return r.rows[0] ?? null;
    });
  }

  /**
   * Lista tomadores do account, com filtros opcionais e paginacao.
   *
   * - status: filtro exato
   * - search: LIKE case-insensitive sobre name (apenas inicio - ILIKE 'prefix%').
   *   Para fuzzy/acentos fica para v2.
   * - limit/offset: paginacao server-side
   *
   * Ordenacao: name ASC (alfabetica). created_at DESC eh' alternativa,
   * mas lista alfabetica eh' mais previsivel para UI.
   */
  async list(
    accountId: string,
    query: {
      status?: PartyStatus | undefined;
      search?: string | undefined;
      limit: number;
      offset: number;
    },
  ): Promise<PartyRow[]> {
    return withAccountContext(accountId, async (client) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (query.status !== undefined) {
        conditions.push(`status = $${p++}::text`);
        params.push(query.status);
      }
      if (query.search !== undefined && query.search.length > 0) {
        conditions.push(`name ILIKE $${p++}`);
        params.push(`${query.search}%`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const limitParam = p;
      const offsetParam = p + 1;
      const sql = `
        SELECT * FROM parties
        ${where}
        ORDER BY name ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `;
      const r = await client.query<PartyRow>(sql, [...params, query.limit, query.offset]);
      return r.rows;
    });
  }
}
