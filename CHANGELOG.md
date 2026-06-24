# Changelog

Todas as mudancas relevantes neste projeto sao registradas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## [1.2.6-hotfix] - 2026-06-24

Hotfix: CI 100% vermelho em todos os PRs recentes. 2 problemas.

### Fixed

- **`.gitattributes` (NOVO)**: `* text=auto eol=lf`. Força LF em
  todos os arquivos de texto do repo. Sem isso, devs em Windows
  editam arquivos e commita com CRLF, fazendo Prettier reportar
  "Delete \r" em 800+ lugares. A longo prazo resolve a fonte do
  problema (nao apenas os sintomas).
- **`packages/infra/src/env.ts`**: quebra de linha do enum NODE_ENV
  (5 valores nao cabem em <100 chars). Prettier queria.
- **`apps/api/src/main.ts`** + **`apps/web/next-env.d.ts`**:
  reformatação Prettier (auto-fix de CRLF, espacamento).
- **`.github/workflows/preview-deploy.yml`**: bug no body do curl
  Neon API. `-d "{\"parent_id\":null}"` enviava "parent_id":"null"
  (string) em vez de null JSON. API rejeitava com 400. Fix: heredoc
  + variavel BODY para garantir null real.

---

## [1.2.5-hotfix] - 2026-06-24

Hotfix: warnings/erros observados nos logs de producao (Vercel + Render)
apos deploys 1.2.1-1.2.4.

### Fixed

- **`apps/api/src/modules/common/filters/all-exceptions.filter.ts`** -
  defensive `req.correlationId ?? randomUUID()`. Antes, se a exception
  ocorresse ANTES do `AccountContextMiddleware` rodar (CORS preflight,
  body parser), o `res.setHeader('x-correlation-id', undefined)` lancava
  `ERR_HTTP_INVALID_HEADER_VALUE` e mascarava o erro real.
- **`apps/web/next.config.ts`** - `sourcemaps.disable: !process.env.SENTRY_AUTH_TOKEN`.
  Sem isso, o build do Vercel logava 2 warnings
  `[@sentry/nextjs] No auth token provided. Will not create release.`
  mesmo sem Sentry configurado. Agora silencioso quando nao ha config.

### No-op

- Render `/health` intermitente retornando 503: Neon free tier auto-suspende
  branches apos 5min idle. Primeira query apos resume demora ~5s (timeout do
  health). Workaround futuro: configurar `pg.Pool` com
  `connectionTimeoutMillis: 3000` no Render. Por enquanto eh' raro e
  auto-recupera.

---

## [1.2.4-hotfix] - 2026-06-24

Hotfix: apos deploys 1.2.1-1.2.3, Vercel (frontend) retornava 500 em
todas as paginas porque CORS do Render (api) so aceitava requests
da propria URL do Render. Frontend Vercel era rejeitado.

### Fixed

- **`apps/api/src/main.ts`** - CORS agora aceita lista hardcoded
  de origens alem de `env.NEXTAUTH_URL`:
  - `env.NEXTAUTH_URL` (Vercel, setado pelo usuario)
  - `https://controle-credito.onrender.com` (API em prod)
  - `https://controle-credito.vercel.app` (Vercel alias)
  - `http://localhost:3000` (dev local)
  Function-based origin com log de warn para origens rejeitadas
  (debug mais facil que 500 silencioso).

### Required manual setup (apos merge)

- **Render painel**: editar `NEXTAUTH_URL` para apontar para o
  frontend (`https://controle-credito.vercel.app`), NAO para a API.
  Atualmente esta como `https://controle-credito.onrender.com` que
  faz o link de recovery apontar para a API em vez do frontend.

---

## [1.2.3-hotfix] - 2026-06-24

Hotfix: apos merge de 1.2.2, deploy Vercel ainda falhava porque
`bash` shell do Vercel nao suporta brace expansion (`{a,b,c}`).
Erro: `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT: None of the selected
packages has a "@controle-credito/domain" script`.

### Adicionado

