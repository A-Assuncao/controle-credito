#!/usr/bin/env bash
# =============================================================================
# scripts/wsl-up.sh
#
# Sobe Postgres 18 + Redis 7 no WSL Ubuntu e prepara o banco de dev/test do
# controle-credito. Idempotente: pode rodar quantas vezes quiser.
#
# O que faz:
#   1. Confirma que esta rodando dentro do WSL.
#   2. Cacheia sudo (pede senha uma unica vez no inicio).
#   3. Sobe servicos postgresql e redis-server.
#   4. Healthcheck das portas 5432 e 6379.
#   5. Cria DBs (controle_credito, controle_credito_test) se faltarem.
#   6. Cria roles (app, app_system) com BYPASSRLS no app_system, se faltarem.
#   7. Roda `pnpm db:migrate` no banco de dev.
#   8. Testa login com senha nos roles app e app_system.
#   9. Imprime diagnostico de roteamento WSL->Windows (IP a usar no .env se
#      localhost nao funcionar de fora do WSL).
#
# Sub-comandos:
#   --install       Cria symlink em ~/.local/bin/wsl-up para rodar de qualquer
#                   lugar.
#   --setup-node    Instala Node 24 LTS + pnpm 11 via nvm+corepack. Resolver o
#                   gotcha `exec: node: not found` em `pnpm db:migrate` no WSL.
#                   Idempotente.
#
# Saindo no meio, eh seguro re-rodar: tudo abaixo eh idempotente.
#
# Pre-requisitos:
#   - WSL2 com Ubuntu.
#   - Postgres 18 e redis-server instalados:
#       sudo apt install -y postgresql-18 redis-server
#   - curl disponivel (ja' vem no Ubuntu; usado por --setup-node).
#   - Repositorio clonado em /mnt/d/GitHub/controle-credito (path padrao).
#   - Para rodar `pnpm db:migrate` no WSL: `wsl-up --setup-node` antes.
# =============================================================================

set -euo pipefail

# ---------- cores (auto-desliga se stdout nao for tty) ----------
if [ -t 1 ]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
  C_BLU=$'\033[34m'; C_DIM=$'\033[2m';  C_RST=$'\033[0m'
else
  C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; C_DIM=''; C_RST=''
fi
ok()   { printf "  %s[ok]%s %s\n"   "$C_GRN" "$C_RST" "$1"; }
warn() { printf "  %s[warn]%s %s\n" "$C_YEL" "$C_RST" "$1"; }
fail() { printf "  %s[fail]%s %s\n" "$C_RED" "$C_RST" "$1"; }
info() { printf "%s%s%s\n" "$C_BLU" "$1" "$C_RST"; }
dim()  { printf "%s%s%s\n" "$C_DIM" "$1" "$C_RST"; }

# ---------- --install: expõe como `wsl-up` no PATH do usuario ----------
# Uso: ./scripts/wsl-up.sh --install
# Idempotente: re-rodar só atualiza o symlink.
# Posicionado aqui (depois das funcoes de log, antes dos guardas) para
# funcionar com `set -e` e nao reclamar de funcoes nao definidas.
if [ "${1:-}" = "--install" ]; then
  SCRIPT_SRC="$(readlink -f "$0")"
  BIN_DIR="${HOME}/.local/bin"
  BIN_NAME="wsl-up"

  mkdir -p "$BIN_DIR"
  ln -sf "$SCRIPT_SRC" "${BIN_DIR}/${BIN_NAME}"
  chmod +x "$SCRIPT_SRC"

  if echo ":$PATH:" | grep -q ":${BIN_DIR}:"; then
    ok "Instalado: ${BIN_DIR}/${BIN_NAME} -> ${SCRIPT_SRC}"
    info "PATH ja' contem ${BIN_DIR}. Rode: wsl-up"
  else
    warn "Instalado, mas ${BIN_DIR} NAO esta no PATH."
    info "Adicione ao ~/.bashrc e reabra o shell:"
    dim  "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
    dim  "  source ~/.bashrc"
    info "Depois rode: wsl-up"
  fi
  exit 0
fi

