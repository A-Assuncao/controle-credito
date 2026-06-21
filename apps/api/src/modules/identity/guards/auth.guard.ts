import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';

/**
 * Guard global (registrado como APP_GUARD no app.module.ts).
 *
 * Fluxo:
 * 1. Se a rota tem @Public() => libera sempre.
 * 2. Se req.accountContext esta' populado (middleware validou JWT) => libera.
 * 3. Caso contrario => 401 com correlationId no body (AllExceptionsFilter completa).
 *
 * NAO verifica last_session_revoked_at nesta task - a 6b adiciona o check
 * coarse-grained quando criar o UsersRepository.
 *
 * IMPORTANTE: o Reflector vem de um singleton estatico da classe em vez de
 * injetado via construtor. Razao: quando registrado como APP_GUARD com
 * `useClass`, o Nest nao chama o constructor com DI - instancia a classe
 * diretamente, e o `private readonly reflector` fica undefined no runtime.
 * O Reflector eh stateless e globalmente compartilhado, entao usa-lo como
 * singleton da classe eh seguro.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private static readonly reflector = new Reflector();

  canActivate(context: ExecutionContext): boolean {
    const isPublic = AuthGuard.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    if (req.accountContext != null) return true;

    throw new UnauthorizedException({
      message: 'Authentication required',
      correlationId: req.correlationId,
    });
  }
}
