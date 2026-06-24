import { redis } from './redis.js';
import { logger } from './logger.js';

/**
 * Mascara identifier pra evitar logar PII (ex: email) em clear text.
 *
 * Por que: rate limit usa identifier (IP, email, userId) como chave
 * Redis. IP pode ser PII em algumas jurisdicoes (LGPD), email eh
 * PII definitivo. Mascarar no log: emails viram "e***@e***.com",
 * IPs viram so os 2 primeiros octetos.
 */
function maskIdentifier(identifier: string): string {
  // Email
  if (identifier.includes('@')) {
    const [local = '', domain = ''] = identifier.split('@');
    const [sub = '', ...tldParts] = domain.split('.');
    const tld = tldParts.length > 0 ? `.${tldParts.join('.')}` : '';
    const maskedLocal = local.length > 0 ? `${local[0]}***` : '***';
    const maskedSub = sub.length > 0 ? `${sub[0]}***` : '***';
    return `${maskedLocal}@${maskedSub}${tld}`;
  }
  // IP (IPv4 simples: 4 octetos)
  const octets = identifier.split('.');
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.*.*`;
  }
  // Outro (userId UUID, etc): trunca.
  if (identifier.length > 8) {
    return `${identifier.slice(0, 8)}***`;
  }
  return '***';
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
      // Mascarar identifier - pode ser email ou IP (PII).
      logger.warn(
        { namespace, identifier: maskIdentifier(identifier), current, limit, windowSec },
        'rate limit exceeded',
      );
      return false;
    }
    return true;
  } catch (err) {
    // Falha no Redis NAO pode bloquear request (fail-open).
    // Loga e deixa passar. Trade-off: curta window de "sem rate limit"
    // durante outage do Redis - aceitavel porque login eh public e
    // ja tem protecao do argon2 hash (anti-brute-force basico).
    logger.error(
      { err, namespace, identifier: maskIdentifier(identifier) },
      'rate limit check failed',
    );
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
