import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Guard global para rotas que exigem MFA verificado.
 *
 * Aplicado via @UseGuards(MfaGuard) em endpoints sensiveis. O AuthGuard
 * global ja' validou o JWT e populou req.accountContext. Este guard
 * verifica se mfaStatus === 'verified'.
 *
 * NAO confunde com o token JWT de MFA (que eh diferente do access token).
 * O access token carrega o status no claim `mfa` ('pending' | 'verified' |
 * 'not_required'). MfaGuard rejeita 'pending'.
 *
 * Para rotas publicas: use @Public() no controller (do AuthGuard), nao o
 * MfaGuard. MfaGuard assume que o AuthGuard ja' validou o JWT.
 *
 * Resposta de erro: 401 com mensagem 'MFA required' (cliente redireciona
 * para /mfa-setup).
 */
@Injectable()
export class MfaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      accountContext: { mfaStatus: 'pending' | 'verified' | 'not_required' } | null;
      correlationId: string;
    }>();
    if (req.accountContext == null) {
      // AuthGuard deveria ter rejeitado antes. Se chegou aqui, ha bug.
      throw new UnauthorizedException({
        message: 'Authentication required',
        correlationId: req.correlationId,
      });
    }
    if (req.accountContext.mfaStatus === 'verified') return true;
    throw new UnauthorizedException({
      message: 'MFA required',
      correlationId: req.correlationId,
    });
  }
}
