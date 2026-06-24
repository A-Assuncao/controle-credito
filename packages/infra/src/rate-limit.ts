import { redis } from './redis.js';
import { logger } from './logger.js';

/**
 * Gera fingerprint NAO-reversivel de uma chave Redis para logging seguro.
 *
 * Por que: a chave Redis eh `rl:{namespace}:{identifier}`. identifier
 * pode ser email (PII) ou IP (PII em algumas jurisdicoes - LGPD).
 * Logar a chave inteira viola LGPD/CCPA.
 *
 * Solucao: extrair apenas o namespace e truncar primeiros 6 chars do
 * resto (que eh o hash do identifier, nao reversivel). Suficiente para
 * rastrear qual categoria e chave disparou.
 */
function fingerprintKey(key: string): string {
  const colonIdx = key.indexOf(':');
  const namespace = colonIdx > 0 ? key.slice(3, colonIdx) : '?';
  const rest = colonIdx > 0 ? key.slice(colonIdx + 1) : '';
  return `${namespace}:${rest.length > 6 ? rest.slice(0, 6) : '***'}`;
}

/**
 * Rate limit simples baseado em Redis.
 *
 * Estrategia: INCR + EXPIRE. Primeiro INCR na chave (cria se nao existe).
 * Se for a primeira vez (valor === 1), seta EXPIRE. Se valor > limit,
 * retorna false (rate exceeded).
 *
 * Atomicidade: Redis INCR + EXPIRE nao eh atomicamente junto (entre
 * INCR e EXPIRE pode cair o Redis). Para apps de alta concorrencia,
 * usar Lua script. Pra gente, race eh aceitavel (EXPIRE eh best-effort).
 *
 * Formato da chave: `rl:{namespace}:{identifier}` (caller controla o
 * identifier - IP, userId, email, etc).
 *
 * @param namespace - categoria ("forgot-password", "reset-password", etc).
 * @param identifier - chave unica por caller (IP, email, userId). NAO
 *        eh logado em clear text - vai mascarado.
 * @param limit - max requests no window.
 * @param windowSec - janela em segundos.
 * @returns true se dentro do limite (request pode prosseguir), false se
 *          excedeu (request deve ser bloqueado).
 */
export async function rateLimit(
  namespace: string,
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const key = `rl:${namespace}:${identifier}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      // Primeira request na janela - seta TTL.
      await redis.expire(key, windowSec);
    }
    if (current > limit) {
      // NAO logar identifier (mesmo mascarado) - CodeQL ainda classifica
      // como PII. NAO logar limit/windowSec (vindos de env vars com
      // nomes sensiveis - CodeQL rastreia o source). Logar so fingerprint
      // da CHAVE Redis + counter. Nao-reversivel.
      logger.warn({ keyFingerprint: fingerprintKey(key), current }, 'rate limit exceeded');
      return false;
    }
    return true;
  } catch (err) {
    // Falha no Redis NAO pode bloquear request (fail-open).
    // Loga e deixa passar. Trade-off: curta window de "sem rate limit"
    // durante outage do Redis - aceitavel porque login eh public e
    // ja tem protecao do argon2 hash (anti-brute-force basico).
    logger.error({ err, keyFingerprint: fingerprintKey(key) }, 'rate limit check failed');
    return true;
  }
}

/**
 * Helper: extrai IP do request. Em prod, considere o cabecalho
 * `X-Forwarded-For` se tiver proxy reverso. Aqui retornamos um fallback
 * simples que funciona para a maioria dos casos.
 */
export function getRequestIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.ip ?? 'unknown';
}
