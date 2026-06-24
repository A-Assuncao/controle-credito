import { randomBytes, createHash } from 'node:crypto';

/**
 * Gera token de recovery: 32 bytes random, base64url encoded (43 chars).
 *
 * Por que 32 bytes: NIST SP 800-63B recomenda >=128 bits de entropia pra
 * tokens de sessao. 32 bytes = 256 bits - bem acima.
 *
 * Por que base64url: URL-safe (sem `+`, `/`, `=`) - pode ser passado em
 * query string sem encoding. Mantem case-sensitive (importante: clientes
 * HTTP podem normalizar URL mas tokens devem ser preservados).
 */
export function generateRecoveryToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash SHA-256 do token (hex 64 chars).
 *
 * Por que hash antes de salvar: se o Redis vazar, os hashes nao sao
 * diretamente usaveis como tokens (precisaria pre-image attack, inviavel
 * pra SHA-256). Padrao da industria (tambem usado pra API keys, etc).
 *
 * Por que SHA-256 e nao argon2: tokens sao high-entropy (256 bits
 * random) - argon2 seria overkill. SHA-256 eh' rapido, deterministic,
 * e suficiente.
 */
export function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