- **`apps/web/vercel-build.sh`** - script bash encapsulando a build
  chain completa (4 workspace packages + Next.js build). Permite
  Build Command no painel do Vercel ser apenas `bash vercel-build.sh`
  (16 chars), dentro do limite de 256. Sem brace expansion.

### Required manual setup (apos merge)

- Vercel painel: mudar Build Command para `bash vercel-build.sh`.

---

## [1.2.2-hotfix] - 2026-06-24

Hotfix: apos merge de 1.2.1, deploys de preview (Render + Vercel)
falhavam por config de env vars. Render rejeitava `NODE_ENV=preview`
e faltavam secrets; Vercel warn'dava sobre NEXTAUTH envs nao
declaradas no turbo.json.

### Fixed

- **`packages/infra/src/env.ts:9`** - enum `NODE_ENV` agora aceita
  `'preview'` alem de `development`/`test`/`staging`/`production`.
  Necessario para o Render de preview deploy por PR (que usa
  `NODE_ENV=preview` conforme `docs/preview-deploy.md`).
  Backward-compatible: adicionar valor a enum zod nao quebra
  nenhum caller existente.
- **`turbo.json`** - adicionado `globalEnv: ["NEXTAUTH_URL", "NEXTAUTH_SECRET"]`
  e `globalDependencies: ["tsconfig.base.json"]`. Sem isso, Vercel
  warnava "missing from turbo.json" e as envs nao ficavam disponiveis
  nos builds dos packages dependentes do infra.

### Required manual setup (apos merge)

- **Vercel painel** (projeto `prj_BK0tNHv05OXUPLJKeTOhXQRMEJTC`):
  mudar Framework Preset para `Next.js` e Root Directory para
  `apps/web`. Atualmente auto-detectado como `nestjs` (causa um
  typecheck framework-aware adicional que falha com TS2322 espurio
  em arquivos que ja passaram no build do Turbo).
- **Render painel**: setar `NEXTAUTH_SECRET` (>= 32 chars via
  `openssl rand -base64 32`), `NEXTAUTH_URL` (URL completa do
  servico), e `JWT_SECRET` (>= 32 chars). Estas 3 env vars sao
  obrigatorias em qualquer deploy (validacao via zod em
  `packages/infra/src/env.ts`).

---

## [1.2.1-hotfix] - 2026-06-24

Hotfix: build de producao (Vercel + Render) estava quebrado com TS2322 em
`apps/api/src/modules/identity/token/token.service.ts:normalize()`.
CI reportava typecheck verde, mas o erro so aparecia em `tsc -p
tsconfig.build.json` (modo emit) usado pelos deploys.

### Fixed

- **TS2322 em `token.service.ts:normalize()`** (linha 94) que bloqueava
  build de producao. Erro: `Type 'unknown' is not assignable to type
  '"pending" | "verified" | "not_required"'`.
  - Causa: `mfa` vinha de `JWTPayload` do `jose` como `unknown`. A
    validacao runtime na linha 91 (`if (mfa !== undefined && mfa !==
    'pending' && mfa !== 'verified' && mfa !== 'not_required')`) era
    correta, mas TypeScript nao conseguia narrow em `mfa: unknown`
    dentro do spread `...(mfa !== undefined ? { mfa } : {})` por causa
    de `exactOptionalPropertyTypes: true` no `tsconfig.base.json`.
  - Fix: `const mfaStatus: AccessTokenPayload['mfa'] = mfa;` antes do
    spread. Tipo da `const` referencia o literal em `identity.types.ts`
    (single source of truth). Validacao runtime mantida.

### Investigacao (nao resolvida nesta release)

- **Gap do CI**: o step `@controle-credito/api:typecheck` rodou em ~1ms
  no ultimo run (2026-06-24 06:55:34) - impossivel para um projeto
  NestJS. Provavelmente cache hit falso do Turbo ou `tsc` exit imediato
  sem compilar. Investigar em sessao separada: adicionar
  `turbo run typecheck --force` ou step explicito de
  `tsc -p tsconfig.build.json --noEmit` no CI para api.

---

## [1.3.0-preview] - 2026-06-24

