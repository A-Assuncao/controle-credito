# Controle de Credito

SaaS para gestao de emprestimos pessoais no Brasil, feito para **pessoa fisica** credora.

> **Status atual:** Sprint 1 (v1.0.0-foundation) e Sprint 1.5 (v1.1.0-sast) concluidas. Em validacao para Sprint 2 (EXE-002: dominio financeiro — tomadores, contratos, parcelas).
> Fonte da verdade do projeto: [`docs/master-plan.md`](docs/master-plan.md). Mudancas recentes: [`CHANGELOG.md`](CHANGELOG.md). DoD da Sprint 1: [`docs/sprint-1-done.md`](docs/sprint-1-done.md).

---

## O que e

Plataforma para credores pessoa fisica (e MEI no caso de borda) organizarem a operacao de emprestimos pessoais com:

- **Motor de contratos parametrizavel** (juros simples/compostos, semanal/quinzenal/mensal, carencia, multa, mora, renegociacao, quitacao antecipada).
- **Visao clara de caixa e lucro** com fechamento por periodo configuravel e projecao de 7 dias.
- **Motor de risco hibrido** (sugestao por contrato, opt-in, alerta automatico em risco alto).
- **WhatsApp (Meta oficial) como canal principal — fala APENAS com o usuario**:
  - Notificacoes ao usuario (parcela venceu, limite, fechamento, risco).
  - **Comandos estruturados** do usuario (`cobrar Joao`, `status`, `tomadores`, `modelo`, `parar`).
  - **LLM conversacional** no plano Ilimitado (Claude Sonnet/Opus) — conversa natural, executa funcoes rotineiras com confirmacao.
- **Geração de modelos de cobrança**: o sistema NAO envia mensagens ao tomador. Gera texto pronto (modelo) que o usuario copia/encaminha manualmente pelo WhatsApp dele. 1 fixo (Essencial), 4 pre-definidos (Pro), custom + sob demanda via LLM (Ilimitado).
- **Score compartilhado** (cross-account) por nivel — estatisticas agregadas no Pro, detalhe nominal no Ilimitado.
- **Dashboard mobile-first** com widgets configuraveis.

Diferenciais pensados desde o design: **conta pessoal isolada** (1 usuario por conta), **trilha de auditoria imutavel**, **motor financeiro deterministico** com versionamento de esquema, **consentimento do tomador** para alimentar a base compartilhada.

---

## Onde comecar a ler

1. [`docs/master-plan.md`](docs/master-plan.md) — plano mestre, fonte unica de verdade.
2. [`CHANGELOG.md`](CHANGELOG.md) — historico de versoes (1.0.0-foundation, 1.1.0-sast, etc.).
3. [`docs/sprint-1-done.md`](docs/sprint-1-done.md) — Definition of Done da Sprint 1 (DoD item-por-item).
4. [`docs/architecture.md`](docs/architecture.md) — visao C4 e fluxos criticos (incluindo WhatsApp).
5. [`docs/security-model.md`](docs/security-model.md) — auth, MFA opcional, RLS, auditoria.
6. [`docs/financial-engine.md`](docs/financial-engine.md) — invariantes e cenarios dourados.
7. [`docs/compliance-checklist.md`](docs/compliance-checklist.md) — pareceres juridicos pendentes.
8. [`docs/adr/`](docs/adr/) — decisoes arquiteturais registradas (ADRs 0001-0024+).

---

## Modelo de uso

- **1 usuario por conta** (pessoa fisica).
- Compartilhamento de senha e decisao pessoal do titular — nao e feature.
- **Single-session**: login em outro dispositivo revoga a sessao anterior.
- MFA **opcional** com banner recomendando.

## Tiers

| Plano         | Preco/mes (BRL) | Contratos | Tomadores | WhatsApp (com usuario)          | Modelos de cobranca  | LLM        | Score cross-account |
| ------------- | --------------- | --------- | --------- | ------------------------------- | -------------------- | ---------- | ------------------- |
| **Essencial** | R$ 79           | 30        | 50        | Notificacoes + comandos basicos | 1 fixo               | —          | —                   |
| **Pro**       | R$ 199          | 200       | 500       | + todos os comandos             | 4 pre-definidos      | —          | Medio (agregado)    |
| **Ilimitado** | R$ 449          | ∞         | ∞         | + todos os comandos             | Custom + sob demanda | **Claude** | Premium (nominal)   |

Detalhamento em [ADR-0020](docs/adr/0020-tiering-pessoa-fisica.md), [ADR-0019](docs/adr/0019-whatsapp-core.md) e [ADR-0023](docs/adr/0023-llm-conversacional.md).

---

## Estado operacional

| Item                                          | Status                                      | Ultima atualizacao |
| --------------------------------------------- | ------------------------------------------- | ------------------ |
| Fundacao conta/IAM/auditoria (EXE-001)        | **`VALIDADO` (v1.0.0-foundation)**          | 2026-06-21         |
| Fechamento diferidos Sprint 1.5 (CI, Sentry, mobile, SAST, upgrade stack) | **`VALIDADO` (v1.1.0-sast)**               | 2026-06-24         |
| Contratos + parcelas + recebimentos (EXE-002) | `EM_ANDAMENTO` (pronto para AUTORIZO CODAR) | —                  |
| Caixa + projecoes + dashboard (EXE-003)       | `NAO_INICIADO`                              | —                  |
| Risco + WhatsApp + e-mail (EXE-004)           | `NAO_INICIADO`                              | —                  |
| Billing SaaS + limites por plano (EXE-005)    | `NAO_INICIADO`                              | —                  |
| PREMIUM modo seguro (EXE-006)                 | `NAO_INICIADO`                              | —                  |
| PREMIUM nominal cross-account (EXE-007)       | `BLOQUEADO` (validacao juridica pendente)  | —                  |

