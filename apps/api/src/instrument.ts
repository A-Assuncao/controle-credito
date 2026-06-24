/**
 * Sentry initialization para o NestJS API.
 *
 * Este arquivo eh' importado PRIMEIRO em main.ts (antes de qualquer outro
 * import) pra garantir que o SDK captura erros durante o bootstrap.
 *
 * Se SENTRY_DSN nao estiver setado, Sentry fica noop (sem rede, sem I/O).
 * Isso permite dev/CI sem precisar de um projeto Sentry real.
 *
 * Por que sendDefaultPii: false:
 * - LGPD: nao enviar IP, user agent, cookies por padrao.
 * - Decisao consciente: se o usuario quiser PII, seta via env custom
 *   ou via SentryDashboard (allowlist de campos).
 */
import * as Sentry from '@sentry/nestjs';
import { env, logger } from '@controle-credito/infra';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
  });
  logger.info(
    { environment: env.SENTRY_ENVIRONMENT, tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE },
    'Sentry initialized',
  );
} else {
  logger.debug('Sentry disabled (no SENTRY_DSN)');
}
