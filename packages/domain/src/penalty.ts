/**
 * Cálculo de penalidades: multa + mora + carência.
 *
 * Componentes:
 * - fixed: % fixa de multa sobre o valor da parcela (aplicada uma vez no atraso).
 * - daily: % de mora ao dia sobre o valor da parcela (acumulada por dia).
 * - grace_days: dias de carência antes de aplicar multa/mora.
 *
 * Referência: docs/master-plan.md seção 15.3 e docs/financial-engine.md.
 */

import { cents, type Cents, roundHalfEven } from './money.js';
import type { PenaltyParams } from './productSchema.js';

/**
 * Calcula multa fixa (% sobre o valor da parcela) - aplicada uma vez.
 * Retorna 0 se dentro do período de carência.
 *
 * @param installmentValue Valor da parcela em Cents.
 * @param penaltyParams Parâmetros de penalidade do contrato.
 * @param daysOverdue Dias de atraso.
 * @returns Multa fixa em Cents.
 */
export function fixedPenalty(
  installmentValue: Cents,
  penaltyParams: PenaltyParams,
  daysOverdue: number,
): Cents {
  if (installmentValue === 0) return cents(0);
  if (daysOverdue <= penaltyParams.grace_days) return cents(0);
  if (!penaltyParams.fixed) return cents(0);

  const rate = Number.parseFloat(penaltyParams.fixed);
  if (!Number.isFinite(rate) || rate < 0) return cents(0);

  const penalty = installmentValue * rate;
  return cents(roundHalfEven(penalty));
}

/**
 * Calcula mora diária (% ao dia sobre o valor da parcela, acumulada).
 * Retorna 0 se dentro do período de carência.
 *
 * @param installmentValue Valor da parcela em Cents.
 * @param penaltyParams Parâmetros de penalidade.
 * @param daysOverdue Dias de atraso (após carência).
 * @returns Mora acumulada em Cents.
 */
export function dailyPenalty(
  installmentValue: Cents,
  penaltyParams: PenaltyParams,
  daysOverdue: number,
): Cents {
  if (installmentValue === 0) return cents(0);
  if (daysOverdue <= penaltyParams.grace_days) return cents(0);
  if (!penaltyParams.daily) return cents(0);

  const rate = Number.parseFloat(penaltyParams.daily);
  if (!Number.isFinite(rate) || rate < 0) return cents(0);

  const days = daysOverdue - penaltyParams.grace_days;
  const penalty = installmentValue * rate * days;
  return cents(roundHalfEven(penalty));
}

/**
 * Calcula penalidade total (multa fixa + mora diária) para uma parcela em atraso.
 */
export function totalPenalty(
  installmentValue: Cents,
  penaltyParams: PenaltyParams,
  daysOverdue: number,
): Cents {
  const fixed = fixedPenalty(installmentValue, penaltyParams, daysOverdue);
  const daily = dailyPenalty(installmentValue, penaltyParams, daysOverdue);
  return (fixed + daily) as unknown as number as Cents;
}
