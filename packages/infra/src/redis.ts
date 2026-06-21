import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Cliente Redis singleton. Usado para:
 * - single-session enforcement (chave session:{user_id})
 * - rate limit
 * - cache de leitura (Sprint 2+)
 *
 * Chaves DEVEM ser namespaced por tenant quando carregarem dados tenant-scoped.
 * Formato: t:{tenant_id}:{chave}
 *
 * ioredis v5+ exporta Redis como named export (nao default).
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err: Error) => {
  logger.error({ err }, 'redis error');
});
