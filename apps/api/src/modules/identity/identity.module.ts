import { Module } from '@nestjs/common';
import { TokenService } from './token/token.service.js';
import { AuthGuard } from './guards/auth.guard.js';

/**
 * Modulo de identidade: geracao/verificacao de JWT + AuthGuard.
 *
 * - TokenService: usado pelo middleware (AccountContextModule importa IdentityModule)
 *   e futuramente pelo endpoint POST /auth/login (task 6b).
 * - AuthGuard: registrado como APP_GUARD global no app.module.ts.
 */
@Module({
  providers: [TokenService, AuthGuard],
  exports: [TokenService, AuthGuard],
})
export class IdentityModule {}
