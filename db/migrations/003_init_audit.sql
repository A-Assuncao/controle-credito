-- 003_init_audit.sql
-- Trilha de auditoria imutavel (regra 5, 11 do master-plan).
-- RLS FORCE + triggers que bloqueiam UPDATE e DELETE.
-- account_id SEM FK para accounts para evitar que delete de account
-- (LGPD art. 18 VI) propague perda de trilha. Auditoria sobrevive
-- a conta.

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL   PRIMARY KEY,
  account_id    UUID        NOT NULL,
  actor_user_id UUID,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_account_created
  ON audit_log(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_log(account_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON audit_log(account_id, resource_type, resource_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_account_isolation ON audit_log;
CREATE POLICY audit_account_isolation ON audit_log
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

-- Append-only enforcement (regra 5 - override/auditoria sempre imutavel)
CREATE OR REPLACE FUNCTION audit_log_block_mutations() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutations();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutations();
