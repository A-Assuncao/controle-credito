-- 011_init_financial_events.sql
-- Cria o ledger append-only financial_events (master-plan 16.1, 16.2).
--
-- Cada evento eh imutavel (UPDATE e DELETE bloqueados por trigger, mesma
-- politica do audit_log 003). Saldo de qualquer carteira = soma dos eventos
-- validos (master-plan 16.1).
--
-- event_type (master-plan 16.2 - minimo obrigatorio):
--   'loan_disbursement'              - desembolso de emprestimo (saida da wallet)
--   'installment_payment_received'   - recebimento automatico via pagamento
--   'interest_recognized'            - reconhecimento contabil de juros
--   'penalty_applied'                - aplicacao de multa/mora
--   'manual_cash_in'                 - entrada manual de caixa
--   'manual_cash_out'                - saida manual de caixa
--   'owner_contribution'             - aporte do dono (entrada)
--   'owner_withdrawal'               - retirada do dono (saida)
--   'reversal'                       - estorno de evento anterior (compensatorio)
--   'period_close_adjustment'        - ajuste de fechamento
--
-- amount: BIGINT signed em centavos. Positivo = entrada, negativo = saida.
--   direction eh implicita no sinal; nunca armazenamos amount=0.
--
-- reference_type + reference_id: vinculo polimorfico opcional a registros-fonte
--   (ex: 'contract'/'installment'/'payment'/'manual'). Permite reconciliacao
--   sem duplicar dados.
--
-- correlation_id: para rastreamento ate X-Correlation-Id da request HTTP,
--   mesmo padrao do payments (008).
--
-- effective_at vs recorded_at: effective eh "quando o evento vale no mundo
--   real" (pode ser retroativo em backfill); recorded eh "quando entrou no
--   sistema" (imutavel). Diferenca sinaliza backfill legitimo para auditoria.
--
-- Fechamento (master-plan 16.3) gera closing_snapshot com hash de integridade
-- - sera migration futura (012+). Por enquanto, sem restricao de retroativo
--   alem do append-only.

CREATE TABLE IF NOT EXISTS financial_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  wallet_id       UUID        NOT NULL REFERENCES cash_wallets(id) ON DELETE RESTRICT,
  event_type      TEXT        NOT NULL
                  CHECK (event_type IN (
                    'loan_disbursement',
                    'installment_payment_received',
                    'interest_recognized',
                    'penalty_applied',
                    'manual_cash_in',
                    'manual_cash_out',
                    'owner_contribution',
                    'owner_withdrawal',
                    'reversal',
                    'period_close_adjustment'
                  )),
  amount          BIGINT      NOT NULL CHECK (amount <> 0),
  reference_type  TEXT,
  reference_id    UUID,
  correlation_id  UUID,
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID
);

-- Projecao de saldo = SUM(amount) por wallet. Index principal do ledger.
CREATE INDEX IF NOT EXISTS idx_financial_events_wallet_time
  ON financial_events(account_id, wallet_id, effective_at DESC, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_account
  ON financial_events(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_type
  ON financial_events(account_id, event_type, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_events_reference
  ON financial_events(account_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_events_correlation
  ON financial_events(account_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_events FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_events_account_isolation ON financial_events;
CREATE POLICY financial_events_account_isolation ON financial_events
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

-- Append-only enforcement (master-plan 16.1: "ledger de eventos eh append-only").
CREATE OR REPLACE FUNCTION financial_events_block_mutations() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'financial_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_events_no_update ON financial_events;
CREATE TRIGGER financial_events_no_update
  BEFORE UPDATE ON financial_events
  FOR EACH ROW EXECUTE FUNCTION financial_events_block_mutations();

DROP TRIGGER IF EXISTS financial_events_no_delete ON financial_events;
CREATE TRIGGER financial_events_no_delete
  BEFORE DELETE ON financial_events
  FOR EACH ROW EXECUTE FUNCTION financial_events_block_mutations();
