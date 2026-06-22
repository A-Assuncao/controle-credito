import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@controle-credito/infra';

/**
 * HTTP request logger. Roda em todas as requests (APP-level).
 *
 * Loga em nivel `info` no fim de cada request:
 *   { method, path, status, durationMs, correlationId, userId? }
 *
 * O correlationId vem do AccountContextMiddleware (gerado ou lido do header
 * x-correlation-id). userId vem do req.accountContext (null em rotas publicas).
 *
 * Falhas nao sao logadas aqui - o AllExceptionsFilter cuida disso com
 * stacktrace completo. Manter os dois separados evita duplicacao.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const correlationId = req.correlationId;

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs) / 1_000_000;
      const accountContext = req.accountContext;
      logger.info(
        {
          event: 'http.request',
          correlationId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          userId: accountContext?.userId,
          accountId: accountContext?.accountId,
          contentLength: res.getHeader('content-length') as number | undefined,
        },
        'request completed',
      );
    });

    next();
  }
}
