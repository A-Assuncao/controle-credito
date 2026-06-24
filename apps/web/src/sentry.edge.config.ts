/**
 * Sentry initialization para Edge runtime (proxy.ts, middleware).
 *
 * Carregado por src/instrumentation.ts quando NEXT_RUNTIME === 'edge'.
 * Config minimo - Edge runtime nao suporta todas as integracoes.
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
