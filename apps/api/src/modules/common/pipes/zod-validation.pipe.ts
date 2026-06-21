import { Injectable, type PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

/**
 * Pipe generico para validar entrada HTTP (body, query, params) contra um
 * schema zod. O projeto usa zod como fonte de verdade (ver packages/contracts),
 * evitando class-validator/class-transformer.
 *
 * Falha -> 422 Unprocessable Entity com `issues` do zod no body. O AllExceptionsFilter
 * adiciona `correlationId` no envelope final.
 *
 * Uso:
 *   @Post('login')
 *   login(@Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest) { ... }
 *
 * Comportamento do zod: strip (campos extras descartados). Para rejeitar
 * campos extras, use `.strict()` no schema.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
