# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile para apps/api (NestJS 11 + Node 24 LTS).
#
# Stage 1 (builder): instala deps, builda packages + api.
# Stage 2 (runner): imagem minima com so o necessario pra rodar.
#
# Por que multi-stage: argon2 (nativo) + sharp + protobuf + outros deps
# pesados ficam SOmente no builder. Runner final fica ~150MB vs ~800MB.
#
# Por que pnpm com frozen-lockfile: build reprodutivel. CI ja usa isso.
#
# Por que argon2 precisa de build tools no builder: eh' um modulo
# nativo (napi) que compila em runtime. Sem libpq-dev/gcc/python3,
# o pnpm install falha. Runner NAO precisa (binario ja compilado).
#
# Como usar:
#   docker build -t ghcr.io/a-assuncao/controle-credito-api:dev -f apps/api/Dockerfile .
#   docker run -p 3001:3001 --env-file .env ghcr.io/.../api:dev
#
# CI usa esse mesmo Dockerfile (ver .github/workflows/ci-docker.yml).

ARG NODE_VERSION=24
ARG PNPM_VERSION=11

# ============================================================
# Stage 1: builder
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS builder

# argon2 + sharp + outras deps nativos exigem toolchain de build.
# Mantemos SOmente no builder - runner herda o binario ja compilado.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Habilita pnpm via corepack (Node 24 ja vem com corepack).
# Versao vem do campo `packageManager` do package.json raiz.
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

# Copia manifests primeiro pra melhor cache de layers Docker.
# apps/contracts e apps/web NAO sao deps de apps/api - nao copiamos.
# (Erro passado: `2>/dev/null || true` em COPY nao eh' valido em
# Docker - eh' shell syntax, nao Docker syntax. Causava
# "failed to compute cache key" no BuildKit.)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/infra/package.json ./packages/infra/
COPY packages/ui/package.json ./packages/ui/

# Instala TODAS as deps (incluindo devDeps) - builder precisa.
RUN pnpm install --frozen-lockfile

# Copia o resto do source.
COPY . .

# Builda os packages compartilhados (precisam .js no filesystem p/
# Node ESM). Depois builda o api.
RUN pnpm --filter @controle-credito/contracts build \
    && pnpm --filter @controle-credito/domain build \
    && pnpm --filter @controle-credito/infra build \
    && pnpm --filter @controle-credito/api build

# Prune devDeps pra deixar node_modules enxuto.
#
# NOTA: pnpm 11 introduziu ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE que
# bloqueia `pnpm deploy` em workspaces sem inject-workspace-packages.
# Usamos --legacy como workaround. Alternativa: adicionar
# `force-legacy-deploy: true` em pnpm-workspace.yaml.
RUN pnpm --filter @controle-credito/api --prod --legacy deploy /app/api-prod

# ============================================================
# Stage 2: runner
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS runner

# Labels OCI padrao - ajudam em auditoria de imagens.
LABEL org.opencontainers.image.source="https://github.com/A-Assuncao/controle-credito" \
      org.opencontainers.image.title="controle-credito-api" \
      org.opencontainers.image.description="NestJS API for controle-credito" \
      org.opencontainers.image.licenses="UNLICENSED"

# argon2 em runtime precisa APENAS de libpq5 (binario compartilhado
# do Postgres). Sem build tools - binario ja vem compilado.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# User nao-root (seguranca). Node image ja tem user `node` (uid 1000).
USER node
WORKDIR /app

# Copia artefatos do builder.
COPY --from=builder --chown=node:node /app/api-prod/dist ./dist
COPY --from=builder --chown=node:node /app/api-prod/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/apps/api/package.json ./
COPY --from=builder --chown=node:node /repo/packages ./packages

ENV NODE_ENV=production \
    PORT_API=3001

EXPOSE 3001

# Healthcheck - Vercel/Render/Neon precisam saber quando o container
# ta saudavel. GET /health retorna 200 com SELECT 1 + Redis PING.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT_API+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]