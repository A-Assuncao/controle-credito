import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { pool, redis } from '@controle-credito/infra';
import { Public } from '../common/decorators/public.decorator.js';

/**
 * Health check publico. NAO passa pelo AuthGuard.
 *
 * Verifica conectividade com Postgres (SELECT 1) e Redis (PING) com timeouts
 * curtos para nao pendurar o liveness probe. Retorna 503 se qualquer
 * dependencia cair - Kubernetes/Docker ira reiniciar o container.
 *
 * Acesso via `withSystemContext` nao e' necessario porque SELECT 1 e PING
 * sao comandos que nao tocam em dados tenant-scoped (a policy RLS nao
 * se aplica a eles).
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  async check(): Promise<{
    status: 'ok' | 'degraded';
    db: 'ok' | 'fail';
    redis: 'ok' | 'fail';
  }> {
    const [dbResult, redisResult] = await Promise.allSettled([this.checkDb(), this.checkRedis()]);

    const db = dbResult.status === 'fulfilled' && dbResult.value ? 'ok' : 'fail';
    const redisOk = redisResult.status === 'fulfilled' && redisResult.value ? 'ok' : 'fail';
    const status: 'ok' | 'degraded' = db === 'ok' && redisOk === 'ok' ? 'ok' : 'degraded';

    if (status !== 'ok') {
      throw new ServiceUnavailableException({ status, db, redis: redisOk });
    }
    return { status, db, redis: redisOk };
  }

  private async checkDb(): Promise<boolean> {
    try {
      const r = await pool.query('SELECT 1 AS ok');
      return r.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const r = await redis.ping();
      return r === 'PONG';
    } catch {
      return false;
    }
  }
}
