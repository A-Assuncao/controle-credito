import { Module } from '@nestjs/common';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

/**
 * Modulo transversal: filters globais.
 *
 * Pipes (ZodValidationPipe) nao sao providers globais - cada uso e' uma
 * instancia local com schema proprio: `new ZodValidationPipe(Schema)`.
 *
 * O AllExceptionsFilter E' registrado como APP_FILTER global no app.module.ts.
 */
@Module({
  providers: [AllExceptionsFilter],
  exports: [AllExceptionsFilter],
})
export class CommonModule {}
