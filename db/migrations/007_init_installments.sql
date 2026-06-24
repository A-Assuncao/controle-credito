-- 007_init_installments.sql
-- Cria a tabela installments (parcelas).
-- Gerada a partir do motor de calculo (packages/domain/src/schedule.ts)
-- no momento de criacao do contrato. Status atualizado por payments.
--
-- status:
--   'open'         - nao paga (ainda dentro do prazo ou em dia)
--   'paid'         - totalmente paga
--   'partial'      - paga parcialmente (paid_amount < amount)
--   'overdue'      - vencida e nao paga (atualizado por job/cron - FUTURO)
--   'renegotiated' - substituida por nova parcela (ver v2 - renegociacao)

CREATE TABLE IF NOT EXISTS installments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contract_id     UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  number          INTEGER     NOT NULL,      -- 1-indexed
  due_date        DATE        NOT NULL,
  amount          BIGINT      NOT NULL,      -- em centavos
  principal       BIGINT      NOT NULL,
  interest        BIGINT      NOT NULL,
  balance_after   BIGINT      NOT NULL,      -- saldo devedor APOS esta parcela
  status          TEXT        NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'paid', 'partial', 'overdue', 'renegotiated')),
  paid_amount     BIGINT      NOT NULL DEFAULT 0,    -- total pago (pode ser parcial)
  paid_at         TIMESTAMPTZ,                       -- quando foi totalmente paga
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, number)                        -- uma parcela por numero
);

CREATE INDEX IF NOT EXISTS idx_installments_account ON installments(account_id);
CREATE INDEX IF NOT EXISTS idx_installments_contract ON installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(account_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(account_id, due_date)
  WHERE status IN ('open', 'overdue');  -- indice parcial: so' parcelas em aberto

ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installments_account_isolation ON installments;
CREATE POLICY installments_account_isolation ON installments
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

DROP TRIGGER IF EXISTS installments_touch_updated_at ON installments;
CREATE TRIGGER installments_touch_updated_at
  BEFORE UPDATE ON installments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
