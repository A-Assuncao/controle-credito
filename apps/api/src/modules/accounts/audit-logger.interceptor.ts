import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { AuditLogRepository } from './audit.repository.js';

/**
 * Grava audit_log automaticamente para toda MUTACAO (POST/PUT/PATCH/DELETE).
 *
 * Regras:
 *  - SOMENTE mutacoes. GET/HEAD/OPTIONS nao geram audit (volume).
 *  - SOMENTE em sucesso (statusCode 2xx). Erros geram audit proprio (Sprint 2).
 *  - SOMENTE se accountContext esta presente (rotas publicas ficam de fora).
 *  - Roda DEPOIS do handler - se ele falhar, o catch global captura e o
 *    tap nao dispara (correto).
 *
 * Action = "<METHOD> <path>" (ex: "POST /auth/login"). O request body NAO
 * vai no metadata por risco de PII (password, tokens) - futuro: incluir
 * apenas resourceId conhecido (path param :id).
 *
 * Performance: 1 INSERT por mutacao. Em escala isso vira 100+ inserts/s
 * sem problema. Se virar gargalo, batch em Redis + flush async.
 */
@Injectable()
export class AuditLoggerInterceptor implements NestInterceptor {
  private static readonly MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(private readonly audit: AuditLogRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<
      Request & {
        accountContext: { accountId: string; userId: string } | null;
        correlationId: string;
      }
    >();

    if (!AuditLoggerInterceptor.MUTATION_METHODS.has(req.method)) {
      return next.handle();
    }
    const accountContext = req.accountContext;
    if (accountContext == null) {
      // Rotas publicas (login, refresh) NAO geram audit nesta task.
      // Adicionar /auth/login quando login passar a usar account context.
      return next.handle();
    }

    const action = `${req.method} ${req.route?.path ?? req.path}`;
    const resourceType = req.route?.path?.split('/')[1] ?? 'unknown';
    const resourceId = (req.params as Record<string, string> | undefined)?.['id'] ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          this.audit
            .insert(accountContext.accountId, {
              actorUserId: accountContext.userId,
              action,
              resourceType,
              resourceId,
              metadata: {
                statusCode: 200, // tap so' dispara em sucesso
                path: req.originalUrl ?? req.url,
              },
              correlationId: req.correlationId,
              ipAddress: req.ip ?? null,
              userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
            })
            .catch((err: unknown) => {
              Logger.error(
                `audit insert failed: ${err instanceof Error ? err.message : 'unknown'}`,
                'AuditLoggerInterceptor',
              );
            });
        },
      }),
    );
  }
}
