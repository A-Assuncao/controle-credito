# Changelog

Todas as mudancas relevantes neste projeto sao registradas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## [Nao liberado]

### Em andamento

- **Sprint 2 / EXE-002 — Dominio financeiro** (a iniciar apos go/no-go da Sprint 1).
- **Upgrade de stack 2026-06-23** (6 commits na branch `sprint/001-foundation`, em validacao):
  - Node 22→24 LTS, pnpm 9→11, NestJS 10→11, Next.js 15→16, next-auth beta.20→beta.31, TypeScript 5.6→5.9.

### Adicionado (Sprint 1.5 — fechamento)

- **TTL de refresh token configuravel (default 12h)** via `SESSION_TTL_HOURS` env. Substitui o TTL hardcoded de 30 dias. 3 arquivos: `packages/infra/src/env.ts`, `apps/api/src/modules/identity/auth/refresh-token.service.ts`, `.env.example`. Tokens em circulacao nao sao invalidados (apenas encolhem ao expirar).

### Pendente

- Decisoes juridicas sobre LGPD, transferencia internacional, modulo PREMIUM e provedor LLM.
- DPIA para PREMIUM e dados fora do BR (Sprint 1.5 / 2).
- Subprocessadores formais e revisão jurídica final do modo nominal no PREMIUM.

### Adicionado (upgrade de stack)

- `scripts/wsl-up.sh`: novo sub-comando `--setup-node` que instala **Node 24 LTS + pnpm 11** via **nvm + corepack**. Idempotente. Resolve o gotcha `exec: node: not found` que impedia rodar `pnpm db:migrate` no WSL Ubuntu. Pre-requisito para validar o restante do upgrade localmente.
- `package.json` (raiz): adicionado `@eslint/js@^10.0.0` como devDep (era dep transitiva). Necessario porque o pnpm 11 strict (isolated) esconde deps do root; o `eslint.config.mjs` da raiz agora consegue resolver o import.

### Changed (upgrade de stack)

- `package.json` (raiz): `engines.node >=22.0.0 → >=24.0.0`, `engines.pnpm >=9.0.0 → >=11.0.0`, `packageManager pnpm@9.15.9 → pnpm@11.9.0`, `@types/node ^26.0.0 → ^24.13.0`.
- `apps/web/package.json`: `@types/node ^22.7.4 → ^24.13.0`.
- `pnpm-workspace.yaml`: adicionado `publicHoistPattern` (`@eslint/js`, `eslint-config-prettier`, `eslint-plugin-prettier`, `@typescript-eslint/*`, `globals`) para compat com pnpm 11 strict (isolated), e bloco `allowBuilds` para aprovar scripts de `@nestjs/core`, `@swc/core`, `argon2`, `esbuild`, `protobufjs`, `sharp`.
- **Fixes obrigatorios** descobertos na validacao (pnpm 11 + ESLint 10 + prettier sao mais estritos):
  - `packages/domain/src/money.ts`: regex de normalizacao de NBSP/narrow NBSP usa `\\u00A0\\u202F` em vez de chars literais (ESLint 10 `no-irregular-whitespace`).
  - `apps/api/src/modules/accounts/audit.repository.ts`: `p++` em expressao `$${p++}` reescrito como `$${p + 1}` (ESLint 10 `no-useless-assignment`).
  - `packages/infra/src/logger.ts`: removido `eslint-disable-next-line` unused.
  - Varios arquivos: CRLF → LF (prettier + ESLint 10 `prettier/prettier`).
  - Varios arquivos: ajustes de formatacao automatica via `prettier --write`.
