import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Injeta o accountId da request (string UUID). O caller precisa ter passado
 * pelo AccountContextMiddleware + AuthGuard.
 *
 * Uso:
 *   @Get('me')
 *   me(@CurrentAccount() accountId: string) { ... }
 */
export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const account = req.accountContext as { accountId: string } | null;
    if (account == null) {
      // Nao deveria acontecer se o AuthGuard global estiver ativo, mas falhamos
      // com mensagem clara em vez de devolver undefined silencioso.
      throw new Error(
        'CurrentAccount usado em rota sem accountContext - faltou @Public ou AuthGuard?',
      );
    }
    return account.accountId;
  },
);
