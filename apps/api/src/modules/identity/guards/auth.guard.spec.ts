import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { IS_PUBLIC_KEY, Public } from '../../common/decorators/public.decorator.js';

/**
 * Cobre os 3 caminhos do AuthGuard em isolamento:
 * 1. rota @Public() sem token => libera
 * 2. rota protegida sem token => 401 com correlationId
 * 3. rota protegida com accountContext populado => libera
 *
 * Justificativa de manter testes mesmo com passWithNoTests: true: garante que
 * o guard nao regride silenciosamente.
 *
 * Como o AuthGuard usa o Reflector estatico da classe (vide comentario no guard),
 * os testes monkey-patcham `AuthGuard.reflector` para forcar o caminho @Public().
 */

describe('AuthGuard', () => {
  const reflector = new Reflector();
  let originalReflector: Reflector;

  beforeEach(() => {
    originalReflector = (AuthGuard as unknown as { reflector: Reflector }).reflector;
  });

  function setReflector(isPublic: boolean): void {
    (AuthGuard as unknown as { reflector: Reflector }).reflector = {
      getAllAndOverride: (_key: string, _targets: unknown[]) => isPublic,
    } as unknown as Reflector;
  }

  function restoreReflector(): void {
    (AuthGuard as unknown as { reflector: Reflector }).reflector = originalReflector;
  }

  function ctxWith(accountContext: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ accountContext, correlationId: 'unit-corr' }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  it('libera rota @Public() sem token', () => {
    setReflector(true);
    try {
      const guard = new AuthGuard();
      expect(guard.canActivate(ctxWith(null))).toBe(true);
    } finally {
      restoreReflector();
    }
  });

  it('rejeita rota protegida sem token com 401 + correlationId', () => {
    setReflector(false);
    try {
      const guard = new AuthGuard();
      try {
        guard.canActivate(ctxWith(null));
        expect.fail('esperava throw');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const body = (err as UnauthorizedException).getResponse() as { correlationId: string };
        expect(body.correlationId).toBe('unit-corr');
      }
    } finally {
      restoreReflector();
    }
  });

  it('libera rota protegida quando accountContext esta populado', () => {
    setReflector(false);
    try {
      const guard = new AuthGuard();
      const ctx = ctxWith({ accountId: 'a', userId: 'u', mfaStatus: 'not_required' });
      expect(guard.canActivate(ctx)).toBe(true);
    } finally {
      restoreReflector();
    }
  });

  it('Public() decorator aplica a metadata IS_PUBLIC_KEY', () => {
    // Sanity check: o decorator que o guard consulta precisa setar a chave certa.
    class Sample {
      @Public()
      method(): void {
        /* noop */
      }
    }
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [Sample.prototype.method]);
    expect(isPublic).toBe(true);
  });
});
