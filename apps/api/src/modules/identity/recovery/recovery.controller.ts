import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { rateLimit, getRequestIp, env, logger } from '@controle-credito/infra';
import { RecoveryService } from './recovery.service.js';
import {
  ForgotPasswordBodySchema,
  ResetPasswordBodySchema,
  type ForgotPasswordBody,
  type ResetPasswordBody,
  type ValidateTokenResponse,
} from './recovery.dto.js';

/**
 * Endpoints publicos de recuperacao de senha.
 *
 * Rotas:
 *   POST /auth/forgot-password           - { email } -> 204 (sempre)
 *   GET  /auth/reset-password/validate   - ?token=... -> { valid, email? }
 *   POST /auth/reset-password            - { token, newPassword } -> 204
 *
 * Todas publicas (sem AuthGuard). Rate-limitadas via Redis.
 *
 * IMPORTANTE: forgot-password sempre retorna 204 pra evitar
 * enumeracao de users (anti-reconhecimento). A diferenciacao entre
 * "user existe" e "user nao existe" so' aparece no email (se existir).
 */
@Controller('auth')
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Public()
  @Post('forgot-password')
  @HttpCode(204)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordBodySchema)) body: ForgotPasswordBody,
    @Req() req: Request,
  ): Promise<void> {
    // Rate limit por IP + por email (defesa em profundidade).
    const ip = getRequestIp(req as Parameters<typeof getRequestIp>[0]);
    const ipOk = await rateLimit(
      'forgot-password:ip',
      ip,
      env.RATE_LIMIT_FORGOT_PASSWORD,
      env.RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!ipOk) {
      logger.warn({ ip, email: '[redacted]' }, 'forgot-password rate limited by IP');
      throw new UnauthorizedException({
        message: 'Muitas tentativas. Tente novamente mais tarde.',
      });
    }
    const emailOk = await rateLimit(
      'forgot-password:email',
      body.email.toLowerCase(),
      env.RATE_LIMIT_FORGOT_PASSWORD,
      env.RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!emailOk) {
      logger.warn({ email: '[redacted]' }, 'forgot-password rate limited by email');
      throw new UnauthorizedException({
        message: 'Muitas tentativas. Tente novamente mais tarde.',
      });
    }

    await this.recovery.requestReset(body.email);
    // 204 sempre - anti-enumeracao.
  }

  @Public()
  @Get('reset-password/validate')
  async validateToken(@Query('token') token: string | undefined): Promise<ValidateTokenResponse> {
    if (token == null || token.length < 20) {
      return { valid: false };
    }
    const result = await this.recovery.validateToken(token);
    if (result == null) {
      return { valid: false };
    }
    return { valid: true, email: result.emailMasked };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordBodySchema)) body: ResetPasswordBody,
    @Req() req: Request,
  ): Promise<void> {
    // Rate limit por IP (anti-brute-force do token).
    const ip = getRequestIp(req as Parameters<typeof getRequestIp>[0]);
    const ok = await rateLimit(
      'reset-password:ip',
      ip,
      env.RATE_LIMIT_RESET_PASSWORD,
      env.RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!ok) {
      logger.warn({ ip }, 'reset-password rate limited by IP');
      throw new UnauthorizedException({
        message: 'Muitas tentativas. Tente novamente mais tarde.',
      });
    }

    try {
      await this.recovery.resetPassword(body.token, body.newPassword);
    } catch (err) {
      // BAD_REQUEST do service (token invalido) cai como 400.
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw err;
    }
  }
}