- `.github/workflows/ci.yml`: `pnpm/action-setup` v4 → v6, `version: 9 → 11`, `node-version: 22 → 24`. Postgres 18 e Redis 7 mantidos.
- `apps/api/package.json`: `@nestjs/{common,core,platform-express,testing}` `^10.4.4` → `^11.1.6`. Compatibilidade de engines confirmada (`engines.node >= 20` no NestJS 11); sem breaking changes no código atual. Suite e2e (16/16) e unit (5/5) verde localmente.
- `apps/api/scripts/run-e2e.js`: `cwd` ajustado de `dirname(fileURLToPath(import.meta.url))` (= `apps/api/scripts/`) para `dirname(here)` (= `apps/api/`), onde `vitest.config.e2e.ts` e os testes em `test/e2e/` realmente ficam. O vitest 3.x resolve `--config <path>` relativo ao CWD; o `cwd: here` antigo so funcionava quando o path era passado absoluto (mudanca de comportamento menor no vitest 3.2.6).
- `apps/web/package.json`: `next ^15.0.0 → ^16.2.9`, `next-auth 5.0.0-beta.20 → 5.0.0-beta.31` (peer aceita Next 16 oficialmente). Script `lint`: `next lint` → `eslint src` (Next 16 removeu `next lint`).
- `apps/web/src/middleware.ts` → `apps/web/src/proxy.ts` (rename obrigatorio no Next 16). Conteudo preservado (`auth()` do NextAuth funciona identico no `proxy.ts`).
- `package.json` (raiz): adicionado `@playwright/test` deps para Chromium e deps de sistema instaladas via `apt install -y libnspr4 libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64` no WSL Ubuntu (Chromium headless).

---

## [1.0.0-foundation] - 2026-06-21

Sprint 1 / EXE-001 concluida. Documento `docs/sprint-1-done.md` tem o DoD item-por-item (28/37 entregues, 4 parciais, 5 diferidos para Sprint 2).

### Adicionado

**Infraestrutura**

- Monorepo pnpm + Turborepo com 7 workspaces (apps/api, apps/web, packages/{contracts,domain,infra,ui}).
- `apps/api` (NestJS 10): módulos `identity`, `accounts`, `common`, `health`, `observability`, `account-context`.
- `apps/web` (Next.js 15 App Router + NextAuth v5 beta.20): páginas `/login`, `/dashboard`, `/` (redirect), `/api/auth/[...nextauth]`, middleware de proteção de rotas.
- `packages/contracts`: schemas Zod compartilhados (`identity`, `account`, `audit`).
- `packages/infra`: env validation (zod), pg pool + `withAccountContext`/`withSystemContext`, redis client, pino logger com redação de PII.
- CI GitHub Actions em `.github/workflows/ci.yml` (lint + typecheck + test + setup test DB com GRANTs).

**Banco & migrações**

- 3 migrations idempotentes: `accounts` (raiz), `users` (FK accounts, RLS FORCE), `audit_log` (append-only via triggers).
- Runner `pnpm db:migrate` que registra em `__migrations__`.
- **Hardening de RLS** (descoberta na task 6c): role `app_system` (BYPASSRLS, NOSUPERUSER) em pool separado, evitando bypass via SUPERUSER.

**Auth & Sessão**

- `argon2id` (OWASP 2024: 19MiB memory, 2 iter, 1 paralelismo).
- JWT HS256 (jose): access 15min + refresh Redis 30d com hash SHA-256.
- `POST /auth/login`, `/refresh`, `/logout` (com single-session).
- `POST /auth/mfa/setup` (otplib + AES-256-GCM no secret), `/verify`, `/disable`.
- `last_session_revoked_at` para revogação coarse-grained (AuthGuard checa `iat < revoked_at`).
- Refresh automático transparente (jwt callback quando faltar <2min para expirar).
- Decorators `@CurrentAccount()`, `@CurrentUser()`, `@CorrelationId()`, `@Public()`.

**Endpoints**

- `GET/PATCH /accounts/me` (full_name, settings — schema zod strict).
- `GET /accounts/me/audit` (filtros: action, from, to, limit, offset).
- `GET /health` (SELECT 1 + Redis PING, 200/503).
- `AuditLoggerInterceptor` global grava toda mutação automaticamente.

**Observabilidade**

