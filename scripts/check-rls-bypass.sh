#!/usr/bin/env bash
# Falha CI se a role de aplicacao tiver BYPASSRLS=true.
# Por que: a regra 11 do master-plan exige que isolamento por tenant esteja ativo.
# Se a role bypassa RLS, qualquer query escapa da policy e isola por convencao
# (que falha). Esse script e o gate final.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    # shellcheck disable=SC1091
    set -a; . ./.env; set +a
  else
    echo "ERRO: DATABASE_URL nao definido e .env nao existe." >&2
    exit 2
  fi
fi

# Extrai o role da URL (formato: postgres://ROLE:PASS@HOST:PORT/DB)
ROLE=$(echo "$DATABASE_URL" | sed -E 's|postgres://([^:]+):.*|\1|')

if [ -z "$ROLE" ]; then
  echo "ERRO: nao consegui extrair o role de $DATABASE_URL" >&2
  exit 2
fi

echo "Verificando BYPASSRLS para role: $ROLE"

# Query que lista roles com BYPASSRLS
RESULT=$(psql "$DATABASE_URL" -tA -c "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname='$ROLE';" 2>&1) || {
  echo "ERRO ao consultar pg_roles. Verifique se psql esta instalado e DATABASE_URL acessivel." >&2
  echo "$RESULT" >&2
  exit 2
}

BYPASS=$(echo "$RESULT" | awk -F'|' '{print $2}' | tr -d ' ')

if [ "$BYPASS" = "t" ]; then
  echo "FALHA: role '$ROLE' tem BYPASSRLS=true. RLS esta sendo contornado." >&2
  echo "Para corrigir: ALTER ROLE \"$ROLE\" NOBYPASSRLS;" >&2
  exit 1
fi

echo "OK: role '$ROLE' NAO tem BYPASSRLS."
exit 0
