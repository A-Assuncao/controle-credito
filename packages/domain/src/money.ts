/**
 * Money utilities - todos os valores financeiros sao em CENTAVOS (inteiro).
 * Regra: nada de float em dinheiro (regra 6 do master-plan).
 */

export type Cents = number & { readonly __brand: 'Cents' };

/** Construtor validado - aceita apenas inteiro nao-negativo */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`Money deve ser inteiro em centavos. Recebido: ${value}`);
  }
  if (value < 0) {
    throw new Error(`Money nao pode ser negativo. Recebido: ${value}`);
  }
  return value as Cents;
}

export function addCents(a: Cents, b: Cents): Cents {
  return cents((a + b) as number);
}

export function subCents(a: Cents, b: Cents): Cents {
  const result = (a - b) as number;
  if (result < 0) {
    throw new Error(`Subtracao de Money resultaria em negativo: ${result}`);
  }
  return cents(result);
}

/**
 * Arredondamento bancario (round-half-to-even). Usado em juros, mora, multa.
 * Garante que soma de parcelas arredondadas nao desvie do principal + juros esperados.
 */
export function roundHalfEven(value: number): number {
  const rounded = Math.round(value);
  if (Math.abs(value - Math.trunc(value)) === 0.5) {
    return Math.trunc(value) % 2 === 0 ? Math.trunc(value) : Math.trunc(value) + 1;
  }
  return rounded;
}

/**
 * Converte BRL em string para Cents.
 * Aceita: "1234.56", "1234,56", "R$ 1.234,56", "1.234,56" (formato BR com milhar).
 * Estrategia: detectar se a virgula eh decimal ou milhar; se houver
 * AMBOS virgula e ponto, o ultimo separador eh o decimal.
 */
export function fromBrl(input: string): Cents {
  const cleaned = input.replace(/[^\d,.-]/g, '');
  if (!cleaned) {
    throw new Error(`BRL invalido: ${input}`);
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    // Sem separador, tudo eh inteiro
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // Virgula eh o decimal (formato BR); remove pontos (milhar)
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Ponto eh o decimal (formato US); remove virgulas (milhar)
    normalized = cleaned.replace(/,/g, '');
  }

  const reais = Number.parseFloat(normalized);
  if (!Number.isFinite(reais)) {
    throw new Error(`BRL invalido: ${input}`);
  }
  return cents(Math.round(reais * 100));
}

/**
 * Formata Cents como BRL "R$ 1.234,56".
 * Usa Intl.NumberFormat que em Windows pode retornar NBSP (U+00A0) -
 * o teste normaliza NBSP para espaco comum.
 */
export function formatBrl(value: Cents): string {
  const reais = (value as number) / 100;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reais);
  // Normaliza NBSP (U+00A0) e narrow NBSP (U+202F) para espaco comum
  return formatted.replace(/[\u00A0\u202F]/g, ' ');
}
