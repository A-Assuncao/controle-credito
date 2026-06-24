-- 005_init_product_schemas.sql
-- Cria a tabela product_schemas (versionamento de produto financeiro).
-- Cada Contract referencia (id, version) CONGELADO - nunca "ultima ativa"
-- (regra 14.3 do master-plan - invariante de dominio obrigatorio).
--
-- Mudanca de qualquer campo = nova versao.
-- config eh JSONB com shape do ProductSchema (interest, penalty, etc)
-- tipado em packages/domain/src/productSchema.ts.

CREATE TABLE IF NOT EXISTS product_schemas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  version         INTEGER     NOT NULL,    -- semver major
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'active', 'deprecated')),
  name            TEXT        NOT NULL,
  modality        TEXT        NOT NULL
                              CHECK (modality IN ('fixed_installment', 'interest_only', 'bullet', 'custom')),
  frequency       TEXT        NOT NULL
                              CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  config          JSONB       NOT NULL,    -- shape do ProductSchema (tipado em TS)
  effective_from  DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id, version)                      -- (id, version) unico globalmente
);

CREATE INDEX IF NOT EXISTS idx_product_schemas_account ON product_schemas(account_id);
CREATE INDEX IF NOT EXISTS idx_product_schemas_status ON product_schemas(account_id, status);
CREATE INDEX IF NOT EXISTS idx_product_schemas_effective ON product_schemas(account_id, effective_from);

ALTER TABLE product_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_schemas FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_schemas_account_isolation ON product_schemas;
CREATE POLICY product_schemas_account_isolation ON product_schemas
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

DROP TRIGGER IF EXISTS product_schemas_touch_updated_at ON product_schemas;
CREATE TRIGGER product_schemas_touch_updated_at
  BEFORE UPDATE ON product_schemas
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
