import { Injectable } from '@nestjs/common';
import { withAccountContext } from '@controle-credito/infra';
import type { ProductSchemaConfig, ProductSchemaStatus } from '@controle-credito/contracts';

/**
 * Repositorio de product_schemas. Toda query roda dentro do account_id
 * do request via withAccountContext (RLS automatico).
 *
 * version eh' gerada por id dentro do account: toda nova criacao com mesmo
 * id incrementa version. Para v1, cada POST cria um novo id (Gen) com
 * version=1; a reidratacao por (id, version) congelada funciona pois o
 * contrato referencia esses dois campos imutaveis.
 */
export interface ProductSchemaRow {
  id: string;
  account_id: string;
  version: number;
  status: ProductSchemaStatus;
  name: string;
  modality: string;
  frequency: string;
  config: ProductSchemaConfig;
  effective_from: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ProductSchemasRepository {
  /**
   * Cria um product_schema com status 'active' e version=1.
   * v2: workflow draft->active + versionamento incremental por id.
   */
  async create(
    accountId: string,
    input: {
      name: string;
      config: ProductSchemaConfig;
      effectiveFrom: string;
    },
  ): Promise<ProductSchemaRow> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<ProductSchemaRow>(
        `INSERT INTO product_schemas (account_id, version, status, name, modality, frequency, config, effective_from)
         VALUES ($1, 1, 'active', $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          accountId,
          input.name,
          input.config.modality,
          input.config.frequency,
          JSON.stringify(input.config),
          input.effectiveFrom,
        ],
      );
      const row = r.rows[0];
      if (row == null) throw new Error('failed to insert product_schema');
      return row;
    });
  }

  /**
   * Busca um product_schema por (id, version) dentro do account. Retorna null
   * se nao encontrado ou pertencer a outro tenant (RLS esconde).
   * Usado pelo contracts.service para reidratar o ProductSchema congelado.
   */
  async findByIdVersion(
    accountId: string,
    id: string,
    version: number,
  ): Promise<ProductSchemaRow | null> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<ProductSchemaRow>(
        `SELECT * FROM product_schemas WHERE id = $1 AND version = $2 LIMIT 1`,
        [id, version],
      );
      return r.rows[0] ?? null;
    });
  }

  async list(
    accountId: string,
    query: {
      status?: ProductSchemaStatus | undefined;
      limit: number;
      offset: number;
    },
  ): Promise<ProductSchemaRow[]> {
    return withAccountContext(accountId, async (client) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      if (query.status !== undefined) {
        conditions.push(`status = $${p++}::text`);
        params.push(query.status);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT * FROM product_schemas
        ${where}
        ORDER BY created_at DESC
        LIMIT $${p} OFFSET $${p + 1}
      `;
      const r = await client.query<ProductSchemaRow>(sql, [...params, query.limit, query.offset]);
      return r.rows;
    });
  }
}