# ---------- --setup-node: instala Node 24 LTS + habilita corepack ----------
# Uso: ./scripts/wsl-up.sh --setup-node
# Idempotente: re-rodar so re-verifica versoes e troca se necessario.
#
# Por que nvm+corepack (e nao apt/nvm-windows/NodeSource):
#   - nvm permite multiplas versoes de Node lado a lado (fallback facil).
#   - corepack vem com Node 16+ e gerencia pnpm/yarn por projeto (le o
#     campo `packageManager` do package.json). Sem instalacao global.
#   - apt traz Node do Ubuntu archive (versao antiga, sem rolling).
#   - NodeSource exige apt repo extra e conflita com nvm.
#
# IMPORTANTE sobre pnpm: este sub-comando NAO fixa uma versao de pnpm aqui.
# O corepack le a versao do campo `packageManager` do package.json do repo
# (depois do commit 2 do upgrade de stack sera `pnpm@11.x`). Isso garante
# que cada clone use a mesma versao de pnpm sem precisar de install global.
#
# Por que este sub-comando vive aqui: o mesmo wsl-up ja' sobe Postgres+Redis
# para o dev. Sem Node correto, `pnpm db:migrate` quebra com o gotcha
# `exec: node: not found` quando rodado no WSL.
if [ "${1:-}" = "--setup-node" ]; then
  REQUIRED_NODE_MAJOR=24

  # Carrega funcoes de log se ainda nao estiverem (sao definidas mais abaixo,
  # mas aqui rodamos ANTES dos guardas para sair rapido).
  if ! type ok >/dev/null 2>&1; then
    if [ -t 1 ]; then
      C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
      C_BLU=$'\033[34m'; C_DIM=$'\033[2m';  C_RST=$'\033[0m'
    else
      C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; C_DIM=''; C_RST=''
    fi
    ok()   { printf "  %s[ok]%s %s\n"   "$C_GRN" "$C_RST" "$1"; }
    warn() { printf "  %s[warn]%s %s\n" "$C_YEL" "$C_RST" "$1"; }
    fail() { printf "  %s[fail]%s %s\n" "$C_RED" "$C_RST" "$1"; }
    info() { printf "%s%s%s\n" "$C_BLU" "$1" "$C_RST"; }
    dim()  { printf "%s%s%s\n" "$C_DIM" "$1" "$C_RST"; }
  fi

  info "==> Setup Node ${REQUIRED_NODE_MAJOR} LTS (nvm+corepack)"

  # Confirma que estamos no WSL (reaproveita o mesmo guarda do final).
  if ! grep -qiE "microsoft|wsl" /proc/version 2>/dev/null; then
    fail "Este sub-comando so roda dentro do WSL."
    exit 1
  fi

  # 1. Instalar nvm se faltar.
  export NVM_DIR="${HOME}/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    info "nvm nao encontrado em \$NVM_DIR. Instalando..."
    # Pega a versao estavel mais recente do nvm (sem pino, para nao atrasar o upgrade).
    curl -fsSL --retry 3 https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    ok "nvm instalado em $NVM_DIR"
  else
    ok "nvm ja' presente em $NVM_DIR"
  fi

  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"

  # 2. Instalar Node LTS requerido.
  CURRENT_NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
  if [ "$CURRENT_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" ]; then
    ok "Node v${REQUIRED_NODE_MAJOR} ja' ativo ($(node -v))"
  else
    info "Instalando Node ${REQUIRED_NODE_MAJOR} LTS via nvm..."
    nvm install "${REQUIRED_NODE_MAJOR}"
    nvm alias default "${REQUIRED_NODE_MAJOR}"
    nvm use "${REQUIRED_NODE_MAJOR}"
    ok "Node agora: $(node -v)"
  fi

  # 3. Habilitar corepack (vem com Node, gerencia pnpm por projeto via
  # `packageManager` no package.json).
  if corepack enable >/dev/null 2>&1; then
    ok "corepack habilitado (versao: $(corepack --version 2>/dev/null || echo 'n/a'))"
  else
    warn "corepack enable falhou (pode ja' estar ativo)"
  fi

  # 4. Smoke test final.
  FINAL_NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "$FINAL_NODE_MAJOR" -ne "$REQUIRED_NODE_MAJOR" ]; then
    fail "Versao final do Node nao bate com o esperado (${REQUIRED_NODE_MAJOR})."
    exit 1
  fi

  # 5. Garante que o .bashrc carrega nvm (idempotente).
  if [ -f "${HOME}/.bashrc" ] && ! grep -qE 'NVM_DIR=.*\.nvm' "${HOME}/.bashrc"; then
    info "Adicionando source do nvm ao ~/.bashrc..."
    cat >> "${HOME}/.bashrc" <<'BASHRC_EOF'

