/**
 * Next.js 15+ instrumentation hook.
 *
 * Carregado pelo Next uma vez durante o startup de cada runtime
 * (nodejs, edge). Aqui decidimos qual sentry.*.config.ts importar.
 *
 * O export `onRequestError` eh' o gancho oficial do Next 15+ para
 * capturar erros de proxy.ts (middleware renomeado), server components,
 * route handlers e generateMetadata.
 *
 * Se nao houver NEXT_PUBLIC_SENTRY_DSN, os sentry.*.config.ts ficam
 * noop (init eh' condicional dentro de cada arquivo).
 */
import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
