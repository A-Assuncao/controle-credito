# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile para apps/web (Next.js 16 + Node 24 LTS).
#
# Stage 1 (deps): install dependencies (incluindo devDeps).
# Stage 2 (builder): builda apps/web com output: 'standalone'.
# Stage 3 (runner): imagem minima com so o necessario pra rodar.
#
# Por que standalone: Next.js gera .next/standalone/ que contem apenas
# os arquivos necessarios (node_modules production-only, server.js,
# static). Imagem final fica ~100MB vs ~500MB com .next/ normal.
#
# Como usar:
#   docker build -t ghcr.io/a-assuncao/controle-credito-web:dev -f apps/web/Dockerfile .
#   docker run -p 3000:3000 --env-file .env ghcr.io/.../web:dev
#
# IMPORTANTE: web precisa de api rodando (apps/api) - configurar
# NEXT_PUBLIC_API_URL via env var.

ARG NODE_VERSION=24
ARG PNPM_VERSION=11

# ============================================================
# Stage 1: deps
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

# Copia manifests primeiro (cache de layer).
# apps/contracts NAO eh' dep de web - e NAO existe (so' packages/contracts/).
# O Dockerfile do api (linha 48) ja documentou isso pro app inverso.
# (Erro passado: `2>/dev/null || true` em COPY nao eh' valido em
# Docker - eh' shell syntax, nao Docker syntax. Causava
# "failed to compute cache key" no BuildKit.)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/infra/package.json ./packages/infra/
COPY packages/ui/package.json ./packages/ui/

# Instala TODAS as deps (incluindo devDeps pro build).
RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: builder
# ============================================================
FROM deps AS builder
WORKDIR /repo

# Copia o resto do source.
COPY . .

# Builda os packages compartilhados (precisam .js no filesystem p/
# Node ESM). Depois builda o web.
RUN pnpm --filter @controle-credito/contracts build \
    && pnpm --filter @controle-credito/domain build \
    && pnpm --filter @controle-credito/infra build \
    && pnpm --filter @controle-credito/ui build \
    && pnpm --filter @controle-credito/web build

# Next.js com output: 'standalone' gera .next/standalone/ que tem
# apenas os arquivos necessarios (server.js, node_modules prod-only,
# static). Perfeito pra imagem Docker pequena.
# Ver next.config.ts: output: 'standalone' (ja configurado).

# ============================================================
# Stage 3: runner
# ============================================================
FROM node:${NODE_VERSION}-bookworm-slim AS runner

LABEL org.opencontainers.image.source="https://github.com/A-Assuncao/controle-credito" \
      org.opencontainers.image.title="controle-credito-web" \
      org.opencontainers.image.description="Next.js web for controle-credito" \
      org.opencontainers.image.licenses="UNLICENSED"

# Sem deps nativos extras no runner - Next.js standalone NAO precisa
# de build tools (ja vem tudo pre-built).

USER node
WORKDIR /app

# Copia saida standalone + assets. Next gera:
# - .next/standalone/  - server.js + node_modules production-only
# - .next/static/     - arquivos estaticos (CSS, JS chunks)
# (NAO copiamos apps/web/public porque o diretorio nao existe no repo
# - assets estaticos sao servidos via .next/static)
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./.next/static

ENV NODE_ENV=production \
    PORT_WEB=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000

# Healthcheck - web nao tem /health explicito, so / (que retorna HTML).
# Vercel/Render aceitam 200 OK do / - checa se a home carrega.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT_WEB+'/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]