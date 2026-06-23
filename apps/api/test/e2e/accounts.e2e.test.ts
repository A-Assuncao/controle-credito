import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  bootstrap,
  teardown,
  truncate,
  seedAccountUser,
  enableMfaAndVerify,
  authedGet,
  authedPatch,
} from './setup.js';

/**
 * Suite e2e de accounts: GET/PATCH /accounts/me, isolamento cross-account,
 * enforcement de MfaGuard no PATCH.
 *
 * Cada teste que faz PATCH chama enableMfaAndVerify() antes para obter um
 * token com mfaStatus=verified (caso contrario o MfaGuard retorna 401).
 */
describe('Accounts e2e', () => {
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

  it('GET /accounts/me retorna account+user com fullName e settings defaults', async () => {
    const seeded = await seedAccountUser({ fullName: 'Nome Original' });
    const res = await authedGet(app, '/accounts/me', seeded.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(seeded.email);
    expect(res.body.user.fullName).toBe('Nome Original');
    expect(res.body.account.settings).toEqual({});
    expect(res.body.account.id).toBe(seeded.accountId);
  });

  it('PATCH /accounts/me sem MFA retorna 401 "MFA required"', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPatch(app, '/accounts/me', seeded.accessToken, {
      fullName: 'Nome Novo',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('MFA required');
  });

  it('PATCH /accounts/me com MFA atualiza fullName e settings', async () => {
    const seeded = await seedAccountUser();
    const mfa = await enableMfaAndVerify(app, seeded);
    const res = await authedPatch(app, '/accounts/me', mfa.accessToken, {
      fullName: 'Nome Novo',
      settings: { theme: 'light', currency: 'BRL' },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Nome Novo');
    expect(res.body.account.settings).toEqual({ theme: 'light', currency: 'BRL' });
  });

  it('PATCH /accounts/me com MFA idempotente (sem campos) retorna estado atual', async () => {
    const seeded = await seedAccountUser();
    const mfa = await enableMfaAndVerify(app, seeded);
    const res = await authedPatch(app, '/accounts/me', mfa.accessToken, {});
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(seeded.email);
  });

  it('PATCH /accounts/me com MFA e payload invalido retorna 422', async () => {
    const seeded = await seedAccountUser();
    const mfa = await enableMfaAndVerify(app, seeded);
    const res = await authedPatch(app, '/accounts/me', mfa.accessToken, {
      email: 'hacker@example.com', // campo nao permitido
    });
    // ZodValidationPipe rejeita (strict schema).
    expect(res.status).toBe(422);
  });

  it('GET /accounts/me/audit retorna apenas entries do proprio account', async () => {
    const seeded = await seedAccountUser();
    const mfa = await enableMfaAndVerify(app, seeded);
    // Gera uma entry fazendo PATCH.
    await authedPatch(app, '/accounts/me', mfa.accessToken, { settings: { x: 1 } });
    await authedPatch(app, '/accounts/me', mfa.accessToken, { settings: { x: 2 } });

    const res = await authedGet(app, '/accounts/me/audit', seeded.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    for (const item of res.body.items) {
      expect(item.accountId).toBe(seeded.accountId);
    }
  });
});
