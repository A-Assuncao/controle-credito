import { Module } from '@nestjs/common';
import { TokenService } from './token/token.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { UsersRepository } from './users/users.repository.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { RefreshTokenService } from './auth/refresh-token.service.js';
import { MfaService } from './mfa/mfa.service.js';
import { MfaController } from './mfa/mfa.controller.js';

/**
 * Modulo de identidade. Reune:
 * - TokenService: sign/verify JWT
 * - AuthGuard: global (APP_GUARD), rejeita rotas sem conta
 * - UsersRepository: queries SQL com withAccountContext/withSystemContext
 * - AuthService + AuthController: login/refresh/logout
 * - RefreshTokenService: Redis CRUD de refresh tokens
 * - MfaService + MfaController: setup/verify/disable TOTP
 */
@Module({
  controllers: [AuthController, MfaController],
  providers: [
    TokenService,
    AuthGuard,
    UsersRepository,
    AuthService,
    RefreshTokenService,
    MfaService,
  ],
  exports: [TokenService, AuthGuard, UsersRepository],
})
export class IdentityModule {}
