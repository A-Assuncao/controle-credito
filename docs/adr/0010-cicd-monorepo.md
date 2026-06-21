# ADR-0010: CI/CD e monorepo

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Necessário pipeline confiável com preview environments isolados por PR e deploys com aprovação em produção.

## Decisão

**Monorepo com pnpm workspaces + Turborepo + GitHub Actions.**

- `apps/api` (NestJS) e `apps/web` (Next.js) compartilhando `packages/contracts`, `packages/domain`, `packages/infra`, `packages/ui`.
- **GitHub Actions** com:
  - Lint + typecheck + testes unitários em todo PR.
  - Testes de integração com DB descartável (branch Neon).
  - Build de imagem Docker por commit em `main`.
  - Deploy em `staging` automático; em `prod` com aprovação manual.
- **Preview environments**: cada PR abre um branch Neon + deploy efêmero em Fly.io/Railway.
- **Conventional Commits** + **commitlint** + **release-please** para versionamento.

## Consequências

**Positivas:**
- Cache do Turborepo reduz tempo de CI.
- Preview por PR isola validação visual e de integração.
- Versionamento automatizado (release-please) gera changelog.

**Negativas:**
- Complexidade inicial maior que repo único.
- Curva de aprendizado do Turborepo.

**Mitigação:**
- Documentação inicial no README com diagrama do monorepo.
- Pipeline de CI compartilhada via composite actions.
- Lockfile com pnpm (mais rápido e eficiente em disco que npm/yarn).
