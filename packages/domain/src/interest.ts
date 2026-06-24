/**
 * Cálculo de juros (simples e compostos).
 *
 * Convenções:
 * - Todos os valores monetários em Cents (inteiro).
 * - Taxas como string decimal (ex: "0.0299") para evitar float drift.
 * - Arredondamento: roundHalfEven (banker's rounding).
 *
 * Fórmulas (referência: docs/financial-engine.md):
 * - Juros simples: I = P * r * n
 * - Juros compostos: I = P * (1 + r)^n - P
 *
 * Onde P = principal em cents, r = taxa por período (decimal), n = número de períodos.
 */

import { cents, type Cents, roundHalfEven } from './money.js';

/**
 * Converte taxa de string decimal (ex: "0.0299") para número com precisao.
 * Usa multiplicação por 1_000_000 (6 casas decimais) para evitar float
 * em taxas comuns. Para taxas com mais casas, ajustar escala.
 */
function parseRate(rateString: string): number {
  const parsed = Number.parseFloat(rateString);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Taxa de juros inválida: ${rateString}`);
  }
  return parsed;
}

/**
 * Calcula juros SIMPLES para 1 período.
 * I = P * r
 *
 * @param principal Valor principal em Cents.
 * @param ratePerPeriod Taxa por período em string decimal (ex: "0.0299").
 * @returns Valor dos juros em Cents (arredondado banker's).
 */
export function simpleInterestOnePeriod(principal: Cents, ratePerPeriod: string): Cents {
  if (principal === 0) return cents(0);
  const rate = parseRate(ratePerPeriod);
  const interest = principal * rate;
  return cents(roundHalfEven(interest));
}

/**
 * Calcula juros SIMPLES para N períodos (linear).
 * I = P * r * n
 *
 * @param principal Valor principal em Cents.
 * @param ratePerPeriod Taxa por período em string decimal.
 * @param periods Número inteiro de períodos.
 * @returns Valor total dos juros em Cents.
 */
export function simpleInterest(principal: Cents, ratePerPeriod: string, periods: number): Cents {
  if (periods < 0 || !Number.isInteger(periods)) {
    throw new Error(`Períodos inválido: ${periods}`);
  }
  if (principal === 0 || periods === 0) return cents(0);
  const rate = parseRate(ratePerPeriod);
  const interest = principal * rate * periods;
  return cents(roundHalfEven(interest));
}

/**
 * Calcula juros COMPOSTOS para N período.
 * I = P * ((1 + r)^n - 1)
 *
 * @param principal Valor principal em Cents.
 * @param ratePerPeriod Taxa por período em string decimal.
 * @param periods Número inteiro de períodos.
 * @returns Valor total dos juros em Cents.
 *
 * NOTA: Para N grande, ((1+r)^n) pode exceder precisão de number.
 * Para agora, aceitamos essa limitação (max ~R$ 9 quadrilhões).
 * Migrar para bigint em sprint futura.
 */
export function compoundInterest(principal: Cents, ratePerPeriod: string, periods: number): Cents {
  if (periods < 0 || !Number.isInteger(periods)) {
    throw new Error(`Períodos inválido: ${periods}`);
  }
  if (principal === 0 || periods === 0) return cents(0);
  const rate = parseRate(ratePerPeriod);
  // Math.pow retorna number. Para N > 50, precisão degrada.
  const factor = Math.pow(1 + rate, periods);
  const interest = principal * (factor - 1);
  return cents(roundHalfEven(interest));
}

/**
 * Calcula juros pro-rata-die (proporcional aos dias).
 * Útil para multas, mora, e cálculos com pagamento parcial.
 *
 * I = P * r * (dias / dias_do_periodo)
 *
 * @param principal Valor em Cents.
 * @param ratePerPeriod Taxa por período completo.
 * @param days Número de dias transcorridos.
 * @param daysInPeriod Dias totais no período (default 30).
 * @returns Juros proporcionais em Cents.
 */
export function proRataInterest(
  principal: Cents,
  ratePerPeriod: string,
  days: number,
  daysInPeriod = 30,
): Cents {
  if (principal === 0 || days === 0) return cents(0);
  if (days < 0 || daysInPeriod <= 0) {
    throw new Error(`Dias inválidos: days=${days}, daysInPeriod=${daysInPeriod}`);
  }
  const rate = parseRate(ratePerPeriod);
  const interest = principal * rate * (days / daysInPeriod);
  return cents(roundHalfEven(interest));
}
