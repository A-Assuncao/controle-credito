import { SetMetadata } from '@nestjs/common';

/**
 * Marca uma rota como publica (sem auth). Usado pelo AuthGuard global.
 * Aplicar em controller method ou classe:
 *
 *   @Public()
 *   @Get('health')
 *   health() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