- Pino logger com redação (password, token, email, cpf, phone, secret, mfaSecret, ...).
- OpenTelemetry NodeSDK com auto-instrumentation (HTTP, Express, pg, ioredis).
- OTLP/HTTP exporter (configurável via `OTEL_EXPORTER_OTLP_ENDPOINT`).
- `HttpLoggerMiddleware` loga cada request (method, path, status, durationMs, correlationId, userId, accountId).

**Suite de testes**

- 5 unit tests do AuthGuard (vitest).
- 15 e2e tests via supertest (login, refresh, logout, MFA setup, accounts CRUD, audit, cross-account isolation) — 100% verde.
- Config separada com `unplugin-swc` para decorator metadata em ESM.

### Changed

- **ADR-0024**: NextAuth v5 + TOTP próprio substitui Ory Kratos + Hydra (decisão registrada no plano).
- `pnpm db:check-rls` agora roda no CI com warning se o role `app` virar SUPERUSER (defesa contra regressão).
- `packages/{contracts,domain,infra}` agora têm `main: "./dist/index.js"` (Node ESM precisa de `.js` no filesystem).

### Diferido para Sprint 2 (EXE-002)

- MfaGuard em rotas sensíveis (a estrutura está pronta — só aplicar).
- Banner MFA em apps/web.
- Recuperação de senha (e-mail + SMS) com providers.
- Playwright e2e para apps/web.
- SAST no CI (codeql/snyk).
- Sentry para captura de 500 + scrubbing de PII.
- Preview deploy por PR (Neon branch + Vercel/Render).
- TTL de sessão 12h (atualmente 30d — mais seguro por default).
- Mobile-first testing (375x812).

### Notes

- Veja `docs/sprint-1-done.md` para o DoD item-por-item.
- Memórias da sprint em `~/.claude/projects/.../memory/` (`sprint-001-estado`, `setup-apps-api-task6a`, `esm-nestjs-pegadinhas`, `rls-hardening-app-system`, `e2e-suite-unplugin-swc`, `conectividade-wsl-windows`, `contexto-shell-usuario`, `otel-pretty-quirks`).

---

## [0.5.0-code] - 2026-06-21

### Adicionado

- `AUTORIZO CODAR` recebido para Sprint 1 (EXE-001), escopo conforme `docs/sprint-1-plan.md`.
- **ADR-0024**: NextAuth v5 (Auth.js) + TOTP próprio (otplib) substitui Ory Kratos + Hydra. Justificativas: menos peça móvel, código auditável, sem subprocessor de identidade, melhor encaixe no modelo single-user, recuperação de senha por e-mail+SMS (Resend/Twilio como providers, ainda não selecionados).
- Branch `sprint/001-foundation` em criação.
- Monorepo (pnpm + Turborepo), migrations 001/002/003 com RLS FORCE, apps/api (NestJS), apps/web (Next.js + shadcn/ui) — em construção.

### Modificado

- `docs/master-plan.md`: `EXE-001` agora `EM_ANDAMENTO (código)`; novo registro de entrega em 2026-06-21; resumo de estado atualizado; nota de desvio (desktop-first, sem preview.yml/release.yml nesta sprint, OTel só console).
- `docs/sprint-1-plan.md`: ajustes pendentes para refletir os desvios (a fazer no PR da Sprint 1).

### Desvios ratificados (Sprint 1)

- **Auth:** NextAuth v5 (Auth.js) + TOTP próprio no lugar de Ory Kratos + Hydra.
- **UX:** desktop-first, mobile-friendly depois (plano original era mobile-first 375x812).
- **CI:** `preview.yml` (Neon branch + deploy efêmero) **adiado para Sprint 1.5**; `release.yml` simplificado (sem changelog automático).
- **Observabilidade:** OTel SDK plugado, OTLP endpoint comentado (apenas console em dev).
- **Compliance:** `docs/compliance/dpia-template.md` e `subprocessors.md` adiados — não há dado pessoal de domínio na Sprint 1.
- **Bootstrap:** script `bootstrap.sh` removido (YAGNI — sem novos devs onboardando).

