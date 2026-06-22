import { Pool, type PoolClient } from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Pool de conexoes PostgreSQL para o caminho tenant (withAccountContext).
 * Usa o role `app` (sem BYPASSRLS) - toda query passa pela policy RLS
 * via SET LOCAL de app.account_id. Defesa em profundidade.
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
 * Pool separado para o caminho system (withSystemContext). Usa o role
 * `app_system` (BYPASSRLS) - ignora policies para operacoes que NAO tem
 * account_id (signup, refresh token lookup cross-tenant, jobs).
 *
 * Manter pool separado garante que o pool principal nunca use o role
 * com bypass, mesmo por bug de aplicacao.
 */
const systemPool = new Pool({
  connectionString: env.DATABASE_URL_SYSTEM ?? env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

systemPool.on('error', (err) => {
  logger.error({ err }, 'pg system pool error');
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
 * Contexto "system" para operacoes fora de qualquer account_id (criacao de conta
 * inicial, refresh token lookup, jobs). Roda em pool com role BYPASSRLS.
 *
 * NUNCA usar para leitura/escrita de dados tenant-scoped. Toda query em
 * users/audit_log com dados de um user especifico DEVE passar por
 * withAccountContext com o account_id conhecido.
 */
export async function withSystemContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await systemPool.connect();
  try {
    await client.query('BEGIN');
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
  await systemPool.end();
}