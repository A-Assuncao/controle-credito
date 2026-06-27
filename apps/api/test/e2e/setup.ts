import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { pool, redis, withSystemContext, withAccountContext } from '@controle-credito/infra';
import argon2 from 'argon2';
import { generateSync as generateTotp } from 'otplib';
import { randomUUID } from 'node:crypto';

/**
 * Helper compartilhado pelos testes e2e.
 *
 * - bootstrap(): cria um Nest app real apontando para controle_credito_test.
 *   NAO chama app.listen() - usa supertest com app.getHttpServer().
 * - seedAccountUser(): cria account+user com email/senha conhecidos e retorna IDs.
 * - truncate(): limpa tabelas entre testes (CASCADE porque audit_log.account_id NAO
 *   tem FK para accounts, entao RESTART IDENTITY eh necessario para zerar bigserial).
 */

let app: INestApplication | null = null;

export async function bootstrap(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const a = moduleRef.createNestApplication();
  await a.init();
  app = a;
  return a;
}

export async function teardown(): Promise<void> {
  if (app != null) {
    await app.close();
    app = null;
  }
  await pool.end();
  await redis.quit();
}

export async function truncate(): Promise<void> {
  // Ordem: audit primeiro (sem FK), depois parties (FK para accounts), depois
  // users, depois accounts. RESTART IDENTITY zera o bigserial de audit_log.
  // Limpa tambem o Redis (refresh tokens) para isolar testes.
  await pool.query('TRUNCATE TABLE audit_log, parties, users, accounts RESTART IDENTITY CASCADE');
  await redis.flushdb();
}

export interface SeededUser {
  accountId: string;
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Cria account+user com argon2 hash. Retorna os IDs + tokens (login automatico
 * para conveniencia). Use quando o teste precisa de um user logado.
 */
export async function seedAccountUser(opts?: {
  email?: string;
  password?: string;
  fullName?: string;
}): Promise<SeededUser> {
  const email = opts?.email ?? `test-${randomUUID().slice(0, 8)}@example.com`;
  const password = opts?.password ?? 'TestPassword123!';
  const fullName = opts?.fullName ?? 'Test User';

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  // Insert via withSystemContext (pool separado, role app_system com BYPASSRLS).
  // Como eh um INSERT cross-tenant (criando account+user novos), o systemPool
  // e' o caminho correto. Em prod isso sera chamado por um endpoint POST /auth/signup.
  const row = await withSystemContext(async (client) => {
    const r = await client.query<{ account_id: string; user_id: string }>(
      `WITH new_acc AS (INSERT INTO accounts (status) VALUES ('active') RETURNING id)
       INSERT INTO users (account_id, email, full_name, phone_encrypted, password_hash)
       SELECT id, $1, $2, 'placeholder', $3 FROM new_acc
       RETURNING account_id, id AS user_id`,
      [email, fullName, passwordHash],
    );
    return r.rows[0];
  });
  if (row == null) throw new Error('seedAccountUser: failed to insert');

  // Faz login automatico para retornar tokens. Usamos o app criado no bootstrap.
  if (app == null) throw new Error('seedAccountUser: app not initialized');
  // supertest import lazy para evitar ciclo
  const request = (await import('supertest')).default;
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    accountId: row.account_id,
    userId: row.user_id,
    email,
    password,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

/**
 * Helper para requests autenticados com supertest.
 */
export async function authedGet(
  appRef: INestApplication,
  path: string,
  token: string,
): Promise<ReturnType<typeof import('supertest')>> {
  const request = (await import('supertest')).default;
  return request(appRef.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
}

export async function authedPatch(
  appRef: INestApplication,
  path: string,
  token: string,
  body: unknown,
): Promise<ReturnType<typeof import('supertest')>> {
  const request = (await import('supertest')).default;
  return request(appRef.getHttpServer())
    .patch(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

export async function authedPost(
  appRef: INestApplication,
  path: string,
  token: string,
  body: unknown,
): Promise<ReturnType<typeof import('supertest')>> {
  const request = (await import('supertest')).default;
  return request(appRef.getHttpServer())
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

export { pool, withAccountContext };

/**
 * Habilita MFA no user (chama /auth/mfa/setup que gera o secret) e em
 * seguida verifica com o codigo TOTP gerado a partir do secret descriptografado.
 * Devolve um novo par de tokens com mfaStatus=verified.
 *
 * O secret eh gerado pelo /auth/mfa/setup e armazenado encriptado no DB.
 * Aqui descriptografamos (mesmo algoritmo do MfaService.decrypt: AES-256-GCM
 * com chave derivada via scrypt de JWT_SECRET) para gerar o codigo TOTP
 * em tempo real e completar o verify.
 *
 * Uso:
 *   const { accessToken } = await enableMfaAndVerify(app, seeded);
 *   // agora o token tem mfaStatus=verified
 */
export async function enableMfaAndVerify(
  appRef: INestApplication,
  seeded: SeededUser,
): Promise<{ accessToken: string; refreshToken: string }> {
  // 1. POST /auth/mfa/setup com o accessToken atual -> gera secret + persist
  const setupRes = await authedPost(appRef, '/auth/mfa/setup', seeded.accessToken, {});
  if (setupRes.status !== 200) {
    throw new Error(`mfa setup failed: ${setupRes.status} ${JSON.stringify(setupRes.body)}`);
  }
  // setupRes.body pode ser string (superjson-style) ou objeto - normalize.
  const setupBody = typeof setupRes.body === 'string' ? JSON.parse(setupRes.body) : setupRes.body;
  const { secret } = setupBody as { secret: string };
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error(
      `mfa setup returned invalid secret. body=${JSON.stringify(setupBody)} status=${setupRes.status}`,
    );
  }

  // 2. Gera codigo TOTP atual a partir do secret
  const code = generateTotp({ secret });
  if (typeof code !== 'string') {
    throw new Error(`generateTotp returned non-string: ${typeof code} ${code}`);
  }

  // 3. POST /auth/mfa/verify com o codigo -> emite tokens com mfa=verified
  const verifyRes = await authedPost(appRef, '/auth/mfa/verify', seeded.accessToken, {
    code: code,
  });
  if (verifyRes.status !== 200) {
    throw new Error(`mfa verify failed: ${verifyRes.status} ${JSON.stringify(verifyRes.body)}`);
  }
  return {
    accessToken: verifyRes.body.accessToken,
    refreshToken: verifyRes.body.refreshToken,
  };
}
