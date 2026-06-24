/**
 * Geração de cronograma de parcelas (schedule).
 *
 * Implementa 2 modalidades do CORE V1:
 * 1. 'fixed_installment' (Price): parcela fixa de principal + juros.
 * 2. 'interest_only': paga apenas os juros; principal preservado.
 *
 * 'bullet' e 'custom' ficam para v2 da sprint.
 *
 * Invariantes do cronograma (validados em testes):
 * 1. sum(installment.principal) === loan.principal (considerando rounding)
 * 2. installment.due_date >= loan.disbursement_date
 * 3. installment[i].due_date < installment[i+1].due_date (estritamente crescente)
 * 4. installment.amount >= 0 sempre
 * 5. Última parcela absorve diferença de arredondamento
 *
 * Referência: docs/financial-engine.md seção 7.
 */

import { cents, type Cents, roundHalfEven } from './money.js';
import type { Installment, PaymentFrequency, ProductSchema } from './productSchema.js';

/**
 * Adiciona `days` dias a uma data ISO (YYYY-MM-DD), retornando nova data ISO.
 * Não usa bibliotecas externas - implementa aritmética básica.
 */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Mapeia PaymentFrequency para dias entre parcelas.
 * - weekly: 7 dias
 * - biweekly: 14 dias
 * - monthly: ~30 dias (varia por mês)
 * - custom: throw (precisa de implementação via interface)
 */
export function daysBetween(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30; // aproximação (cronograma real ajustaria por mês)
    case 'custom':
      throw new Error('PaymentFrequency "custom" não implementada nesta sprint');
  }
}

/**
 * Calcula o valor da parcela fixa (Price) usando a fórmula:
 * PMT = PV * (i * (1+i)^n) / ((1+i)^n - 1)
 *
 * Para i = 0 (sem juros), PMT = PV / n.
 *
 * @param principal Valor total do empréstimo em Cents.
 * @param ratePerPeriod Taxa por período em string decimal.
 * @param periods Número total de parcelas.
 * @returns Valor de cada parcela em Cents (arredondado banker's).
 */
