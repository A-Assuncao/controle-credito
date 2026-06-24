/**
 * IMPORTANTE: instrument.ts deve ser importado PRIMEIRO para que o
 * SDK do Sentry consiga capturar erros durante o bootstrap do Nest.
 * Sem isso, exceptions em modulos init ou no listen() nao seriam
 * reportados.
 */
import './instrument.js';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { env, logger } from '@controle-credito/infra';
import { AppModule } from './app.module.js';

/**
 * Bootstrap NestJS.
 *
 * - cookieParser(): habilita req.cookies (usado pelo AccountContextMiddleware).
 *   Como apps/web e apps/api estao em origens diferentes em prod (web=3000,
 *   api=3001), o cookie nao e' first-party - o front precisa enviar com
 *   credentials: true no fetch + SameSite=Lax.
 * - enableCors: origin explicito (env.NEXTAUTH_URL). credentials: true
 *   para o cookie cc_session chegar.
 * - Sem ValidationPipe global: o projeto usa ZodValidationPipe por rota.
 *
 * Em dev (Windows), o .env e' carregado por `dotenv/config` dentro do
 * packages/infra/src/env.ts. Como o cwd do `pnpm --filter ... dev` e'
 * apps/api/, dotenv procura apps/api/.env (nao existe) - workaround
 * futuro: node --env-file=../../.env. Nesta task, validamos via smoke
 * com `pnpm dev` da raiz (turbo preserva o cwd raiz).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.use(cookieParser());

  // CORS: aceita lista hardcoded de origens alem de env.NEXTAUTH_URL.
  //
  // Por que hardcoded: as URLs do Vercel/Render deste SaaS sao conhecidas
  // e imutaveis (single-tenant). Adicionar env var CORS_ORIGINS seria
  // overkill - mais uma coisa pra documentar e esquecer.
  //
  // env.NEXTAUTH_URL continua sendo a URL do FRONTEND (Vercel) - usado
  // em recovery.service.ts para construir link de reset. Aqui entra
  // tambem na lista de origens via spread, garantindo que front
  // e back concordam na URL canonica.
  //
  // Function-based origin: NestJS CORS permite decidir por request.
  // Se origin nao veio (same-origin, server-to-server, curl) -> permite.
  const allowedOrigins = [
    env.NEXTAUTH_URL,
    'https://controle-credito.onrender.com', // API em prod (caso alguem chame direto)
    'https://controle-credito.vercel.app', // Vercel production alias
    'http://localhost:3000', // dev local (apps/web)
  ];
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS: origin not allowed');
        callback(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
  });

  await app.listen(env.PORT_API);

  logger.info(
    {
      port: env.PORT_API,
      env: env.NODE_ENV,
      corsOrigin: env.NEXTAUTH_URL,
      allowedOrigins,
    },
    'API listening',
  );
}

bootstrap().catch((err: unknown) => {
  logger.fatal({ err }, 'bootstrap failed');
  process.exit(1);
});
