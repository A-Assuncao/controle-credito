import pino from 'pino';
import { env } from './env.js';

/**
 * Logger estruturado com redacao central (regra 4 - sem PII em log claro).
 * Paths de redacao sao case-insensitive. Adicionar campos aqui eh a unica forma
 * de garantir mascaramento consistente entre api e web.
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
});