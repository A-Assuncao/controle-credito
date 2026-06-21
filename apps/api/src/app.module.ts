import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CommonModule } from './modules/common/common.module.js';
import { AccountContextModule } from './modules/account-context/account-context.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthGuard } from './modules/identity/guards/auth.guard.js';
import { AllExceptionsFilter } from './modules/common/filters/all-exceptions.filter.js';

/**
 * Modulo raiz da API.
 *
 * - APP_GUARD: AuthGuard global via useFactory (permite DI). Rotas publicas usam @Public().
 * - APP_FILTER: AllExceptionsFilter global. Garante envelope consistente + log estruturado.
 * - AccountContextModule: importa IdentityModule (middleware depende do TokenService).
 */
@Module({
  imports: [CommonModule, IdentityModule, AccountContextModule, HealthModule],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (guard: AuthGuard) => guard,
      inject: [AuthGuard],
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
