import { Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { TokenService } from '../token/token.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { UsersRepository } from '../users/users.repository.js';

/**
 * Parametros do argon2id alinhados com OWASP 2024.
 * memoryCost em KiB - 19 MiB (19456) recomendado para uso geral.
 */
const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mfaRequired: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly refresh: RefreshTokenService,
  ) {}

  /**
   * Hash deterministico nao - argon2 gera salt aleatorio interno.
   * O hash comeca com $argon2id$ e contem o salt + parametros.
   */
  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTS);
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Login: recebe email+senha, busca user, valida hash, emite tokens.
   * Atualiza last_login_at e revoga refresh antigo (single-session enforcement
   * simplificado - cada login invalida o refresh anterior).
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.users.findByEmail(email);
    if (user == null) {
      // Hash dummy para nao vazar existencia do user por tempo de resposta.
      // argon2.verify contra hash invalido demora ~50ms, similar ao fluxo normal.
      await argon2.verify(
        '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXltY2RmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmY$ZHVtbXloYXNoZHVtbXloYXNoZHVtbXloYXNoZHVtbXk',
        password,
      );
      throw new UnauthorizedException({ message: 'Invalid credentials' });
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException({ message: 'Account not active' });
    }
    const ok = await this.verifyPassword(user.password_hash, password);
    if (!ok) throw new UnauthorizedException({ message: 'Invalid credentials' });

    // Revoga refresh anterior (single-session). Logout tambem usa revoke().
    await this.refresh.revoke(user.id);
    await this.users.updateLastLogin(user.account_id, user.id);

    return this.issueTokens({
      userId: user.id,
      accountId: user.account_id,
      mfaEnabled: user.mfa_enabled,
    });
  }

  /**
   * Refresh: valida refresh token, emite novo access (e rotaciona o refresh).
   * 401 se invalido/expirado/revogado.
   */
  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
    const valid = await this.refresh.validate(userId, refreshToken);
    if (!valid) throw new UnauthorizedException({ message: 'Invalid refresh token' });

    const user = await this.users.findByIdSystemContext(userId);
    if (user == null || user.status !== 'active') {
      throw new UnauthorizedException({ message: 'Invalid refresh token' });
    }

    // Rotacao: revoga o antigo, emite novo. Single-session enforcement.
    await this.refresh.revoke(userId);

    return this.issueTokens({
      userId: user.id,
      accountId: user.account_id,
      mfaEnabled: user.mfa_enabled,
    });
  }

  /**
   * Logout: revoga o refresh token. Access token continua valido ate exp (15 min)
   * - mitigado parcialmente por last_session_revoked_at (setado aqui).
   */
  async logout(userId: string, accountId: string): Promise<void> {
    await this.refresh.revoke(userId);
    await this.users.updateLastSessionRevokedAt(accountId, userId);
  }

  /**
   * Emite access + refresh tokens.
   * mfaStatus:
   *   - 'not_required' se user nao tem MFA habilitado
   *   - 'pending'      se user tem MFA mas nao verificou nesta sessao
   *   - 'verified'     se user verificou TOTP nesta sessao (parametro)
   */
  private async issueTokens(input: {
    userId: string;
    accountId: string;
    mfaEnabled: boolean;
    mfaStatus?: 'pending' | 'verified' | 'not_required';
  }): Promise<AuthTokens> {
    const mfaStatus: 'pending' | 'verified' | 'not_required' =
      input.mfaStatus ?? (input.mfaEnabled ? 'pending' : 'not_required');

    const accessToken = await this.tokens.sign({
      sub: input.userId,
      account_id: input.accountId,
      mfa: mfaStatus,
    });
    const refreshToken = await this.refresh.issue(input.userId);
    return { accessToken, refreshToken, expiresIn: 15 * 60, mfaRequired: input.mfaEnabled };
  }
}
