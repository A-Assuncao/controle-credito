-- 002_init_users.sql
-- Cria a tabela users (1 usuario por conta, single-user).
-- RLS FORCE ativo: defense in depth contra bug de aplicacao.
-- Policy le current_setting('app.account_id') que o AccountContextMiddleware
-- seta via SET LOCAL a cada transacao (ver packages/infra/src/db.ts).

CREATE TABLE IF NOT EXISTS users (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email                   TEXT        NOT NULL,
  full_name               TEXT        NOT NULL,
  phone_encrypted         TEXT        NOT NULL,
  password_hash           TEXT        NOT NULL,
  mfa_enabled             BOOLEAN     NOT NULL DEFAULT false,
  mfa_secret_encrypted    TEXT,
  status                  TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'suspended', 'canceled')),
  last_login_at           TIMESTAMPTZ,
  last_session_revoked_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 1 usuario por conta (modelo single-user, ADR-0018)
  UNIQUE(account_id),
  -- email unico dentro da conta; unicidade cross-account nao exigida no v1
  -- (Sprint 1.5: considerar UNIQUE global se virar requisito de billing)
  UNIQUE(account_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_account ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(account_id, email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_account_isolation ON users;
CREATE POLICY users_account_isolation ON users
  USING      (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