Sprint 2 / item 2: preview deploy por PR. Foco: setup completo
(workflow + Dockerfiles + docs + compose) que o usuario conecta em
Vercel/Render/Neon no browser.

### Adicionado

- **Preview deploy por PR** completo (Vercel + Render + Neon branching).
  - `apps/api/Dockerfile` (multi-stage, Node 24, argon2 build deps,
    imagem final ~150MB).
  - `apps/web/Dockerfile` (multi-stage, Next.js standalone output).
  - `apps/web/next.config.ts`: `output: 'standalone'` adicionado.
  - `.dockerignore` em apps/api e apps/web (reduz contexto de build).
  - `docker-compose.preview.yml`: stack completa (Postgres+Redis+api+web)
    em portas alternativas (5433/6380/3002/3003) pra nao conflitar com dev.
  - `scripts/wsl-up.sh`: comandos `--preview`, `--preview-down`,
    `--preview-build` adicionados.
  - `.github/workflows/preview-deploy.yml`: detecta mudancas, cria
    Neon branch, dispara Vercel/Render deploy hooks, comenta URLs
    no PR. Cleanup automatico do Neon branch no PR close.
  - `docs/preview-deploy.md`: guia completo de setup (contas externas,
    secrets, troubleshooting).
  - `docs/preview-deploy.md`: exemplo de CORS com dominio Vercel.

### Mudanca de escopo vs. master-plan

- **Master-plan previa "preview deploy por PR (Neon branch + Vercel/Render)"** - linha 246.
- **Esta task implementa o setup completo** (workflow + Dockerfiles + docs).
- **Deploy real fica pra o usuario conectar** (criar contas Vercel/Render/Neon
  e setar secrets no GitHub).

### Nao-objetivos (deferrred pra proximas sprints)

- SMS recovery (Sprint 2 v2).
- Provider concreto de email (Postmark/Resend) (Sprint 2 v2).
- CORS por env var (precisa adicionar CORS_ORIGIN no NestJS).
- Auto-cleanup de branches no Vercel/Render (alem do Neon).

---

## [1.2.0-recovery] - 2026-06-24

Sprint 2 / item 1: recuperacao de senha via email (link magico). PR mergeado: #10.

### Adicionado

- **Recuperacao de senha via email (link magico)** no apps/api e apps/web.
  - `POST /auth/forgot-password` - solicita reset. Sempre retorna 204 (anti-enumeracao).
  - `GET  /auth/reset-password/validate?token=...` - valida token, retorna email mascarado (`u***@e***.com`).
  - `POST /auth/reset-password` - atualiza senha, revoga todas as sessoes, deleta token.
  - Token: 32 bytes random, base64url (43 chars), TTL 1h, single-use, SHA-256 hashed antes de salvar no Redis.
  - Rate limit: 3/15min por IP em `forgot-password`, 3/15min por email, 5/15min por IP em `reset-password`.
  - Senha forte: min 12 chars + 4 classes (upper, lower, digit, special).
  - Paginas em apps/web: `/forgot-password` e `/reset-password` (publicas, server actions).
  - Link "Esqueci minha senha" adicionado em `/login`.
- **EmailService interface** em `packages/infra/src/email.ts` com 2 implementacoes:
  - `ConsoleEmailService` (dev/test) - loga no stdout.
  - `ProviderEmailService` (prod) - stub. Provider concreto (Postmark/Resend) fica pra task separada.
- **Helper `rateLimit(namespace, identifier, limit, windowSec)`** em `packages/infra/src/rate-limit.ts`. Redis-based, fail-open.
- **Helpers `generateRecoveryToken()` + `hashRecoveryToken(token)`** em `packages/infra/src/recovery-token.ts`. Crypto random + SHA-256.
- **Novas env vars**: `EMAIL_PROVIDER_FROM` (default `noreply@controle-credito.local`), `RECOVERY_TOKEN_TTL_SECONDS` (default 3600), `RATE_LIMIT_FORGOT_PASSWORD` (default 3), `RATE_LIMIT_RESET_PASSWORD` (default 5), `RATE_LIMIT_WINDOW_SECONDS` (default 900).
- **`UsersRepository.updatePassword(accountId, userId, newHash)`** - RLS-safe.

