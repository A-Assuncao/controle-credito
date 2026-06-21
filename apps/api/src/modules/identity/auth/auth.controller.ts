import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentAccount, CurrentUser } from '../../common/decorators/index.js';
import { AuthGuard } from '../guards/auth.guard.js';
import {
  LoginBodySchema,
  RefreshBodySchema,
  type AuthResponse,
  type LoginBody,
  type RefreshBody,
} from './dto.js';

/**
 * Endpoints publicos de autenticacao.
 *
 * Rotas:
 *   POST /auth/login     - email+senha -> tokens
 *   POST /auth/refresh   - refresh token -> novo access
 *   POST /auth/logout    - revoga refresh + seta last_session_revoked_at
 *
 * O apps/web (NextAuth) orquestra o cookie. Esta API eh stateless
 * quanto a session - quem persiste refresh e' o Redis.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginBodySchema)) body: LoginBody,
  ): Promise<AuthResponse> {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(RefreshBodySchema)) body: RefreshBody,
  ): Promise<AuthResponse> {
    return this.auth.refreshTokens(body.userId, body.refreshToken);
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() userId: string, @CurrentAccount() accountId: string): Promise<void> {
    await this.auth.logout(userId, accountId);
  }
}
