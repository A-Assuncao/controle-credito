import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AccountContextMiddleware } from './account-context.middleware.js';

/**
 * Registra o AccountContextMiddleware como APP-level (todas as rotas).
 * Importa IdentityModule porque o middleware depende do TokenService.
 */
@Module({
  imports: [IdentityModule],
})
export class AccountContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AccountContextMiddleware).forRoutes('*');
  }
}