# controle-credito: carregar nvm em todo shell interativo
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
BASHRC_EOF
    ok "nvm adicionado ao ~/.bashrc"
  fi

  # 6. Garante que o nvm tem prioridade no PATH (antes do /mnt/c/Program Files/nodejs).
  # Sem isso, o pnpm/node do Windows mascara o do WSL.
  if [ -f "${HOME}/.bashrc" ] && ! grep -qE '# controle-credito: PATH nvm' "${HOME}/.bashrc"; then
    info "Prependendo PATH do nvm em ~/.bashrc (evita conflito com /mnt/c)..."
    cat >> "${HOME}/.bashrc" <<'BASHRC_EOF'

# controle-credito: PATH nvm
# Garante que o Node/pnpm do WSL (/home/.../.nvm/versions/node/.../bin) venha
# ANTES do /mnt/c/Program Files/nodejs e /mnt/c/Users/.../pnpm/bin do
# Windows, senao o pnpm do Windows mascara o do corepack.
case ":$PATH:" in
  *":$NVM_DIR/versions/node:"*) ;;
  *)
    if [ -d "$NVM_DIR/versions/node" ]; then
      # Pega a versao default-linkada
      NVM_BIN_DIR="$(ls -d $NVM_DIR/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
      if [ -n "$NVM_BIN_DIR" ]; then
        export PATH="$NVM_BIN_DIR:$PATH"
      fi
    fi
    ;;
esac
BASHRC_EOF
    ok "PATH do nvm prependido"
  fi

  cat <<EOF

  ${C_GRN}Setup de Node concluido:${C_RST}
    node:     $(node -v)
    corepack: $(corepack --version 2>/dev/null || echo 'n/a')

  ${C_GRN}Sobre o pnpm:${C_RST}
    O pnpm sera' ativado pelo corepack automaticamente a partir do
    campo 'packageManager' do package.json deste repo. Apos o commit 2
    do upgrade de stack (engines + packageManager), o pnpm sera' 11.x.

    Para validar agora:
      cd /mnt/d/GitHub/controle-credito
      pnpm -v   # depois do bump: deve mostrar 11.x.x

  ${C_GRN}Para garantir que nvm+PATH funcione em novos shells:${C_RST}
    source ~/.bashrc
    # ou abra um novo shell.

  ${C_GRN}Proximo passo (subir infra e rodar a app):${C_RST}
    cd /mnt/d/GitHub/controle-credito
    wsl-up
EOF
  exit 0
fi

# ---------- 0. Guardas ----------
if ! grep -qiE "microsoft|wsl" /proc/version 2>/dev/null; then
  fail "Este script so roda dentro do WSL (nao detectou /proc/version WSL)."
  dim  "  Se voce esta em macOS/Linux nativo, ignore. Para abrir o WSL:  wsl"
  exit 1
fi

REPO_ROOT="/mnt/d/GitHub/controle-credito"
if [ ! -d "$REPO_ROOT" ]; then
  fail "Repo nao encontrado em $REPO_ROOT."
  dim  "  Ajuste REPO_ROOT no topo do script se seu clone esta em outro path."
  exit 1
fi

# Senhas esperadas pelos services da app (Dockerfile / .env).
# Doc: docker-compose.dev.yml + .env.
APP_PASSWORD="app"
APP_SYSTEM_PASSWORD="app_system"
DB_DEV="controle_credito"
DB_TEST="controle_credito_test"

info "==> 0. Guardas"
ok "WSL detectado ($(grep -oE 'microsoft|wsl' /proc/version | head -1))"
ok "Repo em $REPO_ROOT"

