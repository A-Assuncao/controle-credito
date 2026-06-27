-- 010_init_cash_wallets.sql
-- Cria a tabela cash_wallets (carteiras de caixa) - base do modulo de Caixa
-- (EXE-003, master-plan secao 16).
--
-- Cada Account pode ter N carteiras (operating, reserve, pix, cash, other).
-- Saldo de cada carteira eh projecao deterministica da soma de financial_events
-- validos (master-plan 16.1) - nao armazenamos saldo na wallet para evitar
-- drift; a verdade eh o ledger (migration 011).
--
-- kind:
--   'operating' - carteira principal de operacao do dia-a-dia
--   'reserve'   - fundo de reserva / provisao
--   'pix'       - conta dedicada a recebimentos PIX (FUTURO integracao)
--   'cash'      - caixa fisico (especie)
--   'other'     - outras finalidades customizadas
--
-- Soft-delete via is_active=false (mantem historico de eventos consistente;
-- financial_events eh append-only e referencia wallet_id).

CREATE TABLE IF NOT EXISTS cash_wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  kind        TEXT        NOT NULL DEFAULT 'operating'
              CHECK (kind IN ('operating', 'reserve', 'pix', 'cash', 'other')),
  currency    TEXT        NOT NULL DEFAULT 'BRL',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade do nome por account (evita "Carteira 1", "Carteira 1" do mesmo user).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_wallets_account_name
  ON cash_wallets(account_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_cash_wallets_account
  ON cash_wallets(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_wallets_active
  ON cash_wallets(account_id, is_active);

ALTER TABLE cash_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_wallets FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_wallets_account_isolation ON cash_wallets;
CREATE POLICY cash_wallets_account_isolation ON cash_wallets
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

DROP TRIGGER IF EXISTS cash_wallets_touch_updated_at ON cash_wallets;
CREATE TRIGGER cash_wallets_touch_updated_at
  BEFORE UPDATE ON cash_wallets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
