-- 006_init_contracts.sql
-- Cria a tabela contracts (contratos de emprestimo).
-- Cada Contract referencia um (product_schema_id, product_version) CONGELADO.
--
-- FK logica para product_schemas: enforced por trigger + RLS (mesmo
-- account_id), nao FK direta porque product_schemas eh' versionada e
-- queremos permitir deletar product_schemas antigos sem perder historico.
--
-- status:
--   'active' - contrato vigente, com parcelas em aberto
--   'completed' - todas as parcelas pagas
--   'canceled' - cancelado antes do termino
--   'renegotiated' - substituído por outro contrato (ver v2 - renegociacao)

CREATE TABLE IF NOT EXISTS contracts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  party_id            UUID        NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  product_schema_id   UUID        NOT NULL,
  product_version     INTEGER     NOT NULL,
  principal           BIGINT      NOT NULL,    -- em centavos
  rate_per_period     TEXT        NOT NULL,    -- decimal como string
  periods             INTEGER     NOT NULL,     -- numero total de parcelas
  modality            TEXT        NOT NULL,
  frequency           TEXT        NOT NULL,
  start_date          DATE        NOT NULL,    -- data de desembolso
  status              TEXT        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'completed', 'canceled', 'renegotiated')),
  disbursed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_account ON contracts(account_id);
CREATE INDEX IF NOT EXISTS idx_contracts_party ON contracts(account_id, party_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(account_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_product ON contracts(account_id, product_schema_id, product_version);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contracts_account_isolation ON contracts;
CREATE POLICY contracts_account_isolation ON contracts
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

DROP TRIGGER IF EXISTS contracts_touch_updated_at ON contracts;
CREATE TRIGGER contracts_touch_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