### Changed

- **`IdentityModule`** agora registra `RecoveryService` e `RecoveryController`.

### Security

- **Anti-enumeracao**: `forgot-password` sempre retorna 204 (mesma UI/response para email valido/invalido/inexistente). Tempo de resposta similar via dummy `argon2.verify` quando user nao existe.
- **Token single-use**: deletado do Redis apos uso. Re-uso retorna erro.
- **Revogacao de sessoes**: apos reset, `updateLastSessionRevokedAt(now)` + `refresh.revoke(userId)`. User precisa logar de novo em todos devices.
- **Mascaramento de email na tela de reset**: `m***@e***.com` (mostra o suficiente pra confirmar sem vazar).
- **Hash do token antes de salvar**: SHA-256. Se Redis vazar, tokens nao sao diretamente usaveis.
- **Senha forte obrigatoria** (zod schema): 12+ chars + 4 classes (upper, lower, digit, special).

### Mudanca de escopo vs. master-plan

- **Master-plan previa "e-mail + celular" (duplo fator de recovery)** - linha 264 do master-plan, sprint 1.5 item 16.
- **Sprint 2 v1 implementa so' e-mail** (decisao do usuario, 2026-06-24).
- **SMS recovery fica pra Sprint 2 v2** (decisao de produto a confirmar antes).

### Deferred to Sprint 2 v2

- SMS recovery (recuperacao por celular).
- Provider concreto de email (Postmark/Resend) - integracao real.
- Rate limit em outras rotas publicas (`/auth/login`, `/auth/refresh`).
- Lockout apos N tentativas falhas.

---

## [1.1.0-sast] - 2026-06-24

Sprint 1.5 / fechamento de diferidos da Sprint 1. Encerramento: 9/9 itens.
PRs mergeados: #1-#8. Main em `71194cf`.

### Adicionado

