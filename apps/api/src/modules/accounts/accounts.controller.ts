import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AuthGuard } from '../identity/guards/auth.guard.js';
import { MfaGuard } from '../identity/guards/mfa.guard.js';
import { CurrentAccount, CurrentUser } from '../common/decorators/index.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  UpdateAccountSchema,
  type MeResponse,
  type UpdateAccount,
} from '@controle-credito/contracts';

/**
 * Endpoints da account do usuario logado.
 *
 *   GET   /accounts/me     - account + user (somente leitura, sem MFA)
 *   PATCH /accounts/me     - full_name, settings (MFA OBRIGATORIO)
 *
 * AuthGuard global exige sessao valida. Cross-account NAO e' possivel
 * porque accountId vem do JWT (signed) e RLS filtra no DB.
 *
 * PATCH exige MFA verificado (MfaGuard). Rationale: mexer em settings ou
 * nome sao alteracoes que o usuario faz raramente, e dao superficie de
 * ataque para um session hijacker. MFA reduz drasticamente o risco.
 */
@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  async getMe(
    @CurrentAccount() accountId: string,
    @CurrentUser() userId: string,
  ): Promise<MeResponse> {
    return this.accountsService.getMe(accountId, userId);
  }

  @Patch('me')
  @UseGuards(MfaGuard)
  async updateMe(
    @CurrentAccount() accountId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(UpdateAccountSchema)) patch: UpdateAccount,
  ): Promise<MeResponse> {
    return this.accountsService.updateMe(accountId, userId, patch);
  }
}
