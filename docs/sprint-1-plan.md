# Plano da Sprint 1 — Fundação conta/IAM/auditoria

> **Status:** Pronto para execução. Requer **AUTORIZO CODAR** explicito do sponsor.
> Referencia no quadro de execução: `EXE-001` (master-plan seção "Controle de execução do desenvolvimento").
> **Versão ajustada** para o modelo single-user (sem RBAC, MFA opcional, sem tenant multi-user).

---

## Objetivo da sprint

Entregar a **fundação segura** sobre a qual todos os modulos seguintes se apoiam:

- Conta pessoal isolada por `account_id` com **RLS ativo** no banco.
- Identidade e autenticação OIDC com **MFA opcional** (banner recomendando).
- Single-session ativa (login em outro dispositivo revoga o anterior).
- Recuperação de senha por e-mail + celular.
- Trilha de auditoria imutável para ações sensiveis (estrutura pronta).
- UI shell com login, MFA setup, dashboard placeholder.
- Testes de **isolamento por conta** passando em CI.

**Sem regras de negócio de dominio nesta sprint.** Contratos, parcelas, caixa e risco entram nas sprints seguintes.

---

## Escopo (in / out)

### Dentro

- Esqueleto do monorepo (pnpm + Turborepo).
- App `api` (NestJS) com modulos `identity`, `accounts`, `audit`, `common`.
- App `web` (Next.js) com fluxo de login + MFA setup + dashboard placeholder.
- Package `domain` vazio mas com estrutura para motor financeiro (entra na Sprint 2).
- Package `contracts` com schemas Zod compartilhados.
- Package `infra` com config de DB/Redis/OTel.
- Migrations iniciais: `accounts`, `users`, `audit_log`, `sessions`.
- Auth via Ory Kratos + Hydra.
- Recuperação de senha por e-mail + celular (duplo fator).
- Audit interceptor gravando em `audit_log`.
- AccountContextMiddleware injetando `account_id` no request e na transação.
- RLS policies nas tabelas multi-account.
- Testes: unitarios (NestJS), integração (DB real via Docker), e2e (Playwright).
- CI com lint + typecheck + testes + SAST basico.
- Observabilidade: OTel + Sentry + logger com redaction.
- Documentação: atualizar master-plan com status `EM_ANDAMENTO`, este plano, ADR-0018 (modelo single-user).

### Fora (sprints seguintes)

- Dominio financeiro (Sprint 2 — `EXE-002`).
- Caixa + dashboard (Sprint 3 — `EXE-003`).
- Risco + WhatsApp + notificações (Sprint 4 — `EXE-004`).
- Billing SaaS (Sprint 5 — `EXE-005`).
- PREMIUM (F5/F6/F7 — bloqueado por juridico).
- ML/bureau (FUTURO).

---

## Estrutura de pastas a ser criada

```
controle-crédito/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── modules/
│   │   │   │   ├── identity/         # auth, login, MFA, sessão
│   │   │   │   ├── accounts/         # cadastro, perfil, exclusão
│   │   │   │   └── audit/            # trilha imutável
│   │   │   ├── common/
│   │   │   │   ├── guards/           # MfaGuard, SessionGuard
│   │   │   │   ├── interceptors/     # CorrelationId, AuditLogger, Redaction
│   │   │   │   ├── filters/          # GlobalExceptionFilter
│   │   │   │   ├── pipes/            # ZodValidationPipe
│   │   │   │   ├── decorators/       # @CurrentUser, @AccountId, @RequireMfa
│   │   │   │   └── middleware/       # AccountContextMiddleware
│   │   │   ├── infra/
│   │   │   │   ├── db/               # data-source.ts, migrations/
│   │   │   │   ├── redis/            # cache.service.ts, raté-limiter.ts
│   │   │   │   ├── otel/             # tracing.ts
│   │   │   │   └── logger/           # pino + redaction
│   │   │   └── config/               # env validation (Zod)
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   ├── integration/          # com DB descartavel
│   │   │   └── e2e/
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── app/                  # App Router
│       │   │   ├── (auth)/           # /login, /mfa-setup, /forgot-password
│       │   │   ├── (app)/            # /dashboard, /settings
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   ├── components/           # shadcn/ui
│       │   ├── lib/                  # api client, auth helpers
│       │   └── styles/
│       ├── tailwind.config.ts
│       ├── next.config.ts
│       └── package.json
├── packages/
│   ├── contracts/                    # Zod schemas + TS types
│   │   ├── src/
│   │   │   ├── identity.ts
│   │   │   ├── account.ts
│   │   │   ├── audit.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── domain/                       # puro, sem I/O
│   │   ├── src/
│   │   │   ├── money/                # Cents, roundHalfEven
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   ├── infra/                        # config compartilhada
│   │   ├── src/
│   │   │   ├── env.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── ui/                           # shadcn components
│       ├── src/
│       └── package.json
├── docker/
│   ├── docker-compose.dev.yml        # postgres + redis locais
│   └── docker-compose.test.yml       # para CI
├── scripts/
│   ├── check-rls-bypass.sh           # falha CI se detectar BYPASSRLS=true
│   └── seed-account.ts
├── docs/
│   ├── master-plan.md                # existente, atualizado
│   ├── architecture.md               # existente
│   ├── security-model.md             # existente
│   ├── financial-engine.md           # existente
│   ├── compliance-checklist.md       # existente
│   ├── sprint-1-plan.md              # este arquivo
│   ├── adr/                          # 17+ ADRs existentes
│   ├── runbooks/                     # a criar: identity-outage.md, db-failover.md
│   └── compliance/
│       ├── dpia-templaté.md
│       └── subprocessors.md
├── .github/
│   └── workflows/
│       ├── ci.yml                    # lint + typecheck + test + sast
│       ├── preview.yml               # Neon branch + deploy efemero
│       └── release.yml               # release-please
├── .vscode/
│   └── settings.json
├── .editorconfig
├── .gitignore
├── .nvmrc                           # 22
├── .prettierrc
├── .eslintrc.cjs
├── commitlint.config.cjs
├── release-please-config.json
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                     # raiz
├── README.md                        # existente
├── CHANGELOG.md                     # existente
└── LICENSE
```

