import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { IS_PUBLIC_KEY, Public } from '../../common/decorators/public.decorator.js';
import type { UsersRepository } from '../users/users.repository.js';

/**
 * Cobre os 3 caminhos do AuthGuard em isolamento:
 * 1. rota @Public() sem token => libera
 * 2. rota protegida sem token => 401 com correlationId
 * 3. rota protegida com accountContext populado => libera
 * 4. rota protegida com token emitido antes de last_session_revoked_at => 401
 */

describe('AuthGuard', () => {
  const reflector = new Reflector();
  let originalReflector: Reflector;

  function makeUsersRepo(revokedAt: Date | null = null): UsersRepository {
    return {
      getRevocationTimestamp: vi.fn().mockResolvedValue(revokedAt),
    } as unknown as UsersRepository;
  }

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

  function ctxWith(
    accountContext: {
      accountId: string;
      userId: string;
      issuedAt: number;
      mfaStatus?: string;
    } | null,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ accountContext, correlationId: 'unit-corr' }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  it('libera rota @Public() sem token', async () => {
    setReflector(true);
    try {
      const guard = new AuthGuard(makeUsersRepo());
      expect(await guard.canActivate(ctxWith(null))).toBe(true);
    } finally {
      restoreReflector();
    }
  });

  it('rejeita rota protegida sem token com 401 + correlationId', async () => {
    setReflector(false);
    try {
      const guard = new AuthGuard(makeUsersRepo());
      try {
        await guard.canActivate(ctxWith(null));
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

  it('libera rota protegida quando accountContext esta populado', async () => {
    setReflector(false);
    try {
      const guard = new AuthGuard(makeUsersRepo());
      const ctx = ctxWith({ accountId: 'a', userId: 'u', issuedAt: 1 });
      expect(await guard.canActivate(ctx)).toBe(true);
    } finally {
      restoreReflector();
    }
  });

  it('rejeita token emitido antes de last_session_revoked_at', async () => {
    setReflector(false);
    try {
      const revokedAt = new Date('2026-01-01T00:00:00Z');
      const guard = new AuthGuard(makeUsersRepo(revokedAt));
      const ctx = ctxWith({ accountId: 'a', userId: 'u', issuedAt: 1 }); // epoch
      try {
        await guard.canActivate(ctx);
        expect.fail('esperava throw');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const body = (err as UnauthorizedException).getResponse() as { message: string };
        expect(body.message).toBe('Session revoked');
      }
    } finally {
      restoreReflector();
    }
  });

  it('Public() decorator aplica a metadata IS_PUBLIC_KEY', () => {
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
