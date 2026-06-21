/**
 * Contexto da request apos o AccountContextMiddleware.
 * Tudo que vem do JWT e' narrow-ado para o formato camelCase que o resto
 * do app consome.
 */
export interface AccountContextPayload {
  accountId: string;
  userId: string;
  /**
   * 'not_required' => user nao tem MFA habilitado (padrao Sprint 1)
   * 'pending'      => user habilitou MFA mas ainda nao verificou TOTP nesta sessao
   * 'verified'     => TOTP verificado nesta sessao (MfaGuard libera rotas sensiveis)
   */
  mfaStatus: 'pending' | 'verified' | 'not_required';
  /** JWT iat (segundos desde epoch). Usado para checar coarse-grained revocation. */
  issuedAt: number;
}