---

## [0.4.0-docs] - 2026-06-20

### Modificado

- **ADR-0019 (WhatsApp) reescrito**: WhatsApp NUNCA fala com o tomador. Apenas com o usuario (notificacoes + comandos). Sistema gera **modelos de cobranca** (texto) que o usuario copia/encaminha manualmente.
- **master-plan §8.4**: reescrito — sem envio ao tomador, sem janela 24h Meta para tomador, sem opt-out cross-account, sem cobranca conversacional automatica.
- **master-plan §10 / ADR-0020**: tiers com nova coluna LLM. WhatsApp simplificado. Modelos de cobranca por tier (1 / 4 / custom).
- **architecture.md**: Fluxo 4 substituido (gera modelo de cobranca, nao envia); Fluxo 5 (comando estruturado) e Fluxo 6 (LLM conversacional) adicionados; Fluxo 7 (notificacao ao usuario).

### Adicionado

- **ADR-0023 (LLM conversacional)**: Anthropic Claude (Sonnet 4.6 / Opus 4.8) no plano Ilimitado, com tool use, confirmacao obrigatoria para escritas, mascaramento de PII, logs de 90 dias, rate limit e cap de custo.
- `security-model.md` §7.4: controles de LLM (escopo de tools, confirmacao, privacidade, anti-prompt-injection).
- `compliance-checklist.md` itens 20 e 21: provedor LLM e retencao de logs de conversa.

### Removido

- Envio de cobranca ao tomador via WhatsApp (substituido por geracao de modelo).
- Templates Meta aprovados para tomador.
- Webhook inbound do tomador.
- Opt-out WhatsApp do tomador (item 16a do compliance).
- Janela 24h Meta para tomador.
- Cobranca conversacional automatica.
- Auto-cobranca (job).

---

## [0.3.0-docs] - 2026-06-20

### Modificado

- **ADR-0019 (WhatsApp) reescrito**: WhatsApp passa a ser canal **principal** de notificacoes ao usuario, com **comandos** que disparam acoes (inclusive envio ao tomador). Tres direcoes: sistema -> usuario, usuario -> sistema, sistema -> tomador.
- **master-plan §8.4**: secoes reescritas com WhatsApp-first, comandos (`status`, `tomadores`, `cobrar`, `ajuda`, `parar`, `retomar`), e auto-cobranca configuravel.
- **master-plan §10 (tiers)**: coluna WhatsApp ajustada — Essencial com notificacoes + comandos basicos, Pro com todos os comandos + 50 envios/mes, Ilimitado com 200 envios + custom templates.
- **ADR-0020 (tiers)**: tabela de tiers atualizada com comandos e contagens de envio WhatsApp.
- **architecture.md**: Fluxo 5 (comando do usuario via WhatsApp) e Fluxo 6 (notificacao ao usuario) adicionados. Atores externos atualizados.
- **security-model.md**: secao 7.2 (autenticacao de comandos via WhatsApp) adicionada; rate limits atualizados (comandos 30/h, notificacoes 20/h).
- **compliance-checklist.md**: item 16a (consentimento WhatsApp do tomador) adicionado.

### Adicionado

- Verificacao obrigatoria do numero WhatsApp no cadastro do usuario.
- Confirmacao explicita para comandos destrutivos (`cobrar`, `cancelar`).
- Opt-out granular por categoria de notificacao.
- Limite de 1 auto-cobranca por tomador por dia (anti-spam).
- Reativacao de notificacoes pausadas via `parar` so pelo app (anti-clonagem).

---

## [0.2.0-docs] - 2026-06-20

### Adicionado

- **ADRs 0018-0022** com refinamentos do modelo single-user:
  - ADR-0018: autenticacao single-user (single-session, MFA opcional, recuperacao e-mail+celular).
  - ADR-0019: WhatsApp como canal CORE V1 (Meta oficial).
  - ADR-0020: tiering para pessoa fisica (Essencial/Pro/Ilimitado).
  - ADR-0021: analise de credito cross-account por niveis (Comum/Medio/Premium).
  - ADR-0022: analise de credito por contrato (sugestao sempre visivel, opt-in).
