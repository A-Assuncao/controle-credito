import 'dotenv/config';
import { z } from 'zod';

/**
 * Validacao de env em runtime (regra 4 - fail-fast).
 * Sem defaults perigosos: tudo que pode quebrar seguranca precisa ser explicito.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production', 'preview'])
    .default('development'),
  PORT_API: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(10),
  DATABASE_URL_TEST: z.string().min(10).optional(),
  /**
   * Conexao usada por withSystemContext. Aponta para um role com BYPASSRLS
   * (recomendado: `app_system`). Mantemos separada da DATABASE_URL para que
   * o caminho tenant (withAccountContext) continue na role sem privilegios
   * de bypass.
   */
  DATABASE_URL_SYSTEM: z.string().min(10).optional(),
  REDIS_URL: z.string().min(10),

  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET precisa ter >= 32 chars'),
  NEXTAUTH_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter >= 32 chars'),
  /**
   * TTL do refresh token em horas. Access token fica em 15min (TokenService).
   * Default 12h: refresh longo o suficiente para renovacao automatica via
   * NextAuth, curto o suficiente para forcar novo login diario se o device
   * for comprometido.
   */
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),

  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_PROVIDER_FROM: z.string().default('noreply@controle-credito.local'),
  SMS_PROVIDER_API_KEY: z.string().optional(),
  SMS_PROVIDER_FROM: z.string().optional(),

  /**
   * TTL do token de recovery de senha. Default 1h - balanceado entre
   * seguranca (tokens curtos) e UX (tempo de user ver o email).
   */
  RECOVERY_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  /**
   * Rate limit do forgot-password: 3 requests por janela (anti-spam).
   */
  RATE_LIMIT_FORGOT_PASSWORD: z.coerce.number().int().positive().default(3),
  /**
   * Rate limit do reset-password: 5 requests por janela (anti-brute-force).
   */
  RATE_LIMIT_RESET_PASSWORD: z.coerce.number().int().positive().default(5),
  /**
   * Janela do rate limit em segundos. Default 15min.
   */
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),

  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  /**
   * Fração de requests com trace sample (0 = nenhum, 1 = todos).
   * Default 0.1 (10%) é o recomendado pelo Sentry pra prod.
   * Em dev/CI sem SENTRY_DSN, este valor é ignorado.
   */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables - see above');
}

export const env = parsed.data;
export type Env = typeof env;
