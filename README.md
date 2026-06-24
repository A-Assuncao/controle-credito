# Controle de Crédito

SaaS para gestão de empréstimos pessoais no Brasil, feito para **pessoa física** credora.

> **Status atual (2026-06-24):** Sprint 1 (v1.0.0-foundation), Sprint 1.5 (v1.1.0-sast), Sprint 2 v1 (v1.2.0-recovery) e Sprint 2 v2 (v1.3.0-preview) concluídas e em produção. Deploy ativo em Vercel + Render com Neon. CI 100% verde após 6 hotfixes (1.2.1 a 1.2.8). Aguardando AUTORIZO CODAR para Sprint 3 (EXE-002: domínio financeiro — tomadores, contratos, parcelas).
>
> Fonte da verdade do projeto: [`docs/master-plan.md`](docs/master-plan.md). Mudanças recentes: [`CHANGELOG.md`](CHANGELOG.md). DoD da Sprint 1: [`docs/sprint-1-done.md`](docs/sprint-1-done.md).

---

## O que é

Plataforma para credores pessoa física (e MEI no caso de borda) organizarem a operação de empréstimos pessoais com:

- **Motor de contratos parametrizável** (juros simples/compostos, semanal/quinzenal/mensal, carência, multa, mora, renegociação, quitação antecipada).
- **Visão clara de caixa e lucro** com fechamento por período configurável e projeção de 7 dias.
- **Motor de risco híbrido** (sugestão por contrato, opt-in, alerta automático em risco alto).
- **WhatsApp (Meta oficial) como canal principal — fala APENAS com o usuário**:
  - Notificações ao usuário (parcela venceu, limite, fechamento, risco).
  - **Comandos estruturados** do usuário (`cobrar João`, `status`, `tomadores`, `modelo`, `parar`).
  - **LLM conversacional** no plano Ilimitado (Claude Sonnet/Opus) — conversa natural, executa funções rotineiras com confirmação.
- **Geração de modelos de cobrança**: o sistema NÃO envia mensagens ao tomador. Gera texto pronto (modelo) que o usuário copia/encaminha manualmente pelo WhatsApp dele. 1 fixo (Essencial), 4 pré-definidos (Pro), custom + sob demanda via LLM (Ilimitado).
- **Score compartilhado** (cross-account) por nível — estatísticas agregadas no Pro, detalhe nominal no Ilimitado.
- **Dashboard mobile-first** com widgets configuráveis.

Diferenciais pensados desde o design: **conta pessoal isolada** (1 usuário por conta), **trilha de auditoria imutável**, **motor financeiro determinístico** com versionamento de esquema, **consentimento do tomador** para alimentar a base compartilhada.

---

## Onde começar a ler

1. [`docs/master-plan.md`](docs/master-plan.md) — plano mestre, fonte única de verdade.
2. [`CHANGELOG.md`](CHANGELOG.md) — histórico de versões (1.0.0-foundation, 1.1.0-sast, etc.).
3. [`docs/sprint-1-done.md`](docs/sprint-1-done.md) — Definition of Done da Sprint 1 (DoD item-por-item).
4. [`docs/architecture.md`](docs/architecture.md) — visão C4 e fluxos críticos (incluindo WhatsApp).
5. [`docs/security-model.md`](docs/security-model.md) — auth, MFA opcional, RLS, auditoria.
6. [`docs/financial-engine.md`](docs/financial-engine.md) — invariantes e cenários dourados.
7. [`docs/compliance-checklist.md`](docs/compliance-checklist.md) — pareceres jurídicos pendentes.
8. [`docs/adr/`](docs/adr/) — decisões arquiteturais registradas (ADRs 0001-0024+).
9. [`docs/preview-deploy.md`](docs/preview-deploy.md) — setup e troubleshooting de preview deploy.

---

## Modelo de uso

- **1 usuário por conta** (pessoa física).
- Compartilhamento de senha e decisão pessoal do titular — não é feature.
- **Single-session**: login em outro dispositivo revoga a sessão anterior.
- MFA **opcional** com banner recomendando.

