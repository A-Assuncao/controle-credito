import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './modules/common/common.module.js';
import { AccountContextModule } from './modules/account-context/account-context.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { ObservabilityModule } from './modules/observability/observability.module.js';
import { HttpLoggerMiddleware } from './modules/observability/http-logger.middleware.js';
import { AuthGuard } from './modules/identity/guards/auth.guard.js';
import { AllExceptionsFilter } from './modules/common/filters/all-exceptions.filter.js';
import { AuditLoggerInterceptor } from './modules/accounts/audit-logger.interceptor.js';
import { PartiesModule } from './modules/parties/parties.module.js';
import { ProductSchemasModule } from './modules/product-schemas/product-schemas.module.js';

/**
 * Modulo raiz da API.
 *
 * - APP_GUARD: AuthGuard global via useFactory (permite DI). Rotas publicas usam @Public().
 * - APP_FILTER: AllExceptionsFilter global. Garante envelope consistente + log estruturado.
 * - APP_INTERCEPTOR: AuditLoggerInterceptor. Grava mutacoes no audit_log.
 * - AccountContextModule: importa IdentityModule (middleware depende do TokenService).
 * - AccountsModule: GET/PATCH /accounts/me + GET /accounts/me/audit.
 * - PartiesModule: POST/GET /parties (EXE-002.3b Sprint 3).
 * - ProductSchemasModule: POST/GET /product-schemas (EXE-002.3b Sprint 3).
 * - ObservabilityModule: inicializa OTel SDK (auto-instrumentation).
 * - HttpLoggerMiddleware: loga cada request com correlationId e durationMs.
 */
@Module({
  imports: [
    ObservabilityModule,
    CommonModule,
    IdentityModule,
    AccountContextModule,
    HealthModule,
    AccountsModule,
    PartiesModule,
    ProductSchemasModule,
  ],
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // HttpLoggerMiddleware roda em todas as rotas (depois do
    // AccountContextMiddleware para ter req.correlationId).
    // Como o AccountContextModule ja' registra seu middleware via forRoutes('*'),
    // registramos o nosso tbm para forRoutes('*') - o Nest executa em ordem
    // de registro (declaracao no module).
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
