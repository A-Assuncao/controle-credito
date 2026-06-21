import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '@controle-credito/infra';
import type { AccountContextPayload } from '../../account-context/account-context.types.js';
import type { AccessTokenPayload } from '../identity.types.js';

/**
 * Assina e verifica access tokens (JWT HS256).
 *
 * - Algoritmo fixado em HS256 (explicito) para rejeitar `alg: none` e variacoes.
 * - Expiracao padrao: 15 minutos (alinhado com docs/security-model.md).
 * - Segredo vem de `env.JWT_SECRET` (validado >= 32 chars em packages/infra/src/env.ts).
 *
 * Refresh tokens, revogacao granular e emissao via login entram na task 6b.
 * Esta task so estabelece o formato verificavel para o AuthGuard.
 */
@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;
  private readonly issuer = 'controle-credito-api';
  private readonly audience = 'controle-credito-web';
  private readonly defaultTtlSeconds = 15 * 60;

  constructor() {
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
  }

  /**
   * Assina um access token. Claims `sub`, `account_id` e `mfa` sao
   * obrigatorios; iat/exp sao preenchidos pelo jose.
   */
  async sign(payload: AccessTokenPayload, ttlSeconds = this.defaultTtlSeconds): Promise<string> {
    return await new SignJWT({
      account_id: payload.account_id,
      mfa: payload.mfa,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(payload.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.secret);
  }

  /**
   * Verifica e retorna os claims. Lanca `JOSEError` em qualquer falha
   * (expirado, signature invalida, issuer/audience incorretos, malformado).
   * O caller (middleware) mapeia para 401.
   */
  async verify(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
    return this.normalize(payload);
  }

  /**
   * Converte payload JWT cru para o AccountContextPayload camelCase que
   * os services/guards consomem. Centralizar a renomeacao evita divergencia
   * entre `sub`/`account_id`/`mfa` e os campos do request.
   */
  toAccountContext(payload: AccessTokenPayload): AccountContextPayload {
    return {
      accountId: payload.account_id,
      userId: payload.sub,
      mfaStatus: payload.mfa ?? 'not_required',
    };
  }

  /**
   * Narrow do payload jose (que tem `string | unknown` em varios campos)
   * para o tipo AccessTokenPayload. Validacao minimalista; o zod em
   * packages/contracts e' a fonte de verdade para requests HTTP, este
   * narrow so protege o payload ja' confiavel (assinado por nos).
   */
  private normalize(payload: JWTPayload): AccessTokenPayload {
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('JWT payload missing sub');
    }
    if (typeof payload.account_id !== 'string' || payload.account_id.length === 0) {
      throw new Error('JWT payload missing account_id');
    }
    const mfa = payload.mfa;
    if (mfa !== undefined && mfa !== 'pending' && mfa !== 'verified' && mfa !== 'not_required') {
      throw new Error('JWT payload has invalid mfa claim');
    }
    return {
      sub: payload.sub,
      account_id: payload.account_id,
      ...(mfa !== undefined ? { mfa } : {}),
    };
  }
}
