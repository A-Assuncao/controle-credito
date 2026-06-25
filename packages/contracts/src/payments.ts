import { z } from 'zod';

/**
 * Schemas Zod para payments (recebimentos) e payment_allocations.
 * EXE-002.3 (Sprint 3): registro de pagamentos com alocacao.
 *
 * Metodo: como o pagamento foi recebido.
 * - 'manual'   - registrado manualmente pelo usuario
 * - 'pix'      - via integracao PIX (FUTURO)
 * - 'transfer' - transferencia bancaria
 * - 'cash'     - pagamento em especie
 * - 'other'    - outros
 */
export const PaymentMethodSchema = z.enum(['manual', 'pix', 'transfer', 'cash', 'other']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * Schema de payment (recebimento) retornado pela API.
 */
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  amount: z.number().int().positive(), // cents
  paidAt: z.string().datetime(),
  method: PaymentMethodSchema,
  notes: z.string().nullable(),
  correlationId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;

/**
 * Body para criar um payment (POST /contracts/:id/payments).
 * O backend usa o motor de calculo (packages/domain) para alocar o valor
 * entre os buckets (mora → multa → juros → principal) nas installments em aberto.
 */
export const CreatePaymentSchema = z.object({
  amount: z.number().int().positive(), // cents
  paidAt: z.string().datetime().optional(), // default: now()
  method: PaymentMethodSchema.default('manual'),
  notes: z.string().max(500).optional(),
});
export type CreatePayment = z.infer<typeof CreatePaymentSchema>;

/**
 * Schema de alocacao de pagamento (resultado de POST /payments).
 * Cada payment eh' dividido em N alocacoes (1 por bucket: mora, multa, juros, principal).
 */
export const PaymentAllocationSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  installmentId: z.string().uuid(),
  bucket: z.enum(['mora', 'multa', 'juros', 'principal']),
  amount: z.number().int().positive(), // cents
  createdAt: z.string().datetime(),
});
export type PaymentAllocation = z.infer<typeof PaymentAllocationSchema>;

/**
 * Response completa de POST /payments, incluindo payment + allocations.
 */
export const CreatePaymentResponseSchema = z.object({
  payment: PaymentSchema,
  allocations: z.array(PaymentAllocationSchema),
  /** Sobra do pagamento (vira credito para proxima parcela) */
  credit: z.number().int().nonnegative(),
});
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;
