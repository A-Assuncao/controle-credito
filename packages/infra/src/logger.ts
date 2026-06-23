import pino from 'pino';
import { env } from './env.js';

/**
 * Logger estruturado com redacao central (regra 4 - sem PII em log claro).
 * Paths de redacao sao case-insensitive. Adicionar campos aqui eh a unica forma
 * de garantir mascaramento consistente entre api e web.
 *
 * Em dev (NODE_ENV=development): usa pino-pretty para saida colorida multi-line.
 * Em prod/test: JSON puro (parseavel por qualquer aggregator).
 *
 * Para logs dentro de um request, use `req.log` ou `logger.child({ correlationId })`
 * para garantir que o ID propague em todos os logs do request.
 */
const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'email',
  '*.email',
  'cpf',
  '*.cpf',
  'phone',
  '*.phone',
  'phoneEncrypted',
  '*.phoneEncrypted',
  'secret',
  '*.secret',
  'totpSecret',
  '*.totpSecret',
  'mfaSecret',
  '*.mfaSecret',
];

const isDev = env.NODE_ENV === 'development';

// pino-pretty eh uma dep separada. Em prod ela nao eh instalada, entao
// o logger fica em JSON puro. Em dev, se nao estiver disponivel, tambem
// cai para JSON (fail-safe).
function buildDevTransport(): pino.TransportSingleOptions | undefined {
  if (!isDev) return undefined;
  try {
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service,env',
        singleLine: false,
      },
    };
  } catch {
    return undefined;
  }
}

const devTransport = buildDevTransport();

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'controle-credito',
    env: env.NODE_ENV,
  },
  ...(devTransport ? { transport: devTransport } : {}),
});
