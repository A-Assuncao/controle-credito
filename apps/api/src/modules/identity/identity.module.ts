import { Module } from '@nestjs/common';
import { TokenService } from './token/token.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { MfaGuard } from './guards/mfa.guard.js';
import { UsersRepository } from './users/users.repository.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { RefreshTokenService } from './auth/refresh-token.service.js';
import { MfaService } from './mfa/mfa.service.js';
import { MfaController } from './mfa/mfa.controller.js';
import { RecoveryService } from './recovery/recovery.service.js';
import { RecoveryController } from './recovery/recovery.controller.js';

/**
 * Modulo de identidade. Reune:
 * - TokenService: sign/verify JWT
 * - AuthGuard: global (APP_GUARD), rejeita rotas sem conta
 * - MfaGuard: aplicavel em rotas sensiveis (exige mfa=verified)
 * - UsersRepository: queries SQL com withAccountContext/withSystemContext
 * - AuthService + AuthController: login/refresh/logout
 * - RefreshTokenService: Redis CRUD de refresh tokens
 * - MfaService + MfaController: setup/verify/disable TOTP
 * - RecoveryService + RecoveryController: forgot-password / reset-password via email
 */
@Module({
  controllers: [AuthController, MfaController, RecoveryController],
  providers: [
    TokenService,
    AuthGuard,
    MfaGuard,
    UsersRepository,
    AuthService,
    RefreshTokenService,
    MfaService,
    RecoveryService,
  ],
  exports: [TokenService, AuthGuard, MfaGuard, UsersRepository],
})
export class IdentityModule {}
