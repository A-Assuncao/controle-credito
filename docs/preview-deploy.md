# Preview Deploy por PR

Setup de preview environment isolado por Pull Request. Cada PR roda
em infra propria (banco, secrets, URLs) sem afetar outros PRs ou
`main`.

## Visao geral

```
PR #10 aberto
  ↓
GitHub Actions: .github/workflows/preview-deploy.yml
  ├─ detect-changes: identifica quais workspaces mudaram
  ├─ create-neon-branch: cria branch do Neon (Postgres fork)
  ├─ trigger-vercel: deploy do apps/web via Vercel Deploy Hook
  ├─ trigger-render: deploy do apps/api via Render Deploy Hook
  └─ comment-pr: comenta no PR com as URLs de preview

PR #10 fechado
  ↓
cleanup-neon-branch: deleta o branch do Neon
```

## Pre-requisitos

### Contas externas (criar uma vez)

- **Neon** (https://console.neon.tech) - Postgres gerenciado. Free tier 0.5GB.
- **Vercel** (https://vercel.com) - Next.js hosting. Free tier generoso.
- **Render** (https://render.com) - Docker hosting. Free tier 750h/mes.

### Habilitar GitHub Container Registry (GHCR)

1. Settings > Packages > Settings (se for org) ou User settings
2. "Improved container support" ja' vem habilitado por default no GitHub Actions.

## Setup passo-a-passo

### 1. Criar projeto Neon

1. Console Neon > New Project
2. Region: AWS US East (ou mais perto do seu Render/Vercel)
3. PostgreSQL 18
4. Salvar:
   - **Project ID** (encontra na URL: `console.neon.tech/app/projects/<PROJECT_ID>/...`)
   - **API Key**: Console > Settings > API Keys > Generate
5. Rodar migration no main branch:
   ```sql
   CREATE USER app WITH PASSWORD 'app' NOSUPERUSER NOBYPASSRLS;
   CREATE USER app_system WITH PASSWORD 'app_system' BYPASSRLS NOSUPERUSER;
   ALTER DATABASE neondb OWNER TO app;
   GRANT CONNECT ON DATABASE neondb TO app_system;
   GRANT USAGE ON SCHEMA public TO app_system;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_system;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_system;
   ```
6. Note: cada branch PR eh um FORK do main branch. As migrations
   precisam rodar de novo (sera feito pelo `pnpm db:migrate` no
   Render automaticamente - Render roda `pnpm db:migrate` no build command).

### 2. Criar servico no Render

1. Render > New > Web Service
2. Connect GitHub repo: `A-Assuncao/controle-credito`
3. Configurar:
   - **Root Directory**: `apps/api` (Render tem field pra isso)
   - **Environment**: Docker (Render le Dockerfile automatico)
   - **Dockerfile Path**: `Dockerfile` (relativo ao root dir)
   - **Plan**: Free
   - **Region**: mesma do Neon
4. Em Environment Variables, setar:
   - `DATABASE_URL` = `postgres://app:app@<NEON_BRANCH_HOST>/<NEON_BRANCH_DB>?sslmode=require` (substituir pelo host do branch Neon)
   - `DATABASE_URL_TEST` = mesmo
   - `DATABASE_URL_SYSTEM` = `postgres://app_system:app_system@<NEON_BRANCH_HOST>/<NEON_BRANCH_DB>?sslmode=require`
   - `REDIS_URL` = URL de um Redis compartilhado (ex: Render Key Value Store free tier, ou Upstash)
   - `NEXTAUTH_URL` = `https://controle-credito-api-pr-<NUM>.onrender.com`
   - `NEXTAUTH_SECRET` = `openssl rand -base64 32`
   - `JWT_SECRET` = `openssl rand -base64 32`
   - `NODE_ENV` = `preview`
   - `PORT_API` = `3001`
5. Em Settings > Build & Deploy:
   - **Branch**: `feat/preview-pr-*` (wildcard - Render faz deploy de cada PR automaticamente)
6. Em Settings > Deploy Hook:
   - Criar Deploy Hook
   - Copiar URL (formato: `https://api.render.com/deploy/srv-xxx?key=yyy`)
   - Esta URL eh o `RENDER_DEPLOY_HOOK` no GitHub Secrets

### 3. Conectar Vercel ao repo

1. Vercel > Add New > Project
2. Import Git Repository: `A-Assuncao/controle-credito`
3. Configurar:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm --filter @controle-credito/web build` (Vercel tem "Override" toggle)
   - **Output Directory**: `.next` (relativo a `apps/web`)
4. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://controle-credito-api-pr-<NUM>.onrender.com` (com placeholder)
   - `NEXTAUTH_URL` = `https://controle-credito-pr-<NUM>.vercel.app`
   - `NEXTAUTH_SECRET` = mesmo do Render
   - `AUTH_SECRET` = mesmo
5. Em Settings > Git > Deploy Hooks:
   - Criar Deploy Hook
   - Copiar URL (formato: `https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy`)
   - Esta URL eh o `VERCEL_DEPLOY_HOOK` no GitHub Secrets

### 4. Configurar secrets no GitHub

1. Ir em `https://github.com/A-Assuncao/controle-credito/settings/secrets/actions/new`
2. Criar 4 secrets:
   - `NEON_API_KEY` - valor: a API key gerada no passo 1
   - `NEON_PROJECT_ID` - valor: o project ID do passo 1
   - `VERCEL_DEPLOY_HOOK` - valor: a URL do passo 3
   - `RENDER_DEPLOY_HOOK` - valor: a URL do passo 2

### 5. Testar

1. Abrir um PR de teste.
2. Workflow `.github/workflows/preview-deploy.yml` deve disparar.
3. Conferir:
   - Neon branch criado (Console Neon > Branches)
   - Vercel preview URL aparece no PR (comentario automatico)
   - Render preview URL aparece no PR (comentario automatico)
   - Login funciona no preview
4. Fechar o PR.
5. Neon branch deve ser deletado automaticamente.

## Estrutura das URLs

| Service | Pattern | Plataforma |
| --- | --- | --- |
| Web | `https://controle-credito-pr-<NUM>.vercel.app` | Vercel |
| API | `https://controle-credito-api-pr-<NUM>.onrender.com` | Render |
| DB | branch `preview-pr-<NUM>` | Neon |

Para customizar, edite as variaveis `VERCEL_PR_URL_PREFIX` e
`RENDER_PR_URL_PREFIX` no workflow, ou ajuste a config do Vercel/Render
pra usar o pattern desejado.

## Como funciona por baixo dos panos

1. **PR aberto/atualizado**: GitHub Actions dispara.
2. **`detect-changes`**: diff entre base e head do PR. Lista quais
   paths mudaram.
3. **`create-neon-branch`** (se api ou packages mudaram): POST pra
   Neon API cria branch `preview-pr-<NUM>` do main. Branch eh um
   fork completo do schema (com dados isolados).
4. **`trigger-vercel`** (se web ou packages mudaram): POST pra Vercel
   Deploy Hook rebuilda o preview. Vercel expoe `https://controle-credito-pr-<NUM>.vercel.app`.
5. **`trigger-render`** (se api ou packages mudaram): POST pra Render
   Deploy Hook. Render rebuilda o servico (configurado com branch
   wildcard `feat/preview-pr-*`). Expoe `https://controle-credito-api-pr-<NUM>.onrender.com`.
6. **`comment-pr`**: gh CLI comenta no PR com as URLs + Neon branch name.
7. **PR fechado**: `cleanup-neon-branch` deleta o branch do Neon.

## Troubleshooting

### Vercel nao cria Preview URL

1. Confirmar que o GitHub App da Vercel tem permissao no repo.
2. Settings > Git > Connected Git Repository > Reconectar.
3. Em Vercel Project > Settings > Git > Production Branch: `main`. Pull Requests: habilita "Automatic Deployments from Pull Requests".

### Render nao pega o branch do PR

1. Render > Service > Settings > Build & Deploy > Branch: deve ser `feat/preview-pr-*` (wildcard).
2. Ou Render nao suporta wildcard - use o pattern `feat/preview-pr-1`, `feat/preview-pr-2`, etc (cada PR vai pro seu branch, mas vc precisa que cada um faca deploy). Pra simplificar, use `*` (todos os branches).

### Neon nao cria branch

1. Conferir `NEON_API_KEY` (deve ser v2 API key, nao legacy).
2. Conferir `NEON_PROJECT_ID` (deve ser o UUID, nao slug).
3. Conferir limites da conta (free tier tem limite de branches).

### Web nao consegue chamar API (CORS)

Vercel e Render estao em dominios diferentes. CORS precisa permitir
o dominio da Vercel no NestJS. Em `apps/api/src/main.ts`:

```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://controle-credito-pr-<NUM>.vercel.app',  // <- adicionar
  ],
  credentials: true,
  // ...
});
```

Para automatizar: passar origin via env var `CORS_ORIGIN` (separada
por virgula) e fazer append no CORS.

### DB nao roda migrations

Render roda build command que pode ou nao rodar migrations. Em
Render > Service > Settings > Build Command:

```
pnpm install --frozen-lockfile && pnpm db:migrate
```

Ou criar um `release` command que roda migrations antes do deploy.

## Limitacoes

- **Custo**: Neon free tier 0.5GB, Vercel free tier 100GB bandwidth, Render
  free tier 750h/mes. Preview PRs nao sao cobrados em prod (so build
  time).
- **Performance**: Cold start do Render pode demorar 30-60s na
  primeira request. Vercel eh mais rapido (~100ms).
- **Secrets**: secrets sao compartilhados entre PRs (mesmo
  `NEXTAUTH_SECRET`). Em prod com dados reais, ideal eh secrets por
  PR, mas free tier nao suporta.
- **DB migration**: Migrations sao aplicadas por PR (NEXTAUTH_URL
  diferente). Migrations destrutivas vao falhar no PR branch porque
  tabela ja existe (main ja migrou). Workaround: migrations idempotentes.

## Referencias

- Neon API: https://api-docs.neon.tech/reference/getting-started-with-neon-api
- Vercel Deploy Hooks: https://vercel.com/docs/git/deploy-hooks
- Render Deploy Hooks: https://docs.render.com/deploys/deploy-hooks
- GitHub Actions: https://docs.github.com/en/actions

**Relacionados:** [[master-plan]], [[architecture]], [[sprint-001-estado]]