**Gate atual:** Sprint 1.5 concluida, aguardando `AUTORIZO CODAR` para Sprint 2 (EXE-002).

---

## Stack (versao real, pos-upgrade 2026-06-24)

Stack decidida em [ADR-0001](docs/adr/0001-stack-runtimes.md) a [ADR-0007](docs/adr/0007-monorepo.md), ajustada nos ADRs 0019 (WhatsApp), 0020 (tiering), 0024 (auth). Upgrade completo em 2026-06-23 (Node 22→24, pnpm 9→11, NestJS 10→11, Next 15→16, TypeScript 5.6→5.9). Detalhes em `docs/master-plan.md` §12.6.

| Camada          | Tecnologia                                                                      | Versao         |
| --------------- | ------------------------------------------------------------------------------- | -------------- |
| Runtime         | Node.js LTS                                                                     | 24 (Krypton)   |
| Package manager | pnpm + corepack                                                                 | 11.9.0         |
| Backend         | NestJS + TypeScript (strict)                                                    | 11.1 / 5.9     |
| Frontend        | Next.js (App Router, Turbopack default) + TypeScript + Tailwind                 | 16.2 / 5.9     |
| Auth (frontend) | NextAuth v5 (Auth.js)                                                           | 5.0.0-beta.31  |
| API HTTP        | Express via `@nestjs/platform-express`                                          | 11.1           |
| DB driver       | `pg` direto (sem ORM) + 2 pools custom (tenant + system)                        | 8.13           |
| Banco           | PostgreSQL com **RLS ativo** (FORCE)                                            | 18             |
| Cache + Filas   | Redis + ioredis                                                                  | 7 / 5.4        |
| Telemetria      | OpenTelemetry (OTLP/HTTP)                                                       | sdk 0.219      |
| Error tracking  | Sentry (NestJS + Next.js SDKs)                                                  | 10.60          |
| Validacao       | zod                                                                             | 3.23           |
| Lint / format   | ESLint + typescript-eslint + Prettier                                           | 10.5 / 8.62 / 3.x |
| Build           | tsc + turbo                                                                     | tsc 5.9 / turbo 2.1 |
| Crypto          | argon2                                                                          | 0.41           |
| Testes E2E      | Playwright (3 projects: chromium + iPhone 13 + Pixel 7)                         | 1.55           |
| Testes unit     | vitest + unplugin-swc                                                            | 3.2 / 1.5      |
| SAST            | Semgrep CE + CodeQL (via GitHub Code Scanning)                                  | 1.x / latest   |
| Secrets scan    | GitGuardian (integrado no GitHub)                                              | n/a            |
| CI              | GitHub Actions (Node 24 runners)                                                | ubuntu-latest  |
| Preview deploy  | Vercel (web) + Render (api) + Neon branching (db)                               | 1.x / latest   |
| Monorepo        | pnpm workspaces + Turborepo                                                     | 11 / 2.1       |

**Diferencas vs. plano original:**
- `Auth`: Ory Kratos + Hydra foram **substituidos** por NextAuth v5 (beta.31) + TOTP proprio (decisao em [ADR-0024](docs/adr/0024-auth-nextauth-substitui-kratos.md)). Justificativas: menos peca movel, codigo audita vel, sem subprocessor de identidade.
- `ORM`: TypeORM foi **substituido** por `pg` direto + 2 pools custom (tenant com RLS, system com BYPASSRLS via role `app_system`).
- `DB**: PostgreSQL 18 (CI/dev local, no WSL); producao ainda em escolha (Neon ou RDS).
- `Preview deploy`: cada PR sobe pra Vercel (web) + Render (api) + Neon branch (db). Isolamento total entre PRs. Setup detalhado em [docs/preview-deploy.md](docs/preview-deploy.md).

---

## Como contribuir

### Setup local (dev)

```bash
# Pre-requisitos: Node 24 LTS + pnpm 11 (via corepack) + WSL Ubuntu (Postgres 18 + Redis 7)
corepack enable
pnpm install
pnpm --filter @controle-credito/infra build
pnpm db:migrate
pnpm dev   # sobe API (:3001) + Web (:3000) via turbo
```

> Em Windows: rodar comandos `pnpm` no PowerShell (nao WSL — o `wsl-up.sh` resolve o gotcha do PATH do `node` no WSL).

### Testes

```bash
pnpm test                    # unit tests (vitest)
pnpm --filter @controle-credito/api test:e2e  # API e2e (supertest)
pnpm --filter @controle-credito/web test:e2e  # Web e2e (Playwright, 3 viewports)
```

### Lint / typecheck

```bash
pnpm lint
pnpm typecheck
```

### Convensoes de commit

- Conventional Commits (configurado via commitlint).
- Mensagens SEM acento (padrao do projeto).
- Toda entrega `IMPLANTADO` ou `VALIDADO` exige atualizar `docs/master-plan.md` + `CHANGELOG.md`.

---

## Licenca

Proprietario. Todos os direitos reservados.
