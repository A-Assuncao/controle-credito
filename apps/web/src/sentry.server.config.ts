/**
 * Sentry initialization para server-side (SSR, API routes).
 *
 * Carregado por src/instrumentation.ts quando NEXT_RUNTIME === 'nodejs'.
 * Reutiliza o mesmo DSN publico do client (NEXT_PUBLIC_SENTRY_DSN)
 * para simplificar a configuracao - DSN nao contem segredo, eh'
 * apenas a URL de ingest.
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
