import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@controle-credito/infra';
import { TokenService } from '../identity/token/token.service.js';

/**
 * APP-level middleware: roda em toda request antes dos guards/controllers.
 *
 * Responsabilidades (NAO mais que isso):
 *  1. Garantir `req.correlationId` (UUID v4 ou header x-correlation-id).
 *  2. Extrair JWT do cookie `cc_session` OU header `Authorization: Bearer`.
 *  3. Verificar assinatura/expiracao via TokenService.
 *  4. Popular `req.accountContext` (ou null em caso de falha).
 *
 * IMPORTANTE - REGRA ARQUITETURAL:
 *   Este middleware NAO importa `pool` nem `pg`. A definicao da variavel
 *   `app.account_id` na conexao do Postgres e' responsabilidade do service
 *   via `withAccountContext(accountId, ...)` em cada operacao de banco.
 *
 *   Motivo: o `pool` reusa conexoes entre requests. SET LOCAL (sem transacao)
 *   vira SET SESSION e vazaria o account_id entre tenants. Por isso o
 *   middleware e' puramente CPU.
 *
 * Contrato com apps/web (task 7):
 *   - Cookie name: `cc_session`
 *   - Atributos esperados: HttpOnly; SameSite=Lax; Path=/; Secure (em prod)
 *   - Max-Age: 900s (15 min) para casar com o TTL do access token
 *   - Valor: o JWT bruto (sem `Bearer `)
 *
 * Falhas de auth NAO bloqueiam aqui - o AuthGuard global decide se 401 com
 * base em `req.accountContext == null` e na presenca de @Public().
 */
@Injectable()
export class AccountContextMiddleware implements NestMiddleware {
  private static readonly COOKIE_NAME = 'cc_session';

  constructor(private readonly tokenService: TokenService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.correlationId = this.ensureCorrelationId(req);
    res.setHeader('x-correlation-id', req.correlationId);

    const token = this.extractToken(req);
    if (token == null) {
      req.accountContext = null;
      next();
      return;
    }

    try {
      const payload = await this.tokenService.verify(token);
      req.accountContext = this.tokenService.toAccountContext(payload);
    } catch (err) {
      const reason = this.classifyError(err);
      logger.info(
        { event: 'auth.fail', reason, correlationId: req.correlationId, path: req.path },
        'jwt verification failed',
      );
      req.accountContext = null;
    }

    next();
  }

  /**
   * Lê o correlationId do header `x-correlation-id` se presente, senao gera.
   * Aceita qualquer string nao-vazia; o client e' responsavel por enviar UUID
   * valido se quiser correlacao fim-a-fim.
   */
  private ensureCorrelationId(req: Request): string {
    const incoming = req.header('x-correlation-id');
    if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 200) {
      return incoming;
    }
    return randomUUID();
  }

  /**
   * Ordem de preferencia: cookie `cc_session` > header `Authorization: Bearer`.
   * NUNCA ler de query string - tokens em URL vazam em logs de proxy/access log.
   */
  private extractToken(req: Request): string | null {
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
      AccountContextMiddleware.COOKIE_NAME
    ];
    if (typeof fromCookie === 'string' && fromCookie.length > 0) {
      return fromCookie;
    }

    const authHeader = req.header('authorization');
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      if (token.length > 0) return token;
    }

    return null;
  }

  /**
   * Classifica erro do jose em uma string curta para log (sem vazar
   * detalhes do token). `logger` ja redige campos como token/cookie,
   * mas reduzimos o payload por defesa em profundidade.
   */
  private classifyError(err: unknown): 'expired' | 'invalid_signature' | 'malformed' | 'other' {
    if (!(err instanceof Error)) return 'other';
    const code = (err as Error & { code?: string; name?: string }).code;
    const name = err.name;
    if (code === 'ERR_JWT_EXPIRED' || name === 'JWTExpired') return 'expired';
    if (code === 'ERR_JWS_INVALID' || code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return 'invalid_signature';
    }
    if (code === 'ERR_JWT_MALFORMED' || name === 'JWSInvalid' || name === 'JWTInvalid') {
      return 'malformed';
    }
    return 'other';
  }
}
