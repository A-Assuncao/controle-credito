import { describe, expect, it } from 'vitest';
import { cents } from '../src/money.js';
import { dailyPenalty, fixedPenalty, totalPenalty } from '../src/penalty.js';
import type { PenaltyParams } from '../src/productSchema.js';

describe('penalty', () => {
  const standardParams: PenaltyParams = {
    fixed: '0.02', // 2% multa
    daily: '0.001', // 0.1% mora ao dia
    grace_days: 5,
  };

  describe('fixedPenalty', () => {
    it('retorna 0 dentro do período de carência', () => {
      // 3 dias atraso < 5 dias carência
      expect(fixedPenalty(cents(10_000), standardParams, 3)).toBe(0);
    });

    it('calcula multa fixa após carência', () => {
      // 10 dias atraso > 5 dias carência
      // 10000 * 0.02 = 200
      expect(fixedPenalty(cents(10_000), standardParams, 10)).toBe(200);
    });

    it('retorna 0 se não tem multa fixa configurada', () => {
      const noFixed: PenaltyParams = { grace_days: 0 };
      expect(fixedPenalty(cents(10_000), noFixed, 10)).toBe(0);
    });

    it('retorna 0 para valor 0', () => {
      expect(fixedPenalty(cents(0), standardParams, 10)).toBe(0);
    });
  });

  describe('dailyPenalty', () => {
    it('retorna 0 dentro do período de carência', () => {
      expect(dailyPenalty(cents(10_000), standardParams, 3)).toBe(0);
    });

    it('calcula mora diária após carência (apenas dias após carência)', () => {
      // 10 dias atraso - 5 carência = 5 dias de mora
      // 10000 * 0.001 * 5 = 50
      expect(dailyPenalty(cents(10_000), standardParams, 10)).toBe(50);
    });

    it('retorna 0 se não tem mora diária configurada', () => {
      const noDaily: PenaltyParams = { grace_days: 0 };
      expect(dailyPenalty(cents(10_000), noDaily, 10)).toBe(0);
    });
  });

  describe('totalPenalty', () => {
    it('soma multa fixa + mora diária', () => {
      // 10 dias = 200 (fixa) + 50 (mora) = 250
      expect(totalPenalty(cents(10_000), standardParams, 10)).toBe(250);
    });

    it('retorna 0 dentro da carência', () => {
      expect(totalPenalty(cents(10_000), standardParams, 3)).toBe(0);
    });
  });
});
