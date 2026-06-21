-- 001_init_accounts.sql
-- Cria a tabela accounts (conta pessoal - uma por usuario, sem RBAC).
-- Multi-tenant: account_id aparece em todas as tabelas tenant-scoped.
-- Esta migration NAO habilita RLS em accounts - account e' a raiz
-- do isolamento; policies em users/audit_log referenciam accounts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'canceled')),
  settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
