/**
 * Cálculo de quitação antecipada de contrato.
 *
 * Estratégias:
 * - 'prospectus': segue o que o ProductSchema define (desconto configurável).
 * - 'simple_deduction': desconto linear dos juros futuros proporcional ao
 *   tempo restante (1/n por período não transcorrido).
 *
 * Referência: docs/financial-engine.md seção 5 (early_settlement).
 */

import { cents, type Cents, roundHalfEven } from './money.js';
import type { EarlySettlementParams, Installment } from './productSchema.js';

/**
 * Calcula o valor de quitação antecipada de um contrato.
 *
 * @param remainingInstallments Parcelas ainda não pagas.
 * @param earlySettlementParams Parâmetros de quitação do schema.
 * @param ratePerPeriod Taxa por período (usada para calcular juros futuros).
 * @param periodsElapsed Número de períodos já transcorridos.
 * @returns Valor total a pagar para quitar (em Cents).
 */
export function calculateEarlySettlement(
  remainingInstallments: readonly Installment[],
  earlySettlementParams: EarlySettlementParams,
  ratePerPeriod: string,
  periodsElapsed: number,
): Cents {
  if (remainingInstallments.length === 0) return cents(0);

  // Soma do principal restante
  const principalRemaining = remainingInstallments.reduce(
    (acc, i) => acc + (i.principal as unknown as number),
    0,
  );
  if (principalRemaining === 0) return cents(0);

  // Soma dos juros futuros (sem desconto)
  const futureInterest = remainingInstallments.reduce(
    (acc, i) => acc + (i.interest as unknown as number),
    0,
  );

  // Calcula desconto sobre juros futuros
  let discount = 0;
  const totalPeriods = remainingInstallments.length + periodsElapsed;
  if (earlySettlementParams.method === 'simple_deduction') {
    // Desconto proporcional: (períodos transcorridos / total) * juros futuros
    const ratio = periodsElapsed / totalPeriods;
    discount = futureInterest * ratio;
  } else if (
    earlySettlementParams.method === 'prospectus' &&
    earlySettlementParams.deduction_rate
  ) {
    // Desconto fixo: deduction_rate * juros futuros
    const rate = Number.parseFloat(earlySettlementParams.deduction_rate);
    if (Number.isFinite(rate) && rate > 0) {
      discount = futureInterest * rate;
    }
  }

  return cents(roundHalfEven(principalRemaining + futureInterest - discount));
}
