import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountsRepository, type AccountRow } from './accounts.repository.js';
import { UsersRepository, type UserRow } from '../identity/users/users.repository.js';
import type { MeResponse, UpdateAccount } from '@controle-credito/contracts';

@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly users: UsersRepository,
  ) {}

  /**
   * GET /accounts/me. Combina dados da account e do user em uma unica resposta.
   * Roda dentro do account_id do request - RLS garante isolamento cross-tenant.
   */
  async getMe(accountId: string, userId: string): Promise<MeResponse> {
    const [account, user] = await Promise.all([
      this.accounts.findByIdOrThrow(accountId).catch(() => {
        throw new NotFoundException('account not found');
      }),
      this.users.findByIdOrThrow(accountId, userId).catch(() => {
        throw new NotFoundException('user not found in this account');
      }),
    ]);
    return this.toMeResponse(account, user);
  }

  /**
   * PATCH /accounts/me. Aplica mudancas atomicas:
   *  - fullName -> users
   *  - settings -> accounts.settings
   * Se nenhum campo for enviado, retorna estado atual (idempotente).
   */
  async updateMe(accountId: string, userId: string, patch: UpdateAccount): Promise<MeResponse> {
    if (patch.fullName !== undefined) {
      await this.users.updateProfile(accountId, userId, patch.fullName);
    }
    if (patch.settings !== undefined) {
      await this.accounts.updateSettings(accountId, patch.settings);
    }
    return this.getMe(accountId, userId);
  }

  private toMeResponse(account: AccountRow, user: UserRow): MeResponse {
    return {
      account: {
        id: account.id,
        status: account.status,
        settings: account.settings,
        createdAt: account.created_at.toISOString(),
        updatedAt: account.updated_at.toISOString(),
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        mfaEnabled: user.mfa_enabled,
        lastLoginAt: user.last_login_at ? user.last_login_at.toISOString() : null,
      },
    };
  }
}
