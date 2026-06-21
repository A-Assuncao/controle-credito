import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Injeta o userId da request (string UUID). O caller precisa ter passado
 * pelo AccountContextMiddleware + AuthGuard.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const account = req.accountContext as { userId: string } | null;
  if (account == null) {
    throw new Error('CurrentUser usado em rota sem accountContext - faltou @Public ou AuthGuard?');
  }
  return account.userId;
});
