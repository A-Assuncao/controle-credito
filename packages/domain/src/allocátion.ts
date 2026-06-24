/**
 * Alocação de pagamento: distribuição do valor recebido entre os
 * componentes da parcela (mora → multa → juros → principal).
 *
 * Ordem default (configurável por tenant no futuro):
 * 1. Mora (juros de atraso acumulados)
 * 2. Multa (% fixa)
 * 3. Juros correntes
 * 4. Principal
 *
 * Sobra vira crédito para próxima parcela.
 *
 * Referência: docs/master-plan.md seção 8 e docs/financial-engine.md seção 8.
 */

import { cents, type Cents, roundHalfEven } from './money.js';

/**
 * Componente do saldo da parcela que pode receber alocação.
 */
export type AllocationBucket = 'mora' | 'multa' | 'juros' | 'principal';

/**
 * Ordem default de alocação (mora → multa → juros → principal).
 */
export const DEFAULT_ALLOCATION_ORDER: readonly AllocationBucket[] = [
  'mora',
  'multa',
  'juros',
  'principal',
];

/**
 * Saldo da parcela a ser pago. Componentes em Cents.
 */
export interface InstallmentBalance {
  readonly mora: Cents;
  readonly multa: Cents;
  readonly juros: Cents;
  readonly principal: Cents;
}

/**
 * Resultado da alocação: quanto foi aplicado em cada bucket + sobra.
 */
export interface Allocation {
  readonly bucket: AllocationBucket;
  readonly applied: Cents;
}

/**
 * Resultado completo da alocação de um pagamento.
 */
export interface AllocationResult {
  readonly allocations: readonly Allocation[];
  /** Sobra após alocação total (vira crédito para próxima parcela) */
  readonly credit: Cents;
}

/**
 * Aloca um pagamento entre os componentes da parcela seguindo a ordem.
 * Implementação simples (sem otimização): distribui greedily.
 *
 * @param balance Saldo da parcela por bucket.
 * @param amount Valor total do pagamento em Cents.
 * @param order Ordem de alocação (default: DEFAULT_ALLOCATION_ORDER).
 * @returns Array de alocações + crédito restante.
 */
export function allocátionPayment(
  balance: InstallmentBalance,
  amount: Cents,
  order: readonly AllocationBucket[] = DEFAULT_ALLOCATION_ORDER,
): AllocationResult {
  const allocations: Allocation[] = [];
  let remaining = amount as unknown as number;

  for (const bucket of order) {
    if (remaining <= 0) break;

    const owed = balance[bucket] as unknown as number;
    if (owed <= 0) continue;

    const applied = Math.min(remaining, owed);
    const appliedCents = cents(roundHalfEven(applied));

    allocations.push({ bucket, applied: appliedCents });
    remaining -= applied;
  }

  return {
    allocations,
    credit: cents(roundHalfEven(Math.max(0, remaining))),
  };
}