export function fixedInstallment(principal: Cents, ratePerPeriod: string, periods: number): Cents {
  if (periods <= 0 || !Number.isInteger(periods)) {
    throw new Error(`Periods inválido: ${periods}`);
  }
  if (principal === 0) return cents(0);

  const rate = Number.parseFloat(ratePerPeriod);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Taxa inválida: ${ratePerPeriod}`);
  }

  // Sem juros: divide principal igualmente
  if (rate === 0) {
    return cents(roundHalfEven(principal / periods));
  }

  // Fórmula Price: PMT = PV * (i * (1+i)^n) / ((1+i)^n - 1)
  const factor = Math.pow(1 + rate, periods);
  const pmt = (principal * rate * factor) / (factor - 1);
  return cents(roundHalfEven(pmt));
}

/**
 * Gera cronograma para modalidade 'fixed_installment' (Price).
 *
 * Algoritmo:
 * 1. Calcula PMT fixo usando fórmula Price.
 * 2. Para cada parcela i (1..n):
 *    - interest_i = balance * rate (arredondado)
 *    - principal_i = PMT - interest_i
 *    - balance -= principal_i
 * 3. Última parcela: principal absorve diferença de arredondamento
 *    (balance pode ficar +/- alguns cents vs 0).
 *
 * IMPORTANTE: usa juros SIMPLES (não compostos) por padrão - mais comum
 * no mercado BR para empréstimos pessoais. Para compostos, usar
 * generateScheduleInterestOnly como referência.
 */
export function generateScheduleFixedInstallment(
  principal: Cents,
  ratePerPeriod: string,
  periods: number,
  startDate: string,
  frequency: PaymentFrequency,
): readonly Installment[] {
  if (principal === 0) {
    return [];
  }
  const pmt = fixedInstallment(principal, ratePerPeriod, periods);
  const rate = Number.parseFloat(ratePerPeriod);
  const installments: Installment[] = [];
  let balance = principal;
  const daysStep = daysBetween(frequency);

  for (let i = 1; i <= periods; i++) {
    const interest = cents(roundHalfEven(balance * rate));
    let principalPart: Cents;
    let amount: Cents;

    if (i === periods) {
      // Última parcela: absorve diferença de arredondamento
      principalPart = balance;
      amount = (principalPart + interest) as Cents;
      balance = cents(0);
    } else {
      principalPart = (pmt - interest) as Cents;
      // Garante que principalPart não exceda balance (pode acontecer
      // por arredondamento com taxa baixa)
      if ((principalPart as number) > (balance as number)) {
        principalPart = balance;
        amount = (principalPart + interest) as Cents;
      } else {
        amount = pmt;
      }
      balance = (balance - principalPart) as Cents;
    }

    installments.push({
      number: i,
      due_date: addDaysIso(startDate, daysStep * (i - 1)),
      amount,
      principal: principalPart,
      interest,
      balance_after: balance,
    });
  }

  return installments;
}

/**
 * Gera cronograma para modalidade 'interest_only' (só juros).
 *
 * Algoritmo:
 * 1. Cada parcela = balance * rate (apenas juros).
 * 2. Principal preservado integralmente até o vencimento.
 * 3. Última parcela: balance (principal total) + juros do período.
 *
 * Útil para produtos tipo "juros mensais + principal no fim".
 */
export function generateScheduleInterestOnly(
  principal: Cents,
  ratePerPeriod: string,
  periods: number,
  startDate: string,
  frequency: PaymentFrequency,
): readonly Installment[] {
  if (principal === 0) {
    return [];
  }
  const rate = Number.parseFloat(ratePerPeriod);
  const installments: Installment[] = [];
  const daysStep = daysBetween(frequency);
  const interestPerPeriod = cents(roundHalfEven(principal * rate));

  for (let i = 1; i <= periods; i++) {
    const isLast = i === periods;
    const amount = isLast ? ((principal + interestPerPeriod) as Cents) : interestPerPeriod;
    const principalPart = isLast ? principal : cents(0);
    const balanceAfter = isLast ? cents(0) : principal;

    installments.push({
      number: i,
      due_date: addDaysIso(startDate, daysStep * (i - 1)),
      amount,
      principal: principalPart,
      interest: interestPerPeriod,
      balance_after: balanceAfter,
    });
  }

  return installments;
}

/**
 * Dispatcher: gera cronograma conforme a modalidade do ProductSchema.
 * Apenas modalidades do CORE V1 v1 (fixed_installment, interest_only).
 */
export function generateSchedule(
  principal: Cents,
  schema: ProductSchema,
  periods: number,
  startDate: string,
): readonly Installment[] {
  switch (schema.modality) {
    case 'fixed_installment':
      return generateScheduleFixedInstallment(
        principal,
        schema.interest.rate_per_period,
        periods,
        startDate,
        schema.frequency,
      );
    case 'interest_only':
      return generateScheduleInterestOnly(
        principal,
        schema.interest.rate_per_period,
        periods,
        startDate,
        schema.frequency,
      );
    case 'bullet':
    case 'custom':
      throw new Error(`Modalidade '${schema.modality}' não implementada nesta sprint (FUTURO)`);
  }
}

/**
 * Valida invariantes do cronograma. Retorna array de erros (vazio se ok).
 * Usado em testes golden e na API para validar antes de persistir.
 */
export function validateScheduleInvariants(
  installments: readonly Installment[],
  originalPrincipal: Cents,
): readonly string[] {
  const errors: string[] = [];

  if (installments.length === 0 && originalPrincipal > 0) {
    errors.push('Cronograma vazio para principal > 0');
    return errors;
  }

  // Invariante 1: soma de principal === loan.principal (com tolerância de rounding)
  const sumPrincipal = installments.reduce((acc, i) => acc + (i.principal as unknown as number), 0);
  if (Math.abs(sumPrincipal - (originalPrincipal as unknown as number)) > installments.length) {
    errors.push(
      `Soma do principal (${sumPrincipal}) difere do original (${originalPrincipal}) em mais de ${installments.length} cents`,
    );
  }

  // Invariante 3: datas em ordem estritamente crescente
  for (let i = 1; i < installments.length; i++) {
    if (installments[i]!.due_date <= installments[i - 1]!.due_date) {
      errors.push(
        `Parcela ${i + 1} (${installments[i]!.due_date}) não é estritamente maior que anterior (${installments[i - 1]!.due_date})`,
      );
    }
  }

  // Invariante 4: nenhuma parcela negativa
  for (const inst of installments) {
    if ((inst.amount as unknown as number) < 0) {
      errors.push(`Parcela ${inst.number} tem amount negativo: ${inst.amount}`);
    }
    if ((inst.principal as unknown as number) < 0) {
      errors.push(`Parcela ${inst.number} tem principal negativo: ${inst.principal}`);
    }
    if ((inst.interest as unknown as number) < 0) {
      errors.push(`Parcela ${inst.number} tem interest negativo: ${inst.interest}`);
    }
  }

  return errors;
}
