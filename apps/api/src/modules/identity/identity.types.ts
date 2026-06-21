/**
 * Claims do access token JWT (apps/api emite/verifica).
 *
 * Convencao: `sub` e `account_id` sao snake_case no payload (alinhado com
 * convencao JWT/Auth0). Na populacao de `req.accountContext`, esses campos
 * sao renomeados para camelCase via TokenService.toAccountContext.
 */
export interface AccessTokenPayload {
  /** user_id (UUID) */
  sub: string;
  /** account_id (UUID) - usado pela RLS policy no Postgres */
  account_id: string;
  /**
   * Status MFA no momento da emissao. Ausente no payload => tratado como
   * 'not_required' (regra de retrocompatibilidade para tokens antigos).
   */
  mfa?: 'pending' | 'verified' | 'not_required';
  /** iat e exp sao adicionados pelo jose.SignJWT - nao declaramos aqui */
}
