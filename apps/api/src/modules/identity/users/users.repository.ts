import { Injectable } from '@nestjs/common';
import { withAccountContext, withSystemContext } from '@controle-credito/infra';

/**
 * Repositorio de usuarios. Toda query respeita o isolamento:
 * - operacoes de signup (criacao de account+user) usam withSystemContext
 *   (nao ha account_id ainda - eh literalmente o nascimento da account).
 * - leituras autenticadas usam withAccountContext (RLS policy filtra).
 *
 * NAO exponha password_hash nem mfa_secret_encrypted para fora - estes campos
 * sao usados apenas para verify.
 */
export interface UserRow {
  id: string;
  account_id: string;
  email: string;
  full_name: string;
  phone_encrypted: string;
  password_hash: string;
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
  status: 'active' | 'suspended' | 'canceled';
  last_login_at: Date | null;
  last_session_revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UsersRepository {
  /**
   * Cria account + user em uma unica transacao system-scoped.
   * Chamado apenas pelo fluxo de signup (task 6b) - NAO usar este metodo
   * em fluxo logado (criaria account nova a cada request).
   */
  async createUser(input: {
    email: string;
    fullName: string;
    phoneEncrypted: string;
    passwordHash: string;
  }): Promise<UserRow> {
    return withSystemContext(async (client) => {
      const acc = await client.query<{ id: string }>(
        `INSERT INTO accounts (status) VALUES ('active') RETURNING id`,
      );
      const accountId = acc.rows[0]?.id;
      if (accountId == null) throw new Error('failed to create account');

      const usr = await client.query<UserRow>(
        `INSERT INTO users (account_id, email, full_name, phone_encrypted, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [accountId, input.email, input.fullName, input.phoneEncrypted, input.passwordHash],
      );
      const user = usr.rows[0];
      if (user == null) throw new Error('failed to create user');
      return user;
    });
  }

  /**
   * Busca user por email. Sem account_id explicito - retorna qualquer user
   * com esse email. Por isso roda em system context: login precisa achar o
   * user em qualquer tenant, depois valida que a senha bate.
   *
   * Em prod, considerar indice unique global em email se virar requisito
   * de billing (vide comentario na migration 002).
   */
  async findByEmail(email: string): Promise<UserRow | null> {
    return withSystemContext(async (client) => {
      const r = await client.query<UserRow>(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [
        email,
      ]);
      return r.rows[0] ?? null;
    });
  }

  /**
   * Busca user por ID dentro do account_id corrente (RLS garante isolamento).
   * Lanca se nao encontrar (caller deve tratar).
   */
  async findByIdOrThrow(accountId: string, userId: string): Promise<UserRow> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<UserRow>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
      const row = r.rows[0];
      if (row == null) throw new Error(`user not found: ${userId}`);
      return row;
    });
  }

  /**
   * Busca user por ID em system context. Usado por endpoints que conhecem
   * o user_id (do JWT de refresh) mas NAO o account_id (porque o refresh
   * ainda nao foi validado quanto a RLS).
   *
   * NUNCA usar este metodo para queries tenant-scoped (leitura de dados
   * do user logado). Para isso, use findByIdOrThrow(accountId, userId).
   */
  async findByIdSystemContext(userId: string): Promise<UserRow | null> {
    return withSystemContext(async (client) => {
      const r = await client.query<UserRow>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
      return r.rows[0] ?? null;
    });
  }

  /**
   * Retorna apenas o `last_session_revoked_at` (campo leve, evita carregar
   * password_hash/MFA secret em cada request). Cacheavel no Redis no futuro.
   */
  async getRevocationTimestamp(accountId: string, userId: string): Promise<Date | null> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<{ last_session_revoked_at: Date | null }>(
        `SELECT last_session_revoked_at FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      return r.rows[0]?.last_session_revoked_at ?? null;
    });
  }

  async updateLastLogin(accountId: string, userId: string): Promise<void> {
    await withAccountContext(accountId, async (client) => {
      await client.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
    });
  }

  async updateLastSessionRevokedAt(accountId: string, userId: string): Promise<void> {
    await withAccountContext(accountId, async (client) => {
      await client.query(`UPDATE users SET last_session_revoked_at = now() WHERE id = $1`, [
        userId,
      ]);
    });
  }

  async enableMfa(accountId: string, userId: string, mfaSecretEncrypted: string): Promise<void> {
    await withAccountContext(accountId, async (client) => {
      await client.query(
        `UPDATE users SET mfa_enabled = true, mfa_secret_encrypted = $2 WHERE id = $1`,
        [userId, mfaSecretEncrypted],
      );
    });
  }

  async disableMfa(accountId: string, userId: string): Promise<void> {
    await withAccountContext(accountId, async (client) => {
      await client.query(
        `UPDATE users SET mfa_enabled = false, mfa_secret_encrypted = NULL WHERE id = $1`,
        [userId],
      );
    });
  }
}
