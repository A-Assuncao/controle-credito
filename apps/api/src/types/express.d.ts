/**
 * Augmentacao do tipo Express.Request com os campos injetados pelo
 * AccountContextMiddleware. Sem isso, `req.accountContext` e `req.correlationId`
 * nao passam no typecheck (strict + noUncheckedIndexedAccess).
 *
 * Regra arquitetural: somente o AccountContextMiddleware escreve nesses campos.
 * Leitura via decorators (@CurrentAccount, @CurrentUser, @CorrelationId) ou
 * direto em services/guards com o tipo ja narrow-ado.
 */
import type { AccountContextPayload } from '../modules/account-context/account-context.types.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Populado pelo AccountContextMiddleware a partir do JWT.
       * `null` quando a rota e' @Public() OU o token esta ausente/invalido
       * (o AuthGuard global decide se 401 com base nisso).
       */
      accountContext: AccountContextPayload | null;

      /**
       * UUID v4 gerado por request (ou lido do header x-correlation-id).
       * Propagado para a resposta em x-correlation-id e usado em logs
       * e na tabela audit_log.
       */
      correlationId: string;
    }
  }
}

export {};
