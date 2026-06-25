-- 008_init_payments.sql
-- Cria a tabela payments (recebimentos).
-- Cada Payment eh' alocada em 1+ installments via payment_allocations.
--
-- method:
--   'manual'    - registrado manualmente pelo usuario
--   'pix'       - via integracao PIX (FUTURO)
--   'transfer'  - transferencia bancaria
--   'cash'      - pagamento em especie
--   'other'     - outros
--
-- correlation_id vem do header X-Correlation-Id da request HTTP,
-- permitindo rastreamento do pagamento ate o request que o criou.

CREATE TABLE IF NOT EXISTS payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contract_id     UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amount          BIGINT      NOT NULL,     -- valor total recebido (em centavos)
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  method          TEXT        NOT NULL DEFAULT 'manual'
                  CHECK (method IN ('manual', 'pix', 'transfer', 'cash', 'other')),
  notes           TEXT,
  correlation_id  UUID,                    -- para rastreamento (vem de X-Correlation-Id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(account_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(account_id, paid_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_account_isolation ON payments;
CREATE POLICY payments_account_isolation ON payments
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);
