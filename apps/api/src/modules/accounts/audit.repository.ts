import { Injectable } from '@nestjs/common';
import { withAccountContext } from '@controle-credito/infra';
import type { AuditLogQuery, AuditLogEntry } from '@controle-credito/contracts';

interface AuditLogRow {
  id: string;
  account_id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  correlation_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

@Injectable()
export class AuditLogRepository {
  /**
   * Lista audit entries da account corrente, paginadas e filtradas.
   * Roda com withAccountContext - RLS filtra automaticamente.
   */
  async list(accountId: string, query: AuditLogQuery): Promise<AuditLogEntry[]> {
    return withAccountContext(accountId, async (client) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (query.action !== undefined) {
        conditions.push(`action = $${p++}::text`);
        params.push(query.action);
      }
      if (query.from !== undefined) {
        conditions.push(`created_at >= $${p++}::timestamptz`);
        params.push(query.from);
      }
      if (query.to !== undefined) {
        conditions.push(`created_at <= $${p++}::timestamptz`);
        params.push(query.to);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // params + limit + offset
      const limitParam = p;
      const offsetParam = p + 1;
      const sql = `
        SELECT * FROM audit_log
        ${where}
        ORDER BY created_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `;
      const r = await client.query<AuditLogRow>(sql, [...params, query.limit, query.offset]);
      return r.rows.map((row) => this.toDto(row));
    });
  }

  /**
   * Conta total de entries que casam o filtro (para paginacao client-side).
   */
  async count(accountId: string, query: AuditLogQuery): Promise<number> {
    return withAccountContext(accountId, async (client) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      if (query.action !== undefined) {
        conditions.push(`action = $${p++}::text`);
        params.push(query.action);
      }
      if (query.from !== undefined) {
        conditions.push(`created_at >= $${p++}::timestamptz`);
        params.push(query.from);
      }
      if (query.to !== undefined) {
        const pTo = p + 1;
        conditions.push(`created_at <= $${pTo}::timestamptz`);
        params.push(query.to);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_log ${where}`,
        params,
      );
      return Number(r.rows[0]?.count ?? '0');
    });
  }

  /**
   * Insere um audit entry. Chamado pelo AuditLoggerInterceptor.
   * Roda dentro do account context - actor_user_id eh opcional.
   */
  async insert(
    accountId: string,
    entry: {
      actorUserId: string | null;
      action: string;
      resourceType: string;
      resourceId: string | null;
      metadata: Record<string, unknown>;
      correlationId: string | null;
      ipAddress: string | null;
      userAgent: string | null;
    },
  ): Promise<void> {
    await withAccountContext(accountId, async (client) => {
      await client.query(
        `INSERT INTO audit_log
          (account_id, actor_user_id, action, resource_type, resource_id,
           metadata, correlation_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::inet, $9)`,
        [
          accountId,
          entry.actorUserId,
          entry.action,
          entry.resourceType,
          entry.resourceId,
          JSON.stringify(entry.metadata),
          entry.correlationId,
          entry.ipAddress,
          entry.userAgent,
        ],
      );
    });
  }

  private toDto(row: AuditLogRow): AuditLogEntry {
    return {
      id: Number(row.id),
      accountId: row.account_id,
      actorUserId: row.actor_user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: row.metadata,
      correlationId: row.correlation_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
    };
  }
}
