-- 009_init_payment_allocations.sql
-- Cria a tabela payment_allocations (alocacao de pagamento por bucket).
-- Cada Payment eh' dividida em N alocacoes (1 por bucket: mora, multa, juros, principal).
--
-- bucket:
--   'mora'       - juros de atraso acumulados
--   'multa'      - % fixa de multa
--   'juros'       - juros correntes da parcela
--   'principal'   - amortizacao do principal
--
-- Invariante: sum(amount de alocacoes de um payment) === payment.amount
-- (sobra vira credito - ver allocátion.ts no domain).

CREATE TABLE IF NOT EXISTS payment_allocations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payment_id      UUID        NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  installment_id  UUID        NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  bucket          TEXT        NOT NULL
                  CHECK (bucket IN ('mora', 'multa', 'juros', 'principal')),
  amount          BIGINT      NOT NULL,    -- em centavos
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_account ON payment_allocations(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_installment ON payment_allocations(installment_id);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_allocations_account_isolation ON payment_allocations;
CREATE POLICY payment_allocations_account_isolation ON payment_allocations
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);
