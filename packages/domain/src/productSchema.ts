/**
 * ProductSchema - tipo TypeScript que define a estrutura versionada
 * de um produto financeiro.
 *
 * Cada Contract referencia um (schema_id, version) congelado.
 * Mudanca de qualquer campo = nova version.
 *
 * Parametrizacao: juros (simples/composto), frequencia (semanal/
 * quinzenal/mensal), carencia, multa, mora, quitacao antecipada.
 * Detalhes em docs/financial-engine.md secao 5.
 */

import type { Cents } from './money.js';

/**
 * Frequencia de pagamento (periodicidade das parcelas).
 * 'custom' eh placeholder para extensoes via plugins (FUTURO).
 */
export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

/**
 * Modalidade de amortizacao.
 * - 'fixed_installment' (Price): parcela fixa de principal + juros.
 * - 'interest_only': paga so os juros; principal preservado ate vencimento.
 * - 'bullet': juros acumulados; principal no vencimento.
 * - 'custom': plugins via interface ScheduleGenerator (FUTURO).
 */
export type ContractModality = 'fixed_installment' | 'interest_only' | 'bullet' | 'custom';

/**
 * Tipo de juros: simples (linear) ou composto (juros sobre juros).
 */
export type InterestType = 'simple' | 'compound';

/**
 * Capitalizacao de juros: diaria ou mensal.
 * Apenas faz sentido para InterestType='compound'.
 */
export type Capitalization = 'daily' | 'monthly';

/**
 * Politica de quitacao antecipada.
 * - 'prospectus': segue o que o contrato determina (desconto sobre juros
 *   futuros, ou sem desconto).
 * - 'simple_deduction': desconto linear dos juros futuros proporcional
 *   ao tempo restante.
 */
export type EarlySettlementMethod = 'prospectus' | 'simple_deduction';

/**
 * Politica de arredondamento. HALF_EVEN (banker's rounding) eh o default
 * e ja' implementado em money.ts (roundHalfEven).
 */
export type RoundingPolicy = 'HALF_EVEN' | 'HALF_UP' | 'HALF_DOWN';

/**
 * Status do schema de produto.
 * - 'draft': em elaboracao, nao pode ser usado em contratos.
 * - 'active': pode ser usado em novos contratos.
 * - 'deprecated': nao deve ser usado em novos contratos; contratos
 *   existentes continuam usando a versao congelada.
 */
export type ProductSchemaStatus = 'draft' | 'active' | 'deprecated';

/**
 * Parametros de juros.
 * rate_per_period eh a taxa por periodo (em decimal, ex: 0.0299 = 2.99% a.m.).
 */
export interface InterestParams {
  readonly type: InterestType;
  readonly rate_per_period: string; // decimal como string (bigint-safe)
  readonly capitalization?: Capitalization;
}

/**
 * Parametros de penalidade.
 * - fixed: % fixa de multa sobre o valor da parcela.
 * - daily: % de mora ao dia sobre o valor da parcela.
 * - grace_days: dias de carencia antes de aplicar multa/mora.
 */
export interface PenaltyParams {
  readonly fixed?: string; // % fixa de multa (decimal string)
  readonly daily?: string; // % de mora diaria (decimal string)
  readonly grace_days: number;
}

/**
 * Parametros de quitacao antecipada.
 * deduction_rate eh a taxa de desconto aplicada sobre os juros
 * futuros (apenas para 'simple_deduction').
 */
export interface EarlySettlementParams {
  readonly method: EarlySettlementMethod;
  readonly deduction_rate?: string;
}

/**
 * ProductSchema completo - versao imutavel de um produto financeiro.
 * Cada Contract referencia (id, version) - nunca a "ultima ativa".
 */
export interface ProductSchema {
  readonly id: string;
  readonly version: number; // semver (major.minor.patch)
  readonly status: ProductSchemaStatus;
  readonly tenant_id: string;
  readonly name: string;
  readonly modality: ContractModality;
  readonly frequency: PaymentFrequency;
  readonly interest: InterestParams;
  readonly penalty: PenaltyParams;
  readonly early_settlement: EarlySettlementParams;
  readonly rounding: RoundingPolicy;
  /** ISO 8601 date (YYYY-MM-DD) a partir da qual esta versao eh valida */
  readonly effective_from: string;
}

/**
 * Type guard: verifica se uma versao de ProductSchema eh usavel em
 * novos contratos (status 'active' + effective_from <= data de referencia).
 */
export function isSchemaUsable(
  schema: ProductSchema,
  asOf: string, // ISO date
): boolean {
  return schema.status === 'active' && schema.effective_from <= asOf;
}

/**
 * Representacao de uma parcela gerada pelo motor.
 * Valor em Cents (nunca float) para precisao financeira.
 */
export interface Installment {
  /** Numero sequencial da parcela (1-indexed) */
  readonly number: number;
  /** Data de vencimento ISO 8601 (YYYY-MM-DD) */
  readonly due_date: string;
  /** Valor total da parcela (principal + juros) */
  readonly amount: Cents;
  /** Componente de principal */
  readonly principal: Cents;
  /** Componente de juros */
  readonly interest: Cents;
  /** Saldo devedor APOS o pagamento desta parcela */
  readonly balance_after: Cents;
}
