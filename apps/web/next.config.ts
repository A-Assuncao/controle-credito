import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Next.js config com integracao Sentry.
 *
 * withSentryConfig adiciona build-time features:
 * - Source map upload (se SENTRY_AUTH_TOKEN + ORG + PROJECT setados)
 * - Auto-instrumentation de paginas e API routes
 *
 * silent: !process.env.CI suprime logs do Sentry em build local
 * (em CI ele loga informacoes uteis sobre upload de source maps).
 *
 * Sem SENTRY_AUTH_TOKEN, o upload eh' silenciosamente pulado - o build
 * continua normalmente.
 *
 * output: 'standalone' gera .next/standalone/ com server.js +
 * node_modules production-only. Necessario pro Dockerfile do web
 * produzir imagem Docker pequena e auto-contida.
 */
const config: NextConfig = {
  transpilePackages: ['@controle-credito/contracts', '@controle-credito/ui'],
  output: 'standalone',
};

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suprime logs do Sentry em build local (CI loga normalmente).
  silent: !process.env.CI,
});
