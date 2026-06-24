import { describe, expect, it } from 'vitest';
import { cents } from '../src/money.js';
import {
  allocátionPayment,
  DEFAULT_ALLOCATION_ORDER,
  type InstallmentBalance,
} from '../src/allocátion.js';

describe('allocátion', () => {
  it('ordem default é mora → multa → juros → principal', () => {
    expect(DEFAULT_ALLOCATION_ORDER).toEqual(['mora', 'multa', 'juros', 'principal']);
  });

  it('aloca pagamento completo (cobre todos os buckets)', () => {
    const balance: InstallmentBalance = {
      mora: cents(100),
      multa: cents(50),
      juros: cents(200),
      principal: cents(1_000),
    };
    const result = allocátionPayment(balance, cents(1_350));
    expect(result.allocations).toHaveLength(4);
    expect(result.credit).toBe(0);
    expect(result.allocations[0]).toEqual({ bucket: 'mora', applied: cents(100) });
    expect(result.allocations[1]).toEqual({ bucket: 'multa', applied: cents(50) });
    expect(result.allocations[2]).toEqual({ bucket: 'juros', applied: cents(200) });
    expect(result.allocations[3]).toEqual({ bucket: 'principal', applied: cents(1_000) });
  });

  it('alocação parcial (não cobre principal)', () => {
    const balance: InstallmentBalance = {
      mora: cents(100),
      multa: cents(50),
      juros: cents(200),
      principal: cents(1_000),
    };
    const result = allocátionPayment(balance, cents(250));
    // Mora(100) + Multa(50) + Juros(100 de 200) = 250. Sobra 0.
    expect(result.allocations).toHaveLength(3);
    expect(result.allocations[0]).toEqual({ bucket: 'mora', applied: cents(100) });
    expect(result.allocations[1]).toEqual({ bucket: 'multa', applied: cents(50) });
    expect(result.allocations[2]).toEqual({ bucket: 'juros', applied: cents(100) });
    expect(result.credit).toBe(0);
  });

  it('pagamento com sobra vira crédito', () => {
    const balance: InstallmentBalance = {
      mora: cents(0),
      multa: cents(0),
      juros: cents(0),
      principal: cents(1_000),
    };
    const result = allocátionPayment(balance, cents(1_500));
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({ bucket: 'principal', applied: cents(1_000) });
    expect(result.credit).toBe(500);
  });

  it('respeita buckets com saldo 0 (pula)', () => {
    const balance: InstallmentBalance = {
      mora: cents(0),
      multa: cents(50),
      juros: cents(0),
      principal: cents(1_000),
    };
    const result = allocátionPayment(balance, cents(500));
    // Mora(0 pula) + Multa(50) + Juros(0 pula) + Principal(450 de 1k) = 500
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toEqual({ bucket: 'multa', applied: cents(50) });
    expect(result.allocations[1]).toEqual({ bucket: 'principal', applied: cents(450) });
  });

  it('pagamento = 0 não aloca nada', () => {
    const balance: InstallmentBalance = {
      mora: cents(100),
      multa: cents(50),
      juros: cents(200),
      principal: cents(1_000),
    };
    const result = allocátionPayment(balance, cents(0));
    expect(result.allocations).toHaveLength(0);
    expect(result.credit).toBe(0);
  });
});
