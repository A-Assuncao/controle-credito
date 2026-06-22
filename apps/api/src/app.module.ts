import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './modules/common/common.module.js';
import { AccountContextModule } from './modules/account-context/account-context.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AuthGuard } from './modules/identity/guards/auth.guard.js';
import { AllExceptionsFilter } from './modules/common/filters/all-exceptions.filter.js';
import { AuditLoggerInterceptor } from './modules/accounts/audit-logger.interceptor.js';

/**
 * Modulo raiz da API.
 *
 * - APP_GUARD: AuthGuard global via useFactory (permite DI). Rotas publicas usam @Public().
 * - APP_FILTER: AllExceptionsFilter global. Garante envelope consistente + log estruturado.
 * - APP_INTERCEPTOR: AuditLoggerInterceptor. Grava mutacoes no audit_log.
 * - AccountContextModule: importa IdentityModule (middleware depende do TokenService).
 * - AccountsModule: GET/PATCH /accounts/me + GET /accounts/me/audit.
 */
@Module({
  imports: [CommonModule, IdentityModule, AccountContextModule, HealthModule, AccountsModule],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (guard: AuthGuard) => guard,
      inject: [AuthGuard],
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggerInterceptor,
    },
  ],
})
export class AppModule {}
