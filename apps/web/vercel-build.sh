#!/usr/bin/env bash
# Build command para o Vercel (apps/web).
# Limit do Vercel: 256 chars no Build Command field.
# Por isso a logica esta aqui (em arquivo versionado) e o painel
# do Vercel chama `bash vercel-build.sh`.
#
# Pre-requisito: pnpm install ja rodou (Install Command cuida disso).
# Build chain: workspace packages (contracts/domain/infra/ui) precisam
# ter dist/ pronto antes do Next buildar (apps/web importa de @controle-credito/contracts).

set -e

# Volta para a raiz do monorepo para rodar pnpm workspace.
cd ../..

# Builda os 4 workspace packages em sequencia (ordem nao importa -
# todos sao deps do web mas independentes entre si).
pnpm --filter @controle-credito/contracts build
pnpm --filter @controle-credito/domain build
pnpm --filter @controle-credito/infra build
pnpm --filter @controle-credito/ui build

# Volta para apps/web e roda o Next build.
cd apps/web
pnpm build