# ---------- 1. Sudo cacheado ----------
info "==> 1. Sudo (cacheia por 5 min)"
sudo -v
ok "sudo autenticado"

# trap para manter sudo vivo durante o script (senao expira em ~5min)
( while kill -0 "$$" 2>/dev/null; do sleep 60; sudo -n true; done ) &
SUDO_KEEPER_PID=$!
trap 'kill $SUDO_KEEPER_PID 2>/dev/null || true' EXIT

# ---------- 2. Subir servicos ----------
info "==> 2. Subindo servicos"
for svc in postgresql redis-server; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    ok "$svc ja' rodando (systemd)"
  elif service "$svc" status >/dev/null 2>&1; then
    sudo service "$svc" start >/dev/null 2>&1 || true
    if service "$svc" status >/dev/null 2>&1; then
      ok "$svc iniciado (service)"
    else
      fail "$svc nao subiu. Tente: sudo service $svc status"
      exit 1
    fi
  else
    fail "Nem systemd nem service controlam $svc. Instale:"
    dim  "  sudo apt install -y postgresql-18 redis-server"
    exit 1
  fi
done

# ---------- 3. Healthcheck ----------
info "==> 3. Healthcheck"
if pg_isready -h localhost -p 5432 -q; then
  ok "Postgres 5432 aceitando conexoes"
else
  fail "Postgres 5432 nao responde"
  dim  "  sudo service postgresql status"
  exit 1
fi

if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q "^PONG$"; then
  ok "Redis 6379 respondendo (PONG)"
else
  fail "Redis 6379 nao responde"
  dim  "  sudo service redis-server status"
  exit 1
fi

# ---------- 4. DBs ----------
info "==> 4. Garantindo DBs (${DB_DEV}, ${DB_TEST})"
sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_DEV}'" | grep -q 1 \
  || sudo -u postgres createdb "$DB_DEV" \
  && ok "DB ${DB_DEV} presente" \
  || fail "Falha criando ${DB_DEV}"

sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_TEST}'" | grep -q 1 \
  || sudo -u postgres createdb "$DB_TEST" \
  && ok "DB ${DB_TEST} presente" \
  || fail "Falha criando ${DB_TEST}"

# ---------- 5. Roles ----------
info "==> 5. Garantindo roles (app, app_system)"

# app: login normal, sem RLS bypass
sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc \
  "SELECT 1 FROM pg_roles WHERE rolname='app'" | grep -q 1 \
  || sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
       "CREATE ROLE app LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;" \
  && ok "role app presente"

# Reseta senha mesmo se ja' existir (idempotencia forte - evita dor de cabeca
# quando voce mexeu no pg_hba.conf ou no password e esqueceu).
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE app WITH LOGIN PASSWORD '${APP_PASSWORD}';" >/dev/null
ok "role app com senha resetada (idempotente)"

# app_system: BYPASSRLS, NOSUPERUSER. Essencial para withSystemContext.
# BYPASSRLS so pode ser setado em superuser - garantido pois rodamos como
# o role `postgres` via `sudo -u postgres psql`.
sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc \
  "SELECT 1 FROM pg_roles WHERE rolname='app_system'" | grep -q 1 \
  || sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
       "CREATE ROLE app_system LOGIN PASSWORD '${APP_SYSTEM_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;" \
  && ok "role app_system presente"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE app_system WITH LOGIN PASSWORD '${APP_SYSTEM_PASSWORD}' BYPASSRLS;" >/dev/null
ok "role app_system com senha + BYPASSRLS garantidos"

# Grants basicos: app e app_system precisam conectar e usar as DBs.
# (Tabelas e GRANTs mais finos vem das migrations; aqui so o connect.)
for db in "$DB_DEV" "$DB_TEST"; do
  for role in app app_system; do
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
      "GRANT CONNECT ON DATABASE ${db} TO ${role};" >/dev/null
  done
done
ok "GRANT CONNECT em ambos os DBs para app + app_system"

# ---------- 6. Migrations ----------
info "==> 6. Rodando migrations (pnpm db:migrate)"
cd "$REPO_ROOT"

