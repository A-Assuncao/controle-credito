import { Module } from '@nestjs/common';
import { ZodValidationPipe } from './pipes/zod-validation.pipe.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

/**
 * Modulo transversal: pipes, filters, decorators.
 *
 * O ZodValidationPipe NAO precisa ser provider global - cada uso e'
 * instancia local (`new ZodValidationPipe(Schema)`). Provider aqui apenas
 * permite injecao em testes.
 *
 * O AllExceptionsFilter E' registrado como APP_FILTER global no app.module.ts.
 */
@Module({
  providers: [ZodValidationPipe, AllExceptionsFilter],
  exports: [ZodValidationPipe, AllExceptionsFilter],
})
export class CommonModule {}
