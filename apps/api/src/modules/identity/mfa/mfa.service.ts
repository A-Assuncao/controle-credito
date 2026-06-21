import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '@controle-credito/infra';
import { UsersRepository } from '../users/users.repository.js';
import { TokenService } from '../token/token.service.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';

/**
 * MFA com TOTP (RFC 6238) usando otplib.
 *
 * otplib v13 mudou para API funcional: `generateSecret()`, `verify({token, secret})`,
 * `generateURI({...})`. Janela padrao eh +/- 1 step (30s cada).
 *
 * Fluxo:
 *   1. setup(): gera secret base32, salva encrypted no DB, devolve otpauthUrl.
 *   2. verify(): valida codigo de 6 digitos, emite tokens com mfa=verified.
 *   3. login() (no AuthService): se user.mfa_enabled, emite token com
 *      mfaStatus='pending'. Rotas sensiveis (futuro) usam MfaGuard.
 *
 * Segredos TOTP sao criptografados em repouso (AES-256-GCM) usando
 * JWT_SECRET como entrada para scrypt. NAO use plaintext no DB.
 */
@Injectable()
export class MfaService {
  private static readonly ENCRYPTION_ALGO = 'aes-256-gcm';
  private static readonly SCRYPT_KEY_LEN = 32;
  private static readonly SCRYPT_SALT = 'controle-credito:mfa:v1';
  private static readonly ISSUER = 'controle-credito';

  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly refresh: RefreshTokenService,
  ) {}

  async setup(accountId: string, userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = generateSecret();
    const encrypted = this.encrypt(secret);
    await this.users.enableMfa(accountId, userId, encrypted);
    const otpauthUrl = generateURI({ issuer: MfaService.ISSUER, label: userId, secret });
    return { secret, otpauthUrl };
  }

  async verifyAndElevate(
    accountId: string,
    userId: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const user = await this.users.findByIdOrThrow(accountId, userId);
    if (!user.mfa_enabled || user.mfa_secret_encrypted == null) {
      throw new BadRequestException({ message: 'MFA not enabled' });
    }
    const secret = this.decrypt(user.mfa_secret_encrypted);
    const result = verifySync({ token: code, secret });
    if (!result.valid) throw new UnauthorizedException({ message: 'Invalid TOTP code' });

    await this.refresh.revoke(userId);
    const accessToken = await this.tokens.sign({
      sub: userId,
      account_id: accountId,
      mfa: 'verified',
    });
    const refreshToken = await this.refresh.issue(userId);
    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }

  async disable(accountId: string, userId: string, code: string): Promise<void> {
    const user = await this.users.findByIdOrThrow(accountId, userId);
    if (!user.mfa_enabled || user.mfa_secret_encrypted == null) {
      throw new BadRequestException({ message: 'MFA not enabled' });
    }
    const secret = this.decrypt(user.mfa_secret_encrypted);
    const result = verifySync({ token: code, secret });
    if (!result.valid) throw new UnauthorizedException({ message: 'Invalid TOTP code' });
    await this.users.disableMfa(accountId, userId);
  }

  private encrypt(plaintext: string): string {
    const key = this.deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(MfaService.ENCRYPTION_ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(encoded: string): string {
    const key = this.deriveKey();
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv(MfaService.ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  private deriveKey(): Buffer {
    return scryptSync(env.JWT_SECRET, MfaService.SCRYPT_SALT, MfaService.SCRYPT_KEY_LEN);
  }
}
