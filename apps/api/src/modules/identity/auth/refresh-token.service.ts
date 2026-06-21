import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { redis } from '@controle-credito/infra';

/**
 * Gerencia refresh tokens em Redis.
 *
 * Convenção:
 *   chave    = `refresh:{user_id}`
 *   valor    = sha256(refresh_token_bruto) em hex
 *   TTL      = 30 dias
 *
 * Fluxo:
 *   1. login/signup: gera refresh aleatorio (32 bytes), salva hash em Redis, devolve o bruto.
 *   2. /auth/refresh: recebe refresh bruto, calcula hash, busca no Redis. Se bate, emite novo access.
 *      Se não bate, refresh é inválido/expirado/revogado.
 *   3. logout: DEL refresh:{user_id} => revogação instantânea de todos os refreshes do user.
 *
 * Por que hash e não o token bruto?
 *   - Defesa em profundidade: se o Redis for exfiltrado, attacker não consegue
 *     usar os refreshes diretamente. Ainda precisaria brute-forçar sha256
 *     (inviável com 32 bytes de entropia = 256 bits).
 *   - Mesma técnica que Google/Meta usam para session tokens.
 */
@Injectable()
export class RefreshTokenService {
  private static readonly TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias
  private static readonly KEY_PREFIX = 'refresh:';

  /**
   * Gera um refresh token novo, persiste o hash no Redis e devolve o bruto.
   */
  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const hash = this.hash(token);
    await redis.set(
      `${RefreshTokenService.KEY_PREFIX}${userId}`,
      hash,
      'EX',
      RefreshTokenService.TTL_SECONDS,
    );
    return token;
  }

  /**
   * Valida um refresh token: calcula hash, compara com o armazenado.
   * Retorna true se valido (e nao foi consumido antes).
   *
   * Single-use opcional (refresh token rotation): nao implementado nesta task.
   * Se virar requisito Sprint 2, adicionar campo `consumed_at` e checar aqui.
   */
  async validate(userId: string, token: string): Promise<boolean> {
    const stored = await redis.get(`${RefreshTokenService.KEY_PREFIX}${userId}`);
    if (stored == null) return false;
    return stored === this.hash(token);
  }

  /**
   * Revoga todos os refreshes do user (logout + revogacao global).
   */
  async revoke(userId: string): Promise<void> {
    await redis.del(`${RefreshTokenService.KEY_PREFIX}${userId}`);
  }

  /**
   * Hash deterministico do token. SHA-256 suficiente - nao precisa ser
   * HMAC porque o Redis ja e' trusted (mesmo dominio, TLS em prod).
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
