import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { bootstrap, teardown, truncate, seedAccountUser, authedGet, authedPost } from './setup.js';

/**
 * Suite e2e de parties (EXE-002.3b Sprint 3).
 *
 * Cobre:
 *  - POST /parties happy path + validacao
 *  - GET  /parties com filtros e paginacao
 *  - Isolamento cross-account via RLS
 *  - Auth: 401 sem token
 *  - Validacao Zod: 422 com payload invalido
 */
describe('Parties e2e', () => {
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

  // -------- POST /parties --------

  it('POST /parties sem auth retorna 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer()).post('/parties').send({ name: 'Maria' });
    expect(res.status).toBe(401);
  });

  it('POST /parties cria tomador e retorna 201 com o recurso', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPost(app, '/parties', seeded.accessToken, {
      name: 'Maria Silva',
      document: '123.456.789-00',
      email: 'maria@example.com',
      phone: '11999998888',
      notes: 'Cliente desde 2020',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.name).toBe('Maria Silva');
    expect(res.body.document).toBe('123.456.789-00');
    expect(res.body.email).toBe('maria@example.com');
    expect(res.body.phone).toBe('11999998888');
    expect(res.body.notes).toBe('Cliente desde 2020');
    expect(res.body.status).toBe('active');
    expect(typeof res.body.createdAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('POST /parties aceita apenas name obrigatorio (demais campos opcionais)', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPost(app, '/parties', seeded.accessToken, { name: 'Joao' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Joao');
    expect(res.body.document).toBeNull();
    expect(res.body.email).toBeNull();
    expect(res.body.phone).toBeNull();
    expect(res.body.notes).toBeNull();
  });

  it('POST /parties com payload invalido retorna 422 com issues', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPost(app, '/parties', seeded.accessToken, {
      // name vazio (min 1)
      name: '',
      email: 'nao-eh-email',
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /parties com campo extra eh descartado (zod strip)', async () => {
    const seeded = await seedAccountUser();
    const res = await authedPost(app, '/parties', seeded.accessToken, {
      name: 'Ana',
      hackerField: 'pwned',
    });
    // Zod default = strip (campos extras descartados, nao rejeitados).
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ana');
    expect(res.body.hackerField).toBeUndefined();
  });

  // -------- GET /parties --------

  it('GET /parties sem auth retorna 401', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app.getHttpServer()).get('/parties');
    expect(res.status).toBe(401);
  });

  it('GET /parties sem tomadores retorna []', async () => {
    const seeded = await seedAccountUser();
    const res = await authedGet(app, '/parties', seeded.accessToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /parties retorna tomadores do proprio account, ordenados por nome', async () => {
    const seeded = await seedAccountUser();
    // Cria 3 tomadores em ordem nao-alfabetica
    await authedPost(app, '/parties', seeded.accessToken, { name: 'Carlos' });
    await authedPost(app, '/parties', seeded.accessToken, { name: 'Ana' });
    await authedPost(app, '/parties', seeded.accessToken, { name: 'Bruno' });

    const res = await authedGet(app, '/parties', seeded.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Ana', 'Bruno', 'Carlos']);
  });

  it('GET /parties?search=An filtra por prefixo case-insensitive', async () => {
    const seeded = await seedAccountUser();
    await authedPost(app, '/parties', seeded.accessToken, { name: 'Ana' });
    await authedPost(app, '/parties', seeded.accessToken, { name: 'Anita' });
    await authedPost(app, '/parties', seeded.accessToken, { name: 'Bruno' });

    const res = await authedGet(app, '/parties?search=An', seeded.accessToken);
    expect(res.status).toBe(200);
    const names = res.body.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(['Ana', 'Anita']);
  });

  it('GET /parties?status=blocked filtra por status', async () => {
    const seeded = await seedAccountUser();
    // Cria 2 ativos. Bloqueia o segundo via UPDATE direto (sem endpoint de update ainda).
    const created1 = await authedPost(app, '/parties', seeded.accessToken, { name: 'Ativo 1' });
    const created2 = await authedPost(app, '/parties', seeded.accessToken, { name: 'Ativo 2' });
    const { pool } = await import('@controle-credito/infra');
    await pool.query("UPDATE parties SET status = 'blocked' WHERE id = $1 AND account_id = $2", [
      created2.body.id,
      seeded.accountId,
    ]);

    const res = await authedGet(app, '/parties?status=blocked', seeded.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(created2.body.id);
    expect(created1.body.id).toBeTruthy();
  });

  it('GET /parties?limit=2&offset=0 pagina resultados', async () => {
    const seeded = await seedAccountUser();
    for (const n of ['A', 'B', 'C', 'D', 'E']) {
      await authedPost(app, '/parties', seeded.accessToken, { name: n });
    }

    const page1 = await authedGet(app, '/parties?limit=2&offset=0', seeded.accessToken);
    const page2 = await authedGet(app, '/parties?limit=2&offset=2', seeded.accessToken);
    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.map((p: { name: string }) => p.name)).toEqual(['A', 'B']);
    expect(page2.body.map((p: { name: string }) => p.name)).toEqual(['C', 'D']);
  });

  // -------- Isolamento cross-account (RLS) --------

  it('GET /parties so retorna tomadores do proprio account (isolamento RLS)', async () => {
    const alice = await seedAccountUser();
    const bob = await seedAccountUser();

    await authedPost(app, '/parties', alice.accessToken, { name: 'Tomador da Alice' });
    await authedPost(app, '/parties', bob.accessToken, { name: 'Tomador do Bob' });

    const aliceList = await authedGet(app, '/parties', alice.accessToken);
    const bobList = await authedGet(app, '/parties', bob.accessToken);
    expect(aliceList.status).toBe(200);
    expect(bobList.status).toBe(200);
    expect(aliceList.body.length).toBe(1);
    expect(bobList.body.length).toBe(1);
    expect(aliceList.body[0].name).toBe('Tomador da Alice');
    expect(bobList.body[0].name).toBe('Tomador do Bob');
  });

  // -------- Auditoria (via AuditLoggerInterceptor global) --------

  it('POST /parties gera entry no audit_log com action correta', async () => {
    const seeded = await seedAccountUser();
    const created = await authedPost(app, '/parties', seeded.accessToken, { name: 'Auditado' });
    expect(created.status).toBe(201);

    // Aguarda o tap do interceptor concluir (fire-and-forget). Pequeno sleep
    // eh' suficiente para o INSERT no audit_log rodar.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const audit = await authedGet(app, '/accounts/me/audit', seeded.accessToken);
    expect(audit.status).toBe(200);
    const postEntry = audit.body.items.find(
      (item: { action: string }) => item.action === 'POST /parties',
    );
    expect(postEntry).toBeTruthy();
    expect(postEntry.accountId).toBe(seeded.accountId);
  });
});