# Garante que @controle-credito/infra esta buildado (necessario para a API
# importar do dist em runtime - o migrate.ts so usa `pg` direto, entao e'
# raro precisar, mas safe).
if [ ! -f "packages/infra/dist/db.js" ] && [ ! -f "packages/infra/dist/index.js" ]; then
  warn "packages/infra/dist ausente. Se migrate reclamar de modulo, rode:"
  dim "  pnpm --filter @controle-credito/infra build"
fi

# Migrations sao idempotentes (create table if not exists) e o runner pula
# as ja' aplicadas - seguro re-rodar.
if pnpm db:migrate 2>&1 | tail -20; then
  ok "migrations aplicadas (ou ja' estavam em dia)"
else
  fail "pnpm db:migrate falhou - veja saida acima"
  exit 1
fi

# ---------- 7. Testa login com senha (smoke real) ----------
info "==> 7. Smoke test: login com senha nos roles"
if PGPASSWORD="$APP_PASSWORD" psql -h localhost -U app -d "$DB_DEV" \
     -tAc "SELECT current_user, current_database();" 2>/dev/null \
     | grep -q "^app|${DB_DEV}$"; then
  ok "app@${DB_DEV} login com senha OK"
else
  fail "app@${DB_DEV} NAO logou com senha. Confira pg_hba.conf (host all all 127.0.0.1/32 md5)"
  dim  "  Arquivo: /etc/postgresql/18/main/pg_hba.conf (ou /etc/postgresql/*/main/)"
  dim  "  Linha esperada: host all all 127.0.0.1/32 scram-sha-256"
fi

if PGPASSWORD="$APP_SYSTEM_PASSWORD" psql -h localhost -U app_system -d "$DB_DEV" \
     -tAc "SELECT current_user;" 2>/dev/null | grep -q "^app_system$"; then
  ok "app_system@${DB_DEV} login com senha OK"
else
  warn "app_system@${DB_DEV} nao logou. Veja nota do teste do `app` acima."
fi

# ---------- 8. Diagnostico WSL -> Windows ----------
info "==> 8. Diagnostico de roteamento WSL -> Windows"
WSL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
dim  "  IP do WSL na rede do host: ${WSL_IP:-?}"
dim  "  A API roda no PowerShell (Windows) e conecta em 'localhost:5432'."
dim  "  Em WSL2 com 'networkingMode=mirrored' (default no Windows 11 22H2+),"
dim  "  localhost funciona dos dois lados. Em WSL2 legacy (NAT), o Windows nao"
dim  "  alcança o WSL via localhost - precisa do IP ${WSL_IP:-?} no .env:"
dim  "    DATABASE_URL=postgres://app:app@${WSL_IP:-<WSL_IP>}:5432/controle_credito"
dim  "    REDIS_URL=redis://${WSL_IP:-<WSL_IP>}:6379"
dim  "  Para checar de qual lado voce esta:"
dim  "    No WSL:  cat /etc/wsl.conf | grep -A2 \\[wsl2\\]"
dim  "             (deve ter 'networkingMode=mirrored' ou ser WSL1)"

# ---------- 9. Resumo e proximos passos ----------
info "==> 9. Pronto. Proximos passos"
cat <<EOF

  ${C_GRN}Infra UP no WSL:${C_RST}
    Postgres 18 em localhost:5432   (DBs: ${DB_DEV}, ${DB_TEST})
    Redis 7   em localhost:6379

  ${C_GRN}Volte ao PowerShell (Windows) e rode:${C_RST}
    cd D:\\GitHub\\controle-credito
    pnpm --filter @controle-credito/api test:e2e

  ${C_GRN}Se der ECONNREFUSED do Windows${C_RST} (e nao do WSL):
    WSL2 legacy - use o IP ${WSL_IP:-?} no .env:
      DATABASE_URL=postgres://app:app@${WSL_IP:-<WSL_IP>}:5432/controle_credito
      REDIS_URL=redis://${WSL_IP:-<WSL_IP>}:6379

  ${C_DIM}Para derrubar tudo:${C_RST}
    sudo service postgresql stop
    sudo service redis-server stop
EOF
