/**
 * Migration runner - SQL puro, idempotente.
 *
 * Aplicacoes:
 *   pnpm tsx db/scripts/migrate.ts          # usa DATABASE_URL do .env
 *   DATABASE_URL=postgres://... pnpm tsx db/scripts/migrate.ts
 *
 * Comportamento:
 *   - Cria tabela __migrations__ se nao existir.
 *   - Lista arquivos db/migrations/*.sql em ordem alfabetica.
 *   - Para cada um: se ja aplicado, pula. Caso contrario, executa
 *     em transacao e registra em __migrations__.
 *   - Falha em qualquer erro, rollback automatico (a transacao).
 *
 * Sem deps externas alem de `pg` (ja vem via @controle-credito/infra).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import pg from 'pg';

// Carrega .env se existir (sem dependencia de dotenv aqui)
try {
  const envPath = resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
} catch {
  // .env nao existe - usa process.env como esta
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL nao definido.');
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '..', 'migrations');

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __migrations__ (
        id          SERIAL    PRIMARY KEY,
        filename    TEXT      NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        checksum    TEXT      NOT NULL
      );
    `);

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.warn('Nenhuma migration encontrada em', migrationsDir);
      return;
    }

    const { rows: applied } = await client.query<{ filename: string }>(
      'SELECT filename FROM __migrations__',
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      if (appliedSet.has(filename)) {
        console.info(`[skip]   ${filename}`);
        skippedCount++;
        continue;
      }

      const sql = readFileSync(join(migrationsDir, filename), 'utf8');
      const checksum = hash(sql);

      console.info(`[apply]  ${filename}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO __migrations__ (filename, checksum) VALUES ($1, $2)', [
          filename,
          checksum,
        ]);
        await client.query('COMMIT');
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[fail]   ${filename}: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    console.info(
      `\nOK: ${appliedCount} aplicada(s), ${skippedCount} pulada(s), total ${files.length}.`,
    );
  } finally {
    await client.end();
  }
}

function hash(input: string): string {
  // Hash determinístico simples para detectar drift manual
  // (nao e seguranca, e' fingerprint). Usa FNV-1a 32-bit em hex.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

main().catch((err) => {
  console.error('ERRO fatal:', err);
  process.exit(1);
});