- **TTL de refresh token configuravel (default 12h)** via `SESSION_TTL_HOURS` env (commit `17d64b2`). Substitui TTL hardcoded de 30d. Tokens em circulacao nao sao invalidados.
- **MfaGuard** em apps/api + aplicado em `PATCH /accounts/me` (commit `801ddb0`, 16/16 e2e verde).
- **Banner MFA** no dashboard de apps/web - recomenda ativacao quando `mfaStatus !== 'verified'` (commit `74688b6`).
- **Playwright e2e suite basica** para apps/web (commit `ddc56d0`) - 4 testes cobrindo redirect anon, render do form de login, redirect de /dashboard sem sessao, login com creds invalidas.
- **Sentry** integrado em apps/api (`@sentry/nestjs@10.60.0`) e apps/web (`@sentry/nextjs@10.60.0`) (PR #5). `apps/api/src/instrument.ts` + `apps/web/src/sentry.{client,server,edge}.config.ts` + `withSentryConfig` no `next.config.ts`. Sem DSN: Sentry fica noop (dev/CI safe).
- **Mobile-first testing** (PR #7): meta viewport em apps/web (`viewport: { width: 'device-width', initialScale: 1, themeColor: '#0f172a' }`), Playwright com 3 projects (chromium + iPhone 13 + Pixel 7). 12/12 passed (3 projects x 4 tests).
- **Semgrep SAST** (`.github/workflows/semgrep.yml`, PR #8) - Community Edition, 6 rulesets (`p/default`, `p/javascript`, `p/typescript`, `p/owasp-top-ten`, `p/secrets`, `p/security-audit`). NAO bloqueia merge (`continue-on-error: true`). SARIF upload pro GitHub Security tab via `github/codeql-action/upload-sarif@v3`.
- **3 secrets no repo** (via `gh secret set`): `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`, `POSTGRES_APP_SYSTEM_PASSWORD` - tiram senhas hardcoded do `ci.yml` (silencia GitGuardian).

### Changed

- **Upgrade de stack completo** (PRs #1-#4 + commits `94d3473..634077c`):
  - Node 22 → 24 LTS
  - pnpm 9 → 11
  - NestJS 10 → 11
  - Next.js 15 → 16 (Turbopack default; middleware renomeado para `proxy.ts`)
  - TypeScript 5.6 → 5.9
  - GitHub Actions: Node 24 runners, pnpm/action-setup v6
- **CI setup test DB** corrigido em 4 PRs (#1-#4):
  - Usa `localhost:5432` (port mapping do service container) - evita DNS flaky do `services.postgres`.
  - `postgres-client` instalado via `apt-get` (ubuntu-latest nao vem com `psql`).
  - Service `postgres` usa `POSTGRES_USER: postgres` (default bootstrap). Role `app` criado via `CREATE USER ... NOSUPERUSER NOBYPASSRLS` no Setup test DB. Garante que CI espelha prod (RLS real, nao nominal).
  - 3 secrets (`POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`, `POSTGRES_APP_SYSTEM_PASSWORD`) substituem senhas hardcoded.
  - `pnpm-workspace.yaml` precisa `allowBuilds: ['@sentry/cli': true]` (pnpm 11 mudou config de build scripts - `onlyBuiltDependencies` foi removido, substituido por `allowBuilds` no `pnpm-workspace.yaml`).
- `apps/web/next.config.ts`: wrap com `withSentryConfig` (env vars `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` para upload de source maps - opcional).
- `apps/web/src/middleware.ts` → `apps/web/src/proxy.ts` (rename obrigatorio no Next 16). Conteudo preservado.
- `apps/web/src/auth.ts` atualizado pra NextAuth v5 beta.31 (peer aceita Next 16).

### Security

- **Code Scanning habilitado** no repo (Settings > Security > Code security analysis > Set up). Sem isso, `codeql-action/upload-sarif@v3` falha com 403.
- **CodeQL bonus automatico**: ao habilitar Code Scanning, GitHub Actions roda CodeQL Analyze (actions + javascript-typescript) alem do Semgrep. 2 SAST engines rodando por push/PR.
- **LGPD**: `sendDefaultPii: false` em todos os Sentry configs. IP, UA, cookies NAO sao enviados por padrao.

### Fixed

- **Bootstrap superuser bug**: `POSTGRES_USER: app` na imagem `postgres:18` tornava `app` o bootstrap superuser, e Postgres proibe rebaixa-lo. Workaround: usar `POSTGRES_USER: postgres` + `CREATE USER app NOSUPERUSER NOBYPASSRLS` (commit `ac4d2ae`).
- **GitGuardian flagged secrets no PR #5** (8 ocorrencias de "Generic Password" no ci.yml). Resolvido movendo as 3 senhas para `gh secret set`.
- **pnpm 11 build scripts**: `@sentry/cli` precisa ser explicitamente aprovado em `pnpm-workspace.yaml > allowBuilds` (commit `ee0d5ff`).
- **Next 16 Turbopack exige `import('./foo')` sem `.js`** na `apps/web/src/instrumentation.ts`.

### Deferred to Sprint 2 (EXE-002)

- Recuperacao de senha (e-mail + SMS) com providers.
- Preview deploy por PR (Neon branch + Vercel/Render).

---

## [Nao liberado]

### Pendente

- Decisoes juridicas sobre LGPD, transferencia internacional, modulo PREMIUM e provedor LLM.
- DPIA para PREMIUM e dados fora do BR.
- Subprocessadores formais e revisão jurídica final do modo nominal no PREMIUM.

### Em validacao

- **Sprint 2 / EXE-002 — Dominio financeiro** (a iniciar apos go/no-go da Sprint 1.5).

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
- **TypeScript `^5.6.2 → ^5.9.3`** em `package.json` (raiz), `apps/api/package.json`, `apps/web/package.json`, `packages/{contracts,domain,infra,ui}/package.json`. Alinhado com a versao usada pela propria NestJS 11. Sem breaking changes no codigo; typecheck/lint/test continuam 100% verde.

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
