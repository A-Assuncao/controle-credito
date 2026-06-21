import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { MfaService } from './mfa.service.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentAccount, CurrentUser } from '../../common/decorators/index.js';
import {
  MfaVerifyRequestSchema,
  type MfaSetupResponse,
  type MfaVerifyRequest,
} from '@controle-credito/contracts';

/**
 * Endpoints de MFA. Todos exigem sessao (AuthGuard), mas NAO exigem
 * mfaStatus=verified (MfaGuard sera adicionado na Sprint 2 para rotas
 * sensiveis; setup/verify do proprio MFA eh o bootstrap).
 *
 *   POST /auth/mfa/setup   - gera secret + otpauthUrl
 *   POST /auth/mfa/verify  - valida codigo TOTP + emite tokens com mfa=verified
 *   POST /auth/mfa/disable - desabilita (requer codigo TOTP atual)
 */
@Controller('auth/mfa')
@UseGuards(AuthGuard)
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post('setup')
  @HttpCode(200)
  async setup(
    @CurrentAccount() accountId: string,
    @CurrentUser() userId: string,
  ): Promise<MfaSetupResponse> {
    return this.mfa.setup(accountId, userId);
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @CurrentAccount() accountId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(MfaVerifyRequestSchema)) body: MfaVerifyRequest,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return this.mfa.verifyAndElevate(accountId, userId, body.code);
  }

  @Post('disable')
  @HttpCode(204)
  async disable(
    @CurrentAccount() accountId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(MfaVerifyRequestSchema)) body: MfaVerifyRequest,
  ): Promise<void> {
    await this.mfa.disable(accountId, userId, body.code);
  }
}
