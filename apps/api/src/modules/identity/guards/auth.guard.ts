import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { UsersRepository } from '../users/users.repository.js';

/**
 * Guard global (registrado como APP_GUARD no app.module.ts via useFactory para DI).
 *
 * Fluxo:
 * 1. Se a rota tem @Public() => libera sempre.
 * 2. Se req.accountContext ausente => 401.
 * 3. Verifica last_session_revoked_at > token.iat => 401 (revogacao coarse-grained).
 *    Custo: 1 query por request. Cacheavel no Redis no futuro (Sprint 2).
 *
 * MFA: este guard NAO exige mfa=verified. Rotas sensiveis aplicam
 * @UseGuards(MfaGuard) alem deste (Sprint 2 - sem rotas sensiveis ainda).
 *
 * IMPORTANTE sobre DI: registrado como APP_GUARD via useFactory injeta
 * `UsersRepository` corretamente. Singleton estatico do Reflector continua
 * valido (stateless e global).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private static readonly reflector = new Reflector();

  constructor(private readonly users: UsersRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = AuthGuard.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      accountContext: { accountId: string; userId: string; issuedAt: number } | null;
      correlationId: string;
    }>();
    if (req.accountContext == null) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        correlationId: req.correlationId,
      });
    }

    // Coarse-grained revocation check: se o user teve sessoes revogadas
    // apos a emissao deste token, rejeita. Custo: 1 query por request.
    // Cacheavel no Redis no futuro (Sprint 2).
    const revokedAt = await this.users.getRevocationTimestamp(
      req.accountContext.accountId,
      req.accountContext.userId,
    );
    if (revokedAt != null) {
      // Em milissegundos para comparar com iat (que jose emite em segundos)
      const revokedAtMs = revokedAt.getTime();
      const issuedAtMs = req.accountContext.issuedAt * 1000;
      if (issuedAtMs < revokedAtMs) {
        throw new UnauthorizedException({
          message: 'Session revoked',
          correlationId: req.correlationId,
        });
      }
    }

    return true;
  }
}
