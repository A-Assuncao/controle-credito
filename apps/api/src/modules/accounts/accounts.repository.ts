import { Injectable } from '@nestjs/common';
import { withAccountContext } from '@controle-credito/infra';

export interface AccountRow {
  id: string;
  status: 'active' | 'suspended' | 'canceled';
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AccountsRepository {
  /**
   * Busca account pelo id dentro do contexto RLS corrente. RLS ja' filtra
   * o acesso (account_id = current_setting('app.account_id')).
   */
  async findByIdOrThrow(accountId: string): Promise<AccountRow> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<AccountRow>(`SELECT * FROM accounts WHERE id = $1 LIMIT 1`, [
        accountId,
      ]);
      const row = r.rows[0];
      if (row == null) throw new Error(`account not found: ${accountId}`);
      return row;
    });
  }

  /**
   * Atualiza apenas settings (jsonb livre). Substitui o objeto inteiro -
   * para merge granular, fazer PATCH com sub-objeto no client.
   */
  async updateSettings(accountId: string, settings: Record<string, unknown>): Promise<AccountRow> {
    return withAccountContext(accountId, async (client) => {
      const r = await client.query<AccountRow>(
        `UPDATE accounts SET settings = $2::jsonb WHERE id = $1 RETURNING *`,
        [accountId, JSON.stringify(settings)],
      );
      const row = r.rows[0];
      if (row == null) throw new Error(`account not found: ${accountId}`);
      return row;
    });
  }
}
