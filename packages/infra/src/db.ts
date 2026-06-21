import { Pool, type PoolClient } from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Pool de conexoes PostgreSQL.
 * Toda query multi-tenant deve passar por `withAccountContext` para setar
 * `app.account_id` na sessao - eh o que ativa a policy RLS (regra 3).
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'pg pool error');
});

/**
 * Roda callback dentro de transacao com `account_id` setado via SET LOCAL.
 * `SET LOCAL` so vale dentro da transacao - sai dela e o efeito evapora (defesa em profundidade).
 */
export async function withAccountContext<T>(
  accountId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.account_id', $1, true)", [accountId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Contexto "system" para operacoes fora de qualquer account_id (criacao de conta inicial, jobs).
 * NUNCA usar para leitura/escrita de dados tenant-scoped.
 */
export async function withSystemContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.account_id', '', true)");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}