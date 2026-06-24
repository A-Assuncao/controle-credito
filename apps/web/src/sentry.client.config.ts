/**
 * Sentry initialization para o browser (client-side).
 *
 * Carregado automaticamente pelo Next.js via src/instrumentation.ts
 * durante o build do client bundle.
 *
 * Se NEXT_PUBLIC_SENTRY_DSN nao estiver setado, Sentry fica noop.
 *
 * Por que sendDefaultPii: false:
 * - LGPD: nao enviar cookies/IP/UA por padrao. O DSN do Sentry
 *   eh' publico, mas o conteudo do report deve ser controlado.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const tracesSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate,
    sendDefaultPii: false,
  });
}
