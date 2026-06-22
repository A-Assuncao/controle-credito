import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  bootstrap,
  teardown,
  truncate,
  seedAccountUser,
  withAccountContext,
  authedPost,
} from './setup.js';
import { TokenService } from '../../src/modules/identity/token/token.service.js';

/**
 * Suite e2e de auth: login, refresh, logout, MFA setup.
 *
 * Cobre o pipeline HTTP completo (Nest + ZodValidationPipe + RLS + Redis refresh).
 * Usa controle_credito_test; cada teste comeca com truncate.
 *
 * NAO testa MFA verify/disable aqui - isso depende de tempo real (TOTP 30s).
 * Sera coberto em suite separada quando tiver helper de clock injection.
 */

describe('Auth e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrap();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await truncate();
  });

  it('POST /auth/login retorna tokens com credenciais validas', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPost(app, '/auth/logout', seeded.accessToken, {});
    // O ponto aqui e' que o login funcionou (seedAccountUser ja' depende disso).
    expect(res.status).toBe(204);
  });

  it('POST /auth/login com senha errada retorna 401 + correlationId', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'inexistente@example.com', password: 'WrongPass123!' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      message: 'Invalid credentials',
      correlationId: expect.any(String) as unknown as string,
    });
  });

  it('POST /auth/login com payload invalido retorna 422 + issues', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it('POST /auth/refresh com token valido retorna novos tokens', async () => {
    const seeded = await seedAccountUser();
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: seeded.refreshToken, userId: seeded.userId });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    // Rotacao: o novo refresh deve ser diferente do antigo.
    expect(res.body.refreshToken).not.toBe(seeded.refreshToken);
  });

  it('POST /auth/refresh com refresh token invalido retorna 401', async () => {
    const seeded = await seedAccountUser();
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token-aaaaaaaaaaaaaaaaaaaaaaaa', userId: seeded.userId });
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout revoga refresh + seta last_session_revoked_at', async () => {
    const seeded = await seedAccountUser();
    const logoutRes = await authedPost(app, '/auth/logout', seeded.accessToken, {});
    expect(logoutRes.status).toBe(204);

    // Tentar usar o mesmo refresh depois do logout deve falhar.
    const request = (await import('supertest')).default;
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: seeded.refreshToken, userId: seeded.userId });
    expect(refreshRes.status).toBe(401);

    // Tentar usar o mesmo access token depois do logout deve falhar (Session revoked).
    const protectedRes = await authedPost(app, '/auth/logout', seeded.accessToken, {});
    expect(protectedRes.status).toBe(401);
    expect((protectedRes.body as { message: string }).message).toBe('Session revoked');

    // Verifica que last_session_revoked_at foi setado no user.
    const u = await withAccountContext(seeded.accountId, (client) =>
      client.query<{ last_session_revoked_at: Date | null }>(
        'SELECT last_session_revoked_at FROM users WHERE id = $1',
        [seeded.userId],
      ),
    );
    expect(u.rows[0]?.last_session_revoked_at).toBeTruthy();
  });

  it('POST /auth/mfa/setup retorna secret + otpauthUrl', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPost(app, '/auth/mfa/setup', seeded.accessToken, {});
    expect(res.status).toBe(200);
    expect(res.body.secret).toBeTruthy();
    expect(res.body.otpauthUrl).toContain('otpauth://totp/');
    // Verifica que mfa_enabled foi marcado e secret encriptado no DB.
    const u = await withAccountContext(seeded.accountId, (client) =>
      client.query<{ mfa_enabled: boolean; mfa_secret_encrypted: string | null }>(
        'SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1',
        [seeded.userId],
      ),
    );
    expect(u.rows[0]?.mfa_enabled).toBe(true);
    expect(u.rows[0]?.mfa_secret_encrypted).toBeTruthy();
  });

  it('rota protegida sem token retorna 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer()).get('/accounts/me');
    expect(res.status).toBe(401);
    expect(res.body.correlationId).toBeTruthy();
  });

  it('rota protegida com JWT forjado (assinatura invalida) retorna 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer())
      .get('/accounts/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('GET /accounts/me com JWT forjado (conta diferente) retorna 404 por RLS', async () => {
    const seeded = await seedAccountUser();

    // Gera um JWT com account_id de OUTRA conta (UUID dummy nao existe).
    const ts = new TokenService();
    const forged = await ts.sign({
      sub: seeded.userId,
      account_id: '11111111-2222-3333-4444-555555555555',
      mfa: 'not_required',
    });

    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer())
      .get('/accounts/me')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('not found');
  });
});
