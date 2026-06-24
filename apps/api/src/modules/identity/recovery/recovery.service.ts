import { Injectable, BadRequestException } from '@nestjs/common';
import argon2 from 'argon2';
import {
  emailService,
  generateRecoveryToken,
  hashRecoveryToken,
  redis,
  env,
  logger,
} from '@controle-credito/infra';
import { UsersRepository } from '../users/users.repository.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';
import { AuthService } from '../auth/auth.service.js';

/**
 * Servico de recuperacao de senha via email (link magico).
 *
 * Fluxo:
 * 1. User submete email em /forgot-password.
 * 2. Service gera token (32 bytes random), salva hash no Redis com TTL 1h,
 *    manda email com link contendo o token.
 * 3. User clica no link, abre /reset-password?token=...
 * 4. User define nova senha.
 * 5. Service valida token, atualiza hash, revoga todas as sessoes do user,
 *    deleta o token do Redis (single-use).
 *
 * Anti-enumeracao: forgot-password SEMPRE retorna 200. Quando user nao
 * existe, dummy hash + delay similar sao feitos pra nao vazar.
 *
 * Seguranca:
 * - Token: 32 bytes random (256 bits de entropia).
 * - Hash antes de salvar no Redis (SHA-256): se Redis vazar, tokens nao
 *   sao diretamente usaveis.
 * - TTL: 1h (configuravel).
 * - Single-use: token deletado apos uso.
 * - Revoga sessoes: depois de reset, user precisa logar de novo em todos
 *   devices.
 */
@Injectable()
export class RecoveryService {
  constructor(
    private readonly users: UsersRepository,
    private readonly refresh: RefreshTokenService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Request de reset. Sempre retorna void - controller decide status code.
   *
   * Fluxo interno:
   * 1. Busca user por email (system context).
   * 2. Se nao existir: dummy argon2.verify pra igualar timing (~50ms).
   * 3. Se existir: gera token, salva hash no Redis, manda email.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user == null) {
      // Anti-enumeracao: dummy verify pra nao vazar existencia do user
      // por tempo de resposta.
      await argon2.verify(
        '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXltY2RmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmY$ZHVtbXloYXNoZHVtbXloYXNoZHVtbXloYXNoZHVtbXk',
        'dummy-password',
      );
      logger.info({ email: '[redacted]' }, 'forgot-password requested for non-existent email');
      return;
    }

    const token = generateRecoveryToken();
    const tokenHash = hashRecoveryToken(token);
    const key = `pwd_reset:${tokenHash}`;

    // Salva hash no Redis com TTL 1h (configuravel).
    await redis.set(
      key,
      JSON.stringify({ userId: user.id, accountId: user.account_id }),
      'EX',
      env.RECOVERY_TOKEN_TTL_SECONDS,
    );

    // Constroi link de reset. Em prod, usa NEXTAUTH_URL (apps/web).
    // Em dev/test, NEXTAUTH_URL=http://localhost:3000 (default).
    const resetUrl = `${env.NEXTAUTH_URL}/reset-password?token=${token}`;

    const subject = 'Redefinicao de senha - controle-credito';
    const text = [
      `Ola,`,
      ``,
      `Recebemos um pedido de redefinicao de senha para sua conta.`,
      `Se voce' fez esse pedido, clique no link abaixo para redefinir sua senha:`,
      ``,
      resetUrl,
      ``,
      `Este link expira em 1 hora. Se voce' nao fez esse pedido, ignore este email.`,
      ``,
      `Equipe controle-credito`,
    ].join('\n');

    const html = [
      `<p>Ola,</p>`,
      `<p>Recebemos um pedido de redefinicao de senha para sua conta.</p>`,
      `<p>Se voce' fez esse pedido, clique no link abaixo para redefinir sua senha:</p>`,
      `<p><a href="${resetUrl}">${resetUrl}</a></p>`,
      `<p><strong>Este link expira em 1 hora.</strong> Se voce' nao fez esse pedido, ignore este email.</p>`,
      `<p>Equipe controle-credito</p>`,
    ].join('\n');

    await emailService.send({
      to: user.email,
      from: env.EMAIL_PROVIDER_FROM,
      subject,
      text,
      html,
    });

    logger.info(
      { userId: user.id, email: '[redacted]', tokenHashPrefix: tokenHash.slice(0, 8) },
      'recovery email sent',
    );
  }

  /**
   * Valida token. Retorna email mascarado se valido, ou null se invalido/expirado.
   *
   * NUNCA retorna o email completo aqui - vai pra tela de reset como `m***@e***.com`.
   */
  async validateToken(
    token: string,
  ): Promise<{ userId: string; accountId: string; emailMasked: string } | null> {
    const tokenHash = hashRecoveryToken(token);
    const key = `pwd_reset:${tokenHash}`;
    const raw = await redis.get(key);
    if (raw == null) return null;

    try {
      const parsed = JSON.parse(raw) as { userId: string; accountId: string };
      // Busca email so' pra mascarar (sem retornar completo).
      const user = await this.users.findByIdSystemContext(parsed.userId);
      if (user == null) return null;
      return {
        userId: parsed.userId,
        accountId: parsed.accountId,
        emailMasked: maskEmail(user.email),
      };
    } catch {
      return null;
    }
  }

  /**
   * Reset password. Valida token, atualiza hash, revoga todas as sessoes,
   * deleta token. Lancou BadRequestException se token invalido.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const validated = await this.validateToken(token);
    if (validated == null) {
      throw new BadRequestException({ message: 'Token invalido ou expirado' });
    }

    // Hash da nova senha com argon2id (mesmos parametros do login).
    const newHash = await this.auth.hashPassword(newPassword);

    // Atualiza password_hash + revoga sessoes (user precisa logar de novo).
    // updatePassword + updateLastSessionRevokedAt sao chamados juntos.
    await this.users.updatePassword(validated.accountId, validated.userId, newHash);
    await this.users.updateLastSessionRevokedAt(validated.accountId, validated.userId);
    await this.refresh.revoke(validated.userId);

    // Single-use: deleta token do Redis.
    const tokenHash = hashRecoveryToken(token);
    await redis.del(`pwd_reset:${tokenHash}`);

    logger.info(
      { userId: validated.userId, tokenHashPrefix: tokenHash.slice(0, 8) },
      'password reset completed',
    );
  }
}

/**
 * Mascara email: joao.silva@example.com -> j***@e***.com
 *
 * Estrategia: manter primeira letra do user e do dominio. Manter TLD
 * completo. Mostra o suficiente pra user confirmar ("e' meu email")
 * sem vazar o email completo.
 */
function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (domain === '') return '***';
  const [sub = '', ...tldParts] = domain.split('.');
  const tld = tldParts.length > 0 ? tldParts.join('.') : '';
  const maskedLocal = local.length > 0 ? `${local[0]}***` : '***';
  const maskedSub = sub.length > 0 ? `${sub[0]}***` : '***';
  const suffix = tld ? `.${tld}` : '';
  return `${maskedLocal}@${maskedSub}${suffix}`;
}
