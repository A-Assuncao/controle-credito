#!/usr/bin/env node
/**
 * Wrapper cross-platform para rodar a suite e2e.
 * Define as envs de test DB e chama vitest.
 *
 * IMPORTANTE: as env vars sao setadas no process.env ANTES do env.ts do
 * infra ser importado (o que acontece no test). Como `dotenv` em
 * `packages/infra/src/env.ts` ja' parseou `process.env`, sobreescrever
 * depois nao adianta. Solucao: spawnar vitest com envs JA' no env.
 *
 * Uso: pnpm --filter @controle-credito/api test:e2e
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TEST_DB = 'postgres://app:app@localhost:5432/controle_credito_test';
const TEST_DB_SYSTEM = 'postgres://app_system:app_system@localhost:5432/controle_credito_test';

// Sobrescreve mesmo que dotenv ja tenha parseado (vale para o child process).
const env = {
  ...process.env,
  DATABASE_URL: TEST_DB,
  DATABASE_URL_TEST: TEST_DB,
  DATABASE_URL_SYSTEM: TEST_DB_SYSTEM,
};

const child = spawn('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.e2e.ts'], {
  stdio: 'inherit',
  env,
  cwd: here,
  shell: true,
});

console.log('[run-e2e] spawning vitest with env:');
console.log('  DATABASE_URL:', env.DATABASE_URL);
console.log('  DATABASE_URL_SYSTEM:', env.DATABASE_URL_SYSTEM);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
