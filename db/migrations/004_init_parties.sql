-- 004_init_parties.sql
-- Cria a tabela parties (tomadores - pessoas fisicas que tomam emprestimo).
-- Multi-tenant: account_id aparece em todas as tabelas tenant-scoped.
--
-- v1: campo `document` (CPF/CNPJ) em texto claro. v2 candidate para
-- criptografia (master-plan secao 14.1 cita PartyIdentifier com hash
-- + ultimos digitos + controle de acesso a plaintext).
--
-- O tomador NAO acessa o sistema - ele eh' apenas referenciado por
-- CPF (master-plan secao 18 - Reputacao compartilhada PREMIUM).

CREATE TABLE IF NOT EXISTS parties (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  document    TEXT,                       -- CPF ou CNPJ (texto claro por agora)
  email       TEXT,
  phone       TEXT,
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'blocked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parties_account ON parties(account_id);
CREATE INDEX IF NOT EXISTS idx_parties_document ON parties(account_id, document);
CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(account_id, status);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parties_account_isolation ON parties;
CREATE POLICY parties_account_isolation ON parties
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS parties_touch_updated_at ON parties;
CREATE TRIGGER parties_touch_updated_at
  BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