- `docs/architecture.md` com novo fluxo critico 4 (cobranca via WhatsApp).
- `docs/security-model.md` ajustado para modelo single-user (sem RBAC).
- `docs/compliance-checklist.md` com 19 itens (anonimizacao preservada, opt-out WhatsApp, consentimento do tomador).
- `docs/sprint-1-plan.md` ajustado (sem `user_roles`, MFA opcional, recovery dupla).

### Modificado

- `master-plan.md`: secao 6 (sem RBAC), secao 8.4 (WhatsApp CORE), secao 10 (tiers PF), secao 17 (analise por contrato), secao 18 (3 niveis cross-account), roadmap F3 (WhatsApp), quadro EXE-001.
- `ADR-0005` (auth) marcado como refinado por ADR-0018.
- `ADR-0014` (risco) marcado como refinado por ADR-0022.
- `ADR-0016` (tiering) deprecado e substituido por ADR-0020.

### Deprecado

- `ADR-0016` (tiering enterprise): modelo multi-user nao se aplica ao publico PF.

---

## [0.2.0-docs] - 2026-06-20

### Adicionado

- **ADRs 0018-0022** com refinamentos do modelo single-user:
  - ADR-0018: autenticacao single-user (single-session, MFA opcional, recuperacao e-mail+celular).
  - ADR-0019: WhatsApp como canal CORE V1 (Meta oficial).
  - ADR-0020: tiering para pessoa fisica (Essencial/Pro/Ilimitado).
  - ADR-0021: analise de credito cross-account por niveis (Comum/Medio/Premium).
  - ADR-0022: analise de credito por contrato (sugestao sempre visivel, opt-in).
- `docs/architecture.md` com novo fluxo critico 4 (cobranca via WhatsApp).
- `docs/security-model.md` ajustado para modelo single-user (sem RBAC).
- `docs/compliance-checklist.md` com 19 itens (anonimizacao preservada, opt-out WhatsApp, consentimento do tomador).
- `docs/sprint-1-plan.md` ajustado (sem `user_roles`, MFA opcional, recovery dupla).

### Modificado

- `master-plan.md`: secao 6 (sem RBAC), secao 8.4 (WhatsApp CORE), secao 10 (tiers PF), secao 17 (analise por contrato), secao 18 (3 niveis cross-account), roadmap F3 (WhatsApp), quadro EXE-001.
- `ADR-0005` (auth) marcado como refinado por ADR-0018.
- `ADR-0014` (risco) marcado como refinado por ADR-0022.
- `ADR-0016` (tiering) deprecado e substituido por ADR-0020.

### Deprecado

- `ADR-0016` (tiering enterprise): modelo multi-user nao se aplica ao publico PF.

---

## [0.1.0-docs] - 2026-06-20

### Adicionado

- `docs/master-plan.md` v1.2 — plano mestre consolidado, fonte de verdade.
- Quadro de execucao `EXE-001` a `EXE-007` com status e responsavel.
- Regras persistentes minimas do projeto (12 itens).
- Protocolo de governanca de documentacao.
- ADRs 0001-0017 com decisoes iniciais de stack, seguranca, financeiro, monetizacao e operacao.
- `docs/architecture.md` (visao C4 + fluxos).
- `docs/security-model.md` (modelo inicial com RBAC).
- `docs/financial-engine.md` (motor financeiro).
- `docs/compliance-checklist.md` (17 itens iniciais).
- `docs/sprint-1-plan.md` (plano inicial com RBAC).
- `docs/runbooks/identity-outage.md`, `docs/runbooks/db-failover.md`.
- README raiz, CHANGELOG.

---

**Convencao de versao enquanto pre-implementacao:**

- `0.x.y` — docs e configuracao nao-producao.
- `0.x.y-code` — primeiro codigo autorizado.
- `1.0.0` — go-live do `CORE V1`.
