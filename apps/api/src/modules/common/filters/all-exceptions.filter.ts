import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '@controle-credito/infra';

/**
 * Filtro global de excecoes. Garante envelope consistente em todas as respostas
 * de erro:
 *
 *   { statusCode, message, correlationId, ...extras }
 *
 * - HttpException do Nest: repassa statusCode + body.
 * - Erro generico: 500 sem stacktrace no body (seguranca - nunca vaza stack pro client).
 *   Stack/erro completo vai pro log com correlationId para o operador correlacionar.
 *
 * Tambem propaga o correlationId no header `x-correlation-id` da resposta.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    // Defensive: req.correlationId pode ser undefined se a exception
    // ocorre ANTES do AccountContextMiddleware rodar (CORS preflight,
    // body parser, etc). Fallback para randomUUID() garante header
    // sempre valido + correlationId sempre presente na response.
    const correlationId = req.correlationId ?? randomUUID();

    // Garante header em toda resposta de erro (sucesso vem do middleware).
    res.setHeader('x-correlation-id', correlationId);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body = typeof raw === 'string' ? { message: raw } : raw;
      res.status(status).json({
        ...body,
        correlationId,
      });
      return;
    }

    // Erro nao-HttpException => 500.
    const err = exception as Error;
    logger.error({ err, correlationId, path: req.path, method: req.method }, 'unhandled exception');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      correlationId,
    });
  }
}