## Tiers

| Plano         | Preço/mês (BRL) | Contratos | Tomadores | WhatsApp (com usuário)          | Modelos de cobrança  | LLM        | Score cross-account |
| ------------- | --------------- | --------- | --------- | ------------------------------- | -------------------- | ---------- | ------------------- |
| **Essencial** | R$ 79           | 30        | 50        | Notificações + comandos básicos | 1 fixo               | —          | —                   |
| **Pro**       | R$ 199          | 200       | 500       | + todos os comandos             | 4 pré-definidos      | —          | Médio (agregado)    |
| **Ilimitado** | R$ 449          | ∞         | ∞         | + todos os comandos             | Custom + sob demanda | **Claude** | Premium (nominal)   |

Detalhamento em [ADR-0020](docs/adr/0020-tiering-pessoa-fisica.md), [ADR-0019](docs/adr/0019-whatsapp-core.md) e [ADR-0023](docs/adr/0023-llm-conversacional.md).

---

## Estado operacional (2026-06-24)

| Item                                          | Status                                      | Última atualização |
| --------------------------------------------- | ------------------------------------------- | ------------------ |
| Fundação conta/IAM/auditoria (EXE-001)        | **`VALIDADO` (v1.0.0-foundation)**          | 2026-06-21         |
| Fechamento diferidos Sprint 1.5 (CI, Sentry, mobile, SAST, upgrade stack) | **`VALIDADO` (v1.1.0-sast)**               | 2026-06-24         |
| Recuperação de senha via email (Sprint 2 v1)  | **`VALIDADO` (v1.2.0-recovery)**            | 2026-06-24         |
| Preview deploy por PR (Sprint 2 v2)           | **`VALIDADO` (v1.3.0-preview)**             | 2026-06-24         |
| Hotfixes 1.2.1-1.2.8 (TS2322, env vars, CORS, Dockerfile, CI lint) | **`VALIDADO`** (PRs #13-#18)               | 2026-06-24         |
| Contratos + parcelas + recebimentos (EXE-002) | `EM_ANDAMENTO` (pronto para AUTORIZO CODAR) | —                  |
| Caixa + projeções + dashboard (EXE-003)       | `NAO_INICIADO`                              | —                  |
| Risco + WhatsApp + e-mail (EXE-004)           | `NAO_INICIADO`                              | —                  |
| Billing SaaS + limites por plano (EXE-005)    | `NAO_INICIADO`                              | —                  |
| PREMIUM modo seguro (EXE-006)                 | `NAO_INICIADO`                              | —                  |
| PREMIUM nominal cross-account (EXE-007)       | `BLOQUEADO` (validação jurídica pendente)  | —                  |

**Gate atual:** Sprint 2 v2 (preview deploy) concluída e deployada. CI 100% verde. Aguardando `AUTORIZO CODAR` para Sprint 3 (domínio financeiro).

### URLs de produção (2026-06-24)

- **Frontend (Vercel)**: https://controle-credito.vercel.app
- **API (Render)**: https://controle-credito.onrender.com
- **Banco (Neon)**: projeto `floral-block-94879884`, branch `production`

---

## Stack (versão real, pós-upgrade 2026-06-24)

Stack decidida em [ADR-0001](docs/adr/0001-stack-runtimes.md) a [ADR-0007](docs/adr/0007-monorepo.md), ajustada nos ADRs 0019 (WhatsApp), 0020 (tiering), 0024 (auth). Upgrade completo em 2026-06-23 (Node 22→24, pnpm 9→11, NestJS 10→11, Next 15→16, TypeScript 5.6→5.9). Detalhes em `docs/master-plan.md` §12.6.

| Camada          | Tecnologia                                                                      | Versão         |
| --------------- | ------------------------------------------------------------------------------- | -------------- |
| Runtime         | Node.js LTS                                                                     | 24 (Krypton)   |
| Package manager | pnpm + corepack                                                                 | 11.9.0         |
| Backend         | NestJS + TypeScript (strict)                                                    | 11.1 / 5.9     |
| Frontend        | Next.js (App Router, Turbopack default) + TypeScript + Tailwind                 | 16.2 / 5.9     |
| Auth (frontend) | NextAuth v5 (Auth.js)                                                           | 5.0.0-beta.31  |
| API HTTP        | Express via `@nestjs/platform-express`                                          | 11.1           |
| DB driver       | `pg` direto (sem ORM) + 2 pools custom (tenant + system)                        | 8.13           |
| Banco           | PostgreSQL com **RLS ativo** (FORCE) — Neon free tier                           | 18             |
| Cache + Filas   | Redis + ioredis                                                                  | 7 / 5.4        |
| Telemetria      | OpenTelemetry (OTLP/HTTP)                                                       | sdk 0.219      |
| Error tracking  | Sentry (NestJS + Next.js SDKs) — noop no Vercel (sem SENTRY_AUTH_TOKEN)        | 10.60          |
| Validação       | zod                                                                             | 3.23           |
| Lint / format   | ESLint + typescript-eslint + Prettier (`* text=auto eol=lf` em .gitattributes)   | 10.5 / 8.62 / 3.x |
| Build           | tsc + turbo                                                                     | tsc 5.9 / turbo 2.1 |
| Crypto          | argon2                                                                          | 0.41           |
| Testes E2E      | Playwright (3 projects: chromium + iPhone 13 + Pixel 7)                         | 1.55           |
| Testes unit     | vitest + unplugin-swc                                                            | 3.2 / 1.5      |
| SAST            | Semgrep CE + CodeQL (via GitHub Code Scanning)                                  | 1.x / latest   |
| Secrets scan    | GitGuardian (integrado no GitHub)                                              | n/a            |
| CI              | GitHub Actions (Node 24 runners) — **5/5 workflows success**                   | ubuntu-latest  |
| Preview deploy  | Vercel (web) + Render (api) + Neon branching (db)                               | 1.x / latest   |
| Monorepo        | pnpm workspaces + Turborepo                                                     | 11 / 2.1       |

**Diferenças vs. plano original:**
- `Auth`: Ory Kratos + Hydra foram **substituídos** por NextAuth v5 (beta.31) + TOTP próprio (decisão em [ADR-0024](docs/adr/0024-auth-nextauth-substitui-kratos.md)). Justificativas: menos peça móvel, código auditável, sem subprocessor de identidade.
- `ORM`: TypeORM foi **substituído** por `pg` direto + 2 pools custom (tenant com RLS, system com BYPASSRLS via role `app_system`).
- `DB`: PostgreSQL 18 no **Neon** (free tier, free unlimited storage até 0.5GB). Migrações aplicadas via MCP Neon.
- `Preview deploy`: cada PR sobe pra Vercel (web) + Render (api) + Neon branch (db). Isolamento total entre PRs. Setup detalhado em [docs/preview-deploy.md](docs/preview-deploy.md).

---

## Como contribuir

### Setup local (dev)

```bash
# Pré-requisitos: Node 24 LTS + pnpm 11 (via corepack) + WSL Ubuntu (Postgres 18 + Redis 7)
corepack enable
pnpm install
pnpm --filter @controle-credito/infra build
pnpm db:migrate
pnpm dev   # sobe API (:3001) + Web (:3000) via turbo
```

> Em Windows: rodar comandos `pnpm` no PowerShell (não WSL — o `wsl-up.sh` resolve o gotcha do PATH do `node` no WSL).

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

### Convenções de commit

- Conventional Commits (configurado via commitlint).
- Mensagens **SEM acento** (padrão do projeto — manter consistência com git log e tooling).
- **Documentos técnicos** (README, master-plan, ADRs em pt-BR) **COM acento** (português correto). Ver regra atualizada em `.claude/projects/.../memory/convencao-acentos.md` se disponível.
- Toda entrega `IMPLANTADO` ou `VALIDADO` exige atualizar `docs/master-plan.md` + `CHANGELOG.md` + `README.md` (regra 8 do master-plan).

---

## Licença

Proprietário. Todos os direitos reservados.
