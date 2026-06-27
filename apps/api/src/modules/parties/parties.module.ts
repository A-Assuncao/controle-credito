import { Module } from '@nestjs/common';
import { PartiesController } from './parties.controller.js';
import { PartiesService } from './parties.service.js';
import { PartiesRepository } from './parties.repository.js';
import { IdentityModule } from '../identity/identity.module.js';

/**
 * Modulo de parties (tomadores). EXE-002.3b (Sprint 3).
 *
 * Endpoints:
 *   POST /parties - criar
 *   GET  /parties - listar
 *
 * NAO importa CommonModule porque nao usa decorators comuns alem de
 * CurrentAccount/ZodValidationPipe (ambos ja' carregados via CommonModule
 * global do AppModule). Apenas importa IdentityModule para garantir que
 * o AuthGuard global esta resolvido quando o controller eh' instanciado.
 *
 * Proximos modulos que dependem de parties (contracts, payments) devem
 * importar PartiesModule e usar PartiesService.
 */
@Module({
  imports: [IdentityModule],
  controllers: [PartiesController],
  providers: [PartiesService, PartiesRepository],
  exports: [PartiesService, PartiesRepository],
})
export class PartiesModule {}
