import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Injeta o correlationId da request (UUID v4 ou valor do header x-correlation-id).
 * Util em controllers que logam operacoes manuais (ex: POST /accounts).
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().correlationId;
  },
);
