import { describe, expect, it } from 'vitest';
import { cents, type Cents } from '../src/money.js';
import {
  addDaysIso,
  daysBetween,
  fixedInstallment,
  generateSchedule,
  generateScheduleFixedInstallment,
  generateScheduleInterestOnly,
  validateScheduleInvariants,
} from '../src/schedule.js';
import type { ProductSchema } from '../src/productSchema.js';

describe('schedule', () => {
  describe('addDaysIso', () => {
    it('adiciona dias a uma data ISO', () => {
      expect(addDaysIso('2026-01-15', 7)).toBe('2026-01-22');
    });

    it('adiciona 0 dias retorna mesma data', () => {
      expect(addDaysIso('2026-01-15', 0)).toBe('2026-01-15');
    });
  });

  describe('daysBetween', () => {
    it('weekly = 7', () => {
      expect(daysBetween('weekly')).toBe(7);
    });

    it('biweekly = 14', () => {
      expect(daysBetween('biweekly')).toBe(14);
    });

    it('monthly = 30', () => {
      expect(daysBetween('monthly')).toBe(30);
    });

    it('custom throw', () => {
      expect(() => daysBetween('custom')).toThrow();
    });
  });

  describe('fixedInstallment (Price)', () => {
    it('taxa zero divide principal igualmente', () => {
      // 1000 / 5 = 200
      expect(fixedInstallment(cents(1_000), '0', 5)).toBe(200);
    });

    it('calcula PMT Price com taxa > 0', () => {
      // PMT = 100000 * (0.0299 * 1.0299^10) / (1.0299^10 - 1)
      // = 100000 * (0.04015...) / (0.34261...) ≈ 11717
      const pmt = fixedInstallment(cents(100_000), '0.0299', 10);
      // Verifica que está próximo (taxa Price)
      expect(pmt).toBeGreaterThan(11_700);
      expect(pmt).toBeLessThan(11_750);
    });

    it('rejeita periods 0', () => {
      expect(() => fixedInstallment(cents(1_000), '0.05', 0)).toThrow();
    });

    it('retorna 0 para principal 0', () => {
      expect(fixedInstallment(cents(0), '0.05', 5)).toBe(0);
    });
  });

  describe('generateScheduleFixedInstallment', () => {
    it('gera cronograma Price mensal de 12 parcelas', () => {
      const schedule = generateScheduleFixedInstallment(
        cents(100_000),
        '0.0299',
        12,
        '2026-01-15',
        'monthly',
      );
      expect(schedule).toHaveLength(12);
      expect(schedule[0]!.number).toBe(1);
      expect(schedule[0]!.due_date).toBe('2026-01-15');
      expect(schedule[11]!.number).toBe(12);
      // monthly = 30 dias/step, 12 parcelas -> 11 steps = 330 dias
      // 2026-01-15 + 330 dias = 2026-12-11
      expect(schedule[11]!.due_date).toBe('2026-12-11');
    });

    it('datas em ordem estritamente crescente', () => {
      const schedule = generateScheduleFixedInstallment(
        cents(10_000),
        '0.05',
        6,
        '2026-01-01',
        'weekly',
      );
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i]!.due_date > schedule[i - 1]!.due_date).toBe(true);
      }
    });

    it('nenhuma parcela negativa', () => {
      const schedule = generateScheduleFixedInstallment(
        cents(50_000),
        '0.10',
        24,
        '2026-01-01',
        'monthly',
      );
      for (const inst of schedule) {
        expect((inst.amount as unknown as number)).toBeGreaterThan(0);
        expect((inst.principal as unknown as number)).toBeGreaterThanOrEqual(0);
        expect((inst.interest as unknown as number)).toBeGreaterThanOrEqual(0);
      }
    });

    it('soma do principal === loan.principal (invariante)', () => {
      const principal = cents(100_000);
      const schedule = generateScheduleFixedInstallment(
        principal,
        '0.0299',
        12,
        '2026-01-15',
        'monthly',
      );
      const sumPrincipal = schedule.reduce(
        (acc, i) => acc + (i.principal as unknown as number),
        0,
      );
      // Tolerância: até 1 cent por parcela (arredondamento)
      expect(Math.abs(sumPrincipal - (principal as unknown as number))).toBeLessThanOrEqual(
        schedule.length,
      );
    });

    it('retorna array vazio para principal 0', () => {
      const schedule = generateScheduleFixedInstallment(
        cents(0),
        '0.05',
        10,
        '2026-01-01',
        'monthly',
      );
      expect(schedule).toHaveLength(0);
    });

    it('cronograma semanal (frequency=weekly)', () => {
      const schedule = generateScheduleFixedInstallment(
        cents(1_000),
        '0.05',
        4,
        '2026-01-01',
        'weekly',
      );
      expect(schedule[0]!.due_date).toBe('2026-01-01');
      expect(schedule[1]!.due_date).toBe('2026-01-08');
      expect(schedule[2]!.due_date).toBe('2026-01-15');
      expect(schedule[3]!.due_date).toBe('2026-01-22');
    });
  });

  describe('generateScheduleInterestOnly', () => {
    it('gera cronograma só juros', () => {
      const schedule = generateScheduleInterestOnly(
        cents(10_000),
        '0.05',
        6,
        '2026-01-15',
        'monthly',
      );
      expect(schedule).toHaveLength(6);
      // Cada parcela é apenas os juros (5% de 10000 = 500)
      for (let i = 0; i < 5; i++) {
        expect((schedule[i]!.interest as unknown as number)).toBe(500);
        expect((schedule[i]!.principal as unknown as number)).toBe(0);
        expect((schedule[i]!.amount as unknown as number)).toBe(500);
        expect((schedule[i]!.balance_after as unknown as number)).toBe(10_000);
      }
    });

    it('última parcela = principal + juros', () => {
      const schedule = generateScheduleInterestOnly(
        cents(10_000),
        '0.05',
        6,
        '2026-01-15',
        'monthly',
      );
      const last = schedule[5]!;
      expect((last.principal as unknown as number)).toBe(10_000);
      expect((last.interest as unknown as number)).toBe(500);
      expect((last.amount as unknown as number)).toBe(10_500);
      expect((last.balance_after as unknown as number)).toBe(0);
    });
  });

  describe('generateSchedule (dispatcher)', () => {
    const priceSchema: ProductSchema = {
      id: 'schema-price-1',
      version: 1,
      status: 'active',
      tenant_id: 'tenant-1',
      name: 'Price Test',
      modality: 'fixed_installment',
      frequency: 'monthly',
      interest: { type: 'simple', rate_per_period: '0.0299' },
      penalty: { grace_days: 5 },
      early_settlement: { method: 'prospectus' },
      rounding: 'HALF_EVEN',
      effective_from: '2026-01-01',
    };

    const interestOnlySchema: ProductSchema = {
      ...priceSchema,
      modality: 'interest_only',
    };

    it('dispatcha para fixed_installment', () => {
      const schedule = generateSchedule(cents(10_000), priceSchema, 5, '2026-01-01');
      expect(schedule).toHaveLength(5);
    });

    it('dispatcha para interest_only', () => {
      const schedule = generateSchedule(cents(10_000), interestOnlySchema, 5, '2026-01-01');
      expect(schedule).toHaveLength(5);
      // Todos os 4 primeiros são só juros
      for (let i = 0; i < 4; i++) {
        expect((schedule[i]!.principal as unknown as number)).toBe(0);
      }
    });

    it('rejeita bullet (não implementado nesta sprint)', () => {
      const bulletSchema: ProductSchema = {
        ...priceSchema,
        modality: 'bullet',
      };
      expect(() => generateSchedule(cents(10_000), bulletSchema, 5, '2026-01-01')).toThrow();
    });
  });

  describe('validateScheduleInvariants', () => {
    it('retorna array vazio para cronograma válido', () => {
      const schedule = generateScheduleFixedInstallment(
        cents(10_000),
        '0.05',
        6,
        '2026-01-01',
        'monthly',
      );
      const errors = validateScheduleInvariants(schedule, cents(10_000));
      expect(errors).toEqual([]);
    });

    it('detecta cronograma vazio para principal > 0', () => {
      const errors = validateScheduleInvariants([], cents(10_000));
      expect(errors).toContain('Cronograma vazio para principal > 0');
    });
  });
});
