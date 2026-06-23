import { describe, expect, it } from 'vitest';
import { addCents, cents, formatBrl, fromBrl, roundHalfEven, subCents } from '../src/money.js';

describe('money', () => {
  it('cents rejeita nao-inteiro', () => {
    expect(() => cents(1.5)).toThrow();
  });

  it('cents rejeita negativo', () => {
    expect(() => cents(-1)).toThrow();
  });

  it('addCents soma em centavos sem float drift', () => {
    const sum = addCents(cents(1), cents(2));
    expect(sum).toBe(3);
  });

  it('subCents recusa resultado negativo', () => {
    expect(() => subCents(cents(1), cents(2))).toThrow();
  });

  it('roundHalfEven arredonda 0.5 para par', () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(2.4)).toBe(2);
    expect(roundHalfEven(2.6)).toBe(3);
  });

  it('fromBrl converte string para centavos', () => {
    expect(fromBrl('R$ 1.234,56')).toBe(123456);
    expect(fromBrl('10')).toBe(1000);
  });

  it('formatBrl renderiza com locale pt-BR', () => {
    expect(formatBrl(cents(123456))).toBe('R$ 1.234,56');
  });
});
