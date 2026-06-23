# Controle de Credito

SaaS para gestao de emprestimos pessoais no Brasil, feito para **pessoa fisica** credora.

> **Status atual:** planejamento concluido, aguardando autorizacao de implementacao.
> Fonte da verdade do projeto: [`docs/master-plan.md`](docs/master-plan.md).

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
2. [`docs/architecture.md`](docs/architecture.md) — visao C4 e fluxos criticos (incluindo WhatsApp).
3. [`docs/security-model.md`](docs/security-model.md) — auth, MFA opcional, RLS, auditoria.
4. [`docs/financial-engine.md`](docs/financial-engine.md) — invariantes e cenarios dourados.
5. [`docs/compliance-checklist.md`](docs/compliance-checklist.md) — pareceres juridicos pendentes.
6. [`docs/sprint-1-plan.md`](docs/sprint-1-plan.md) — plano da Sprint 1 (pronto para `AUTORIZO CODAR`).
7. [`docs/adr/`](docs/adr/) — decisoes arquiteturais registradas.

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

| Item                                          | Status                           | Ultima atualizacao |
| --------------------------------------------- | -------------------------------- | ------------------ |
| Planejamento (master-plan)                    | Concluido                        | 2026-04-22         |
| Documentacao tecnica (v0.2.0)                 | **Concluida**                    | 2026-06-20         |
| Fundacao conta/IAM/auditoria (EXE-001)        | `EM_ANDAMENTO (preparacao)`      | 2026-06-20         |
| Contratos + parcelas + recebimentos (EXE-002) | `NAO_INICIADO`                   | —                  |
| Caixa + projecoes + dashboard (EXE-003)       | `NAO_INICIADO`                   | —                  |
| Risco + WhatsApp + e-mail (EXE-004)           | `NAO_INICIADO`                   | —                  |
| Billing SaaS + limites por plano (EXE-005)    | `NAO_INICIADO`                   | —                  |
| PREMIUM modo seguro (EXE-006)                 | `NAO_INICIADO`                   | —                  |
| PREMIUM nominal cross-account (EXE-007)       | `BLOQUEADO` (validacao juridica) | —                  |

**Gate atual:** sem `AUTORIZO CODAR`. Nenhum codigo de producao sera escrito sem autorizacao explicita com escopo definido (regra 1 do master-plan).

---

## Stack-alvo (decidida em ADR-0001, 0002, 0003, 0004, 0005, 0006, 0007, 0019, 0020)

| Camada          | Tecnologia                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| Backend         | Node.js 22 LTS + TypeScript 5 (strict) + NestJS 10 + TypeORM                    |
| Frontend        | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui                     |
| Banco           | PostgreSQL 16 (Neon, region `us-east-1`) com **RLS ativo**                      |
| Cache + Filas   | Redis (Upstash) + BullMQ                                                        |
| Auth            | Ory Kratos + Hydra (self-hosted) com MFA TOTP opcional                          |
| E-mail          | Postmark                                                                        |
| WhatsApp        | Meta Cloud API (oficial) — canal principal com usuario (notificacoes, comandos) |
| LLM             | Anthropic Claude (Sonnet 4.6 / Opus 4.8) — apenas no plano Ilimitado            |
| Billing         | Stripe                                                                          |
| Observabilidade | OpenTelemetry -> Grafana Cloud + Sentry                                         |
| Storage         | Cloudflare R2 (S3-compativel)                                                   |
| CI/CD           | GitHub Actions + Neon preview branches                                          |
| Monorepo        | pnpm workspaces + Turborepo                                                     |

---

## Como contribuir (futuro)

> Quando a implementacao iniciar, este README sera expandido com setup de dev, testes e convencoes.

Por enquanto:

- Mudancas em **arquitetura** -> primeiro atualizar `docs/master-plan.md`, depois abrir PR.
- Mudancas em **decisoes registradas** -> novo ADR em `docs/adr/`.
- Toda entrega `IMPLANTADO` ou `VALIDADO` exige atualizar master-plan + CHANGELOG.

---

## Licenca

Proprietario. Todos os direitos reservados.