**Mudanças vs plano original:**

- Sem `modules/tenant/` (substituido por `accounts/` — cada conta = 1 pessoa).
- Sem `user_roles`, `roles`, `permissions` (modelo single-user).
- `AccountContextMiddleware` no lugar de `TenantContextMiddleware`.

---

## Migrations a criar (Sprint 1)

### `001_init_accounts.ts`

```ts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active',  -- active, suspended, canceled
  settings JSONB NOT NULL DEFAULT '{}',
  creatéd_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatéd_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `002_init_users.ts`

```ts
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kratos_identity_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,        -- celular para recuperação
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_required BOOLEAN NOT NULL DEFAULT false, -- true se ativou PREMIUM nominal
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  last_session_revoked_at TIMESTAMPTZ,
  creatéd_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatéd_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)                     -- 1 usuario por conta
);
CREATE INDEX idx_users_account ON users(account_id);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_account_isolation ON users
  USING (account_id = current_setting('app.account_id', true)::uuid)
  WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);
```

### `003_init_audit.ts`

```ts
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID,
  ip_address INET,
  user_agent TEXT,
  creatéd_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_account_creatéd ON audit_log(account_id, creatéd_at DESC);
CREATE INDEX idx_audit_action ON audit_log(account_id, action);

-- Append-only enforcement
CREATE OR REPLACE FUNCTION audit_log_block_mutations()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_updaté BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutations();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutations();
```

---

## Endpoints REST da Sprint 1

### Identidade

```
POST   /api/auth/login              # delega ao Kratos
POST   /api/auth/logout
POST   /api/auth/mfa/setup          # inicia setup TOTP (retorna QR)
POST   /api/auth/mfa/verify         # confirma código TOTP
POST   /api/auth/mfa/disable        # desativa MFA (requer senha)
POST   /api/auth/password/reset     # inicia recuperação (e-mail + celular)
POST   /api/auth/password/confirm   # confirma códigos (e-mail + SMS)
GET    /api/auth/me                 # current user (perfil, mfa_enabled)
```

### Conta (proprio titular)

```
GET    /api/accounts/me
PATCH  /api/accounts/me             # atualizar nome, telefone
GET    /api/accounts/me/settings
PATCH  /api/accounts/me/settings
POST   /api/accounts/me/export      # solicita export (LGPD art. 18, V)
POST   /api/accounts/me/delete      # solicita exclusão (LGPD art. 18, VI)
GET    /api/accounts/me/audit-log   # trilha (com filtros)
```

---

## Criterios de aceite (Definition of Done)

### Fundação tecnica

- [ ] `pnpm install` instala todos os workspaces sem erro.
- [ ] `pnpm dev` sobe API (NestJS) + Web (Next.js) + Postgres + Redis via docker-compose.
- [ ] `pnpm build` builda todos os pacotes.
- [ ] `pnpm test` roda unitarios + integração.
- [ ] `pnpm test:e2e` roda Playwright.

### Banco e isolamento

- [ ] Migrations rodam em ordem em banco vazio.
- [ ] RLS ativo em `users`.
- [ ] Teste `account-isolation.spec.ts` tenta cross-account e falha corretamente.
- [ ] Script `check-rls-bypass.sh` falha CI se role de app tiver `BYPASSRLS=true`.

### Auth

- [ ] Login via Kratos retorna access token + refresh.
- [ ] MFA TOTP **opcional** com setup via QR code.
- [ ] Banner recomenda MFA no primeiro login.
- [ ] **Single-session**: novo login revoga sessão anterior.
- [ ] Sessão com TTL de 12h.
- [ ] Recuperação de senha exige confirmação por e-mail **e** SMS.
- [ ] Sem `user_roles` / RBAC no schema.

### Auditoria

- [ ] `audit_log` recebe registros para login, logout, mutações em `users`.
- [ ] Trigger bloqueia UPDATE/DELETE em `audit_log`.
- [ ] `GET /api/accounts/me/audit-log` filtra por account.

### UI

- [ ] `/login` aceita e-mail/senha.
- [ ] `/mfa-setup` guia configuração TOTP com QR code.
- [ ] `/forgot-password` pede e-mail + celular.
- [ ] `/dashboard` placeholder mostra usuario logado e card "Em construção".
- [ ] Banner de MFA aparece até ser ativado.
- [ ] Mobile-first: testado em viewport 375x812 (iPhone X).

### CI/CD

- [ ] Workflow `ci.yml` roda lint + typecheck + testes + SAST em todo PR.
- [ ] Workflow `preview.yml` cria branch Neon + deploy efemero por PR.
- [ ] Branch protection em `main` exige CI verde + 1 aprovação.

### Observabilidade

- [ ] OTel SDK envia traces para console (em dev) e OTLP endpoint (em prod).
- [ ] Sentry captura erros 500 com scrubbing de PII.
- [ ] Logger mascara CPF, e-mail, telefone em logs.

### Documentação

- [ ] `master-plan.md` atualizado: `EXE-001` ja em `EM_ANDAMENTO`; registros de entrega criados.
- [ ] `CHANGELOG.md` com entrada da Sprint 1.
- [ ] `docs/runbooks/identity-outage.md` redigido (ja existe).
- [ ] `docs/runbooks/db-failover.md` redigido (ja existe).
- [ ] ADR-0018 ja existe (modelo single-user).

---

## Estimativa

| Bloco                                                     | Tempo estimado     |
| --------------------------------------------------------- | ------------------ |
| Setup monorepo + tooling                                  | 1 dia              |
| Migrations + RLS                                          | 1 dia              |
| Auth (Kratos integration) + MFA opcional                  | 2 dias             |
| Recuperação de senha (e-mail + celular)                   | 1 dia              |
| Single-session enforcement                                | 0.5 dia            |
| Audit log + interceptor                                   | 1 dia              |
| UI shell (login, MFA, recuperação, dashboard placeholder) | 2 dias             |
| Testes (unit + integração + e2e)                          | 2 dias             |
| CI/CD workflows                                           | 1 dia              |
| Observabilidade + logger redaction                        | 1 dia              |
| Documentação final                                        | 0.5 dia            |
| **Total**                                                 | **~13 dias uteis** |

Para 1 dev full-time: ~2.5 semanas.
Para 2 devs (1 backend + 1 frontend): ~1.5 semanas.

**Reduzido vs plano original** pela remoção de RBAC e user_roles.

---

## Riscos e mitigações

| Risco                                                                | Mitigação                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Curva de aprendizado do Ory Kratos + Hydra                           | Pair programming inicial, runbook especifico                     |
| Bugs sutis de RLS (algum caminho esquece `SET LOCAL app.account_id`) | Testes de isolamento obrigatorios + checklist em PR              |
| Single-session pode frustrar usuarios                                | UX clara: avisó ao revogar sessão anterior                       |
| MFA atrapalha onboarding                                             | Banner recomenda, mas não obriga                                 |
| Neon laténcy de região unica                                         | Aceitar no MVP; replicacao para região BR (PRECISA DE VALIDACAO) |
| Tempo de setup do monorepo                                           | Script `bootstrap.sh` automatizado                               |

---

## Apos a Sprint 1 (preparação)

- Revisar metricas: tempo de onboarding de novo dev, MTTR de seed de conta.
- Validar feedback de usó interno.
- Iniciar **Sprint 2 (EXE-002)**: tomadores, contratos + parcelas + recebimentos.

---

## Comando para autorizar

Quando aprovado, sponsor emite:

> **AUTORIZO CODAR**
> **Escopo:** Sprint 1 conforme `docs/sprint-1-plan.md`.
> **Owner:** Backend Lead + Security Lead.
> **Classificação:** CORE V1.

Após autorização:

1. Atualizar `master-plan.md`: `EXE-001` → `EM_ANDAMENTO` (código).
2. Atualizar `CHANGELOG.md`: entrada da Sprint 1 com data.
3. Criar branch `sprint/001-foundation`.
4. Iniciar implementação seguindo este plano.
