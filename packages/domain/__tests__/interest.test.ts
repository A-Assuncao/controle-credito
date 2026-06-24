import { describe, expect, it } from 'vitest';
import { cents } from '../src/money.js';
import {
  compoundInterest,
  proRataInterest,
  simpleInterest,
  simpleInterestOnePeriod,
} from '../src/interest.js';

describe('interest', () => {
  describe('simpleInterestOnePeriod', () => {
    it('retorna 0 para principal 0', () => {
      expect(simpleInterestOnePeriod(cents(0), '0.05')).toBe(0);
    });

    it('calcula juros simples para 1 período', () => {
      // I = P * r = 100000 * 0.05 = 5000
      expect(simpleInterestOnePeriod(cents(100_000), '0.05')).toBe(5_000);
    });

    it('aceita taxa como string decimal', () => {
      // I = 1000 * 0.0299 = 29.9 -> 30
      expect(simpleInterestOnePeriod(cents(1_000), '0.0299')).toBe(30);
    });

    it('rejeita taxa inválida', () => {
      expect(() => simpleInterestOnePeriod(cents(1_000), 'invalid')).toThrow();
    });
  });

  describe('simpleInterest', () => {
    it('retorna 0 para principal 0', () => {
      expect(simpleInterest(cents(0), '0.05', 5)).toBe(0);
    });

    it('retorna 0 para 0 períodos', () => {
      expect(simpleInterest(cents(1_000), '0.05', 0)).toBe(0);
    });

    it('calcula juros lineares (I = P * r * n)', () => {
      // I = 100000 * 0.05 * 12 = 60000
      expect(simpleInterest(cents(100_000), '0.05', 12)).toBe(60_000);
    });

    it('rejeita períodos negativo', () => {
      expect(() => simpleInterest(cents(1_000), '0.05', -1)).toThrow();
    });

    it('rejeita período não-inteiro', () => {
      expect(() => simpleInterest(cents(1_000), '0.05', 1.5)).toThrow();
    });
  });

  describe('compoundInterest', () => {
    it('retorna 0 para principal 0', () => {
      expect(compoundInterest(cents(0), '0.05', 5)).toBe(0);
    });

    it('retorna 0 para 0 períodos', () => {
      expect(compoundInterest(cents(1_000), '0.05', 0)).toBe(0);
    });

    it('calcula juros compostos para 1 período = simples', () => {
      // I = P * ((1+r)^1 - 1) = P * r (mesma coisa que simples para n=1)
      // I = 100000 * 0.05 = 5000
      expect(compoundInterest(cents(100_000), '0.05', 1)).toBe(5_000);
    });

    it('calcula juros compostos para múltiplos períodos', () => {
      // I = 100000 * ((1.05)^5 - 1) ≈ 100000 * 0.27628 = 27628 (banker's rounding)
      const result = compoundInterest(cents(100_000), '0.05', 5);
      // Verifica que está próximo de 27628 (com tolerance por rounding)
      expect(result).toBeGreaterThan(27_600);
      expect(result).toBeLessThan(27_700);
    });

    it('juros compostos > juros simples para n > 1', () => {
      const simples = simpleInterest(cents(100_000), '0.05', 5);
      const compostos = compoundInterest(cents(100_000), '0.05', 5);
      expect(compostos).toBeGreaterThan(simples);
    });
  });

  describe('proRataInterest', () => {
    it('retorna 0 para 0 dias', () => {
      expect(proRataInterest(cents(1_000), '0.05', 0, 30)).toBe(0);
    });

    it('calcula juros proporcionais aos dias', () => {
      // I = 1000 * 0.05 * (15/30) = 25
      expect(proRataInterest(cents(1_000), '0.05', 15, 30)).toBe(25);
    });

    it('rejeita dias negativos', () => {
      expect(() => proRataInterest(cents(1_000), '0.05', -1, 30)).toThrow();
    });

    it('rejeita período inválido', () => {
      expect(() => proRataInterest(cents(1_000), '0.05', 15, 0)).toThrow();
    });
  });
});
