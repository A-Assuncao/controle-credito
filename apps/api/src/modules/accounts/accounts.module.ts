import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AccountsRepository } from './accounts.repository.js';
import { AuditLogRepository } from './audit.repository.js';
import { AuditController } from './audit.controller.js';
import { AuditLoggerInterceptor } from './audit-logger.interceptor.js';
import { IdentityModule } from '../identity/identity.module.js';

/**
 * Modulo de accounts. Reusa UsersRepository do IdentityModule.
 * Tambem expoe audit (read-only) e o AuditLoggerInterceptor (gravacao).
 */
@Module({
  imports: [IdentityModule],
  controllers: [AccountsController, AuditController],
  providers: [AccountsService, AccountsRepository, AuditLogRepository, AuditLoggerInterceptor],
  exports: [AuditLoggerInterceptor, AuditLogRepository],
})
export class AccountsModule {}
