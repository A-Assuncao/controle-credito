# Arquitetura — Visão C4

> Documento complementar ao [`master-plan.md`](master-plan.md). Aqui o detalhamento técnico fica explícito; mudanças relevantes devem primeiro atualizar o `master-plan.md` (regra 8 das regras persistentes).

---

## Nível 1 — Contexto

```
┌────────────────────────────────────────────────────────────────────┐
│                          Pessoas / Sistemas                        │
│                                                                    │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │ Owner    │    │ Admin    │    │ Operador │    │ Financeiro│    │
│   │ do Tenant│    │ do Tenant│    │          │    │           │    │
│   └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬──────┘    │
│        │               │               │               │          │
│        └───────────────┴───────────────┴───────────────┘          │
│                                │                                  │
│                                ▼                                  │
│                  ┌─────────────────────────────┐                  │
│                  │   App Web (Next.js)         │                  │
│                  │   mobile-first, PWA-ready   │                  │
│                  └────────────┬────────────────┘                  │
│                               │ HTTPS                             │
│                               ▼                                   │
│                  ┌─────────────────────────────┐                  │
│                  │   API (NestJS)              │                  │
│                  │   monólito modular + eventos│                  │
│                  └────────────┬────────────────┘                  │
│                               │                                   │
│        ┌──────────────┬───────┼────────┬──────────────┐           │
│        ▼              ▼       ▼        ▼              ▼           │
│   ┌────────┐   ┌────────┐ ┌──────┐ ┌────────┐  ┌──────────┐       │
│   │ Postgres│  │ Redis  │ │ OIDC │ │ BullMQ │  │ Outbound │       │
│   │ (Neon) │   │(Upstash)│ │(Kratos│ │ Workers│  │ Integr.  │       │
│   └────────┘   └────────┘ │+Hydra)│ └────────┘  └──────────┘       │
│                            └──────┘                                │
└────────────────────────────────────────────────────────────────────┘
```

**Atores externos:**

- **Pessoa 1 (Usuario do sistema):** pessoa fisica, 1 por conta, opera empréstimos. Recebe notificações, manda comandos e conversa com LLM (Ilimitado) via WhatsApp.
- **Pessoa 2 (Tomador):** recebe o empréstimo; **não acessa o sistema**; **não recebe mensagem do nossó WhatsApp** — comunicação acontece no WhatsApp particular entre credor e tomador.
- **Sistemas externos:** Stripe (billing), Postmark (e-mail complementar), Meta Cloud API (WhatsApp — apenas canal com usuario; nunca com tomador), Anthropic (LLM no Ilimitado), bureau adapter (FUTURO).

---

## Nível 2 — Containers

| Container           | Tecnologia                                | Responsabilidade                                       |
| ------------------- | ----------------------------------------- | ------------------------------------------------------ |
| **Web**             | Next.js 15                                | UI mobile-first, Server Components, rotas autenticadas |
| **API**             | NestJS 10 + TypeORM                       | Casos de uso, domínio, integração com DB/filas         |
| **Worker**          | NestJS (mesma base, entrypoint diferente) | BullMQ: notificações, projeções, integrações           |
| **Postgres**        | Neon PostgreSQL 16                        | Fonte da verdade; RLS ativo                            |
| **Redis**           | Upstash Redis                             | Cache + filas BullMQ                                   |
| **OIDC**            | Ory Kratos + Hydra                        | Identidade, autenticação, MFA                          |
| **Storage**         | Cloudflare R2                             | Documentos, comprovantes, exports                      |
| **Observabilidade** | Grafana Cloud + Sentry                    | Traces, métricas, logs, erros                          |

---

## Nível 3 — Componentes (API)

A API é organizada em **módulos NestJS** com fronteiras claras. Cada módulo tem seu próprio aggregaté root (DDD-lite) e expõe casos de usó via camada de aplicação.

```
apps/api/src/
├── modules/
│   ├── identity/        # IAM, RBAC, sessões, MFA
│   ├── tenant/          # Tenant, billing, features flags
│   ├── parties/         # Tomadores, indicações, relacionamentos
│   ├── contracts/       # Motor de contratos (delega para domain)
│   ├── installments/    # Parcelas
│   ├── payments/        # Recebimentos + alocação
│   ├── cash/            # Caixa, projeções, fechamentos
│   ├── risk/            # Motor de risco + override
│   ├── reputation/      # PREMIUM (modo safe_aggregatéd)
│   ├── notifications/   # E-mail (Postmark)
│   ├── billing/         # Stripe adapters
│   ├── audit/           # Trilha imutável
│   └── integrations/    # Bureau adapter, WhatsApp (futuro)
├── common/
│   ├── guards/          # TenantGuard, RbacGuard, MfaGuard
│   ├── interceptors/    # CorrelationId, Logging, Redaction
│   ├── filters/         # ExceptionFilter global
│   ├── pipes/           # ZodValidationPipe
│   └── decorators/
├── workers/             # Entry point separado
└── infra/
    ├── db/              # TypeORM data source, migrations
    ├── redis/           # BullMQ queues
    ├── otel/            # OpenTelemetry setup
    └── logger/          # Pino + redaction
```

**Regras de fronteira entre módulos:**

- Módulo **não importa diretamente** outro módulo — usa apenas contratos públicos via `modules/<x>/contracts/`.
- Eventos de domínio publicados via `EventBus` interno (NestJS EventEmitter + Outbox pattern para garantia de entrega).
- Toda mutação que toca dados sensíveis (CPF, risco, override) passa por **audit interceptor**.

---

## Fluxo crítico 1 — Criação de contrato

```
[Operador]                  [API]                      [Domínio]            [DB]            [Worker]
     │                         │                            │                 │                 │
     │  POST /contracts        │                            │                 │                 │
     │  { tomador, valor,      │                            │                 │                 │
     │    prazo, schema_id }   │                            │                 │                 │
     ├────────────────────────▶│                            │                 │                 │
     │                         │  validar payload (Zod)     │                 │                 │
     │                         │  carregar TenantContext    │                 │                 │
     │                         │  avaliar risco             │                 │                 │
     │                         ├───────────────────────────▶│                 │                 │
     │                         │                            │  score, fatores │                 │
     │                         │                            │  travas, alerts │                 │
     │                         │                            │  gravar eval    │                 │
     │                         │                            ├────────────────▶│                 │
     │                         │                            │                 │  RiskEvaluation │
     │                         │  se hard_block             │                 │                 │
     │                         │    exigir justificativa    │                 │                 │
     │                         │  gerar contrato via        │                 │                 │
     │                         │   ContractEngine           │                 │                 │
     │                         ├───────────────────────────▶│                 │                 │
     │                         │                            │  cronograma     │                 │
     │                         │                            │  freeze schema  │                 │
     │                         │                            ├────────────────▶│                 │
     │                         │                            │                 │ Contract+Inst.  │
     │                         │  emitir eventos            │                 │                 │
     │                         │  ContractCreatéd           │                 │                 │
     │                         ├─────────────────────────────────────────────────┼──────────────▶│
     │                         │                            │                 │   enfileirar    │
     │                         │                            │                 │   notify + proj │
     │  201 Creatéd            │                            │                 │                 │
     │  { contract, inst.,    │                            │                 │                 │
     │    risk_eval }         │                            │                 │                 │
     ◀─────────────────────────│                            │                 │                 │
```

---

## Fluxo crítico 2 — Recebimento de pagamento

```
[Operador]            [API]                  [Domínio]              [DB]                  [Worker]
   │                    │                        │                     │                       │
   │  POST /payments    │                        │                     │                       │
   │  { installment_id, │                        │                     │                       │
   │    valor, data }    │                        │                     │                       │
   ├───────────────────▶│                        │                     │                       │
   │                    │  lock installment      │                     │                       │
   │                    │  SELECT FOR UPDATE     │                     │                       │
   │                    ├─────────────────────────────────────────────▶│                       │
   │                    │                        │                     │                       │
   │                    │  alocar (mora→multa    │                     │                       │
   │                    │   →juros→principal)    │                     │                       │
   │                    ├───────────────────────▶│                     │                       │
   │                    │                        │                     │                       │
   │                    │  criar Payment         │                     │                       │
   │                    │  criar Allocations     │                     │                       │
   │                    │  atualizar Installment │                     │                       │
   │                    │  emitir FinancialEvent │                     │                       │
   │                    ├─────────────────────────────────────────────▶│                       │
   │                    │                        │                     │  Payment + Events     │
   │                    │  retornar recibo       │                     │                       │
   │  201 { recibo,     │                        │                     │                       │
   │       alocação }   │                        │                     │                       │
   ◀────────────────────│                        │                     │                       │
   │                    │                        │                     │                       │
   │                    │  enfileirar projeção   │                     │                       │
   │                    ├──────────────────────────────────────────────────────────────────────▶│
   │                    │                        │                     │                       │ recalcula
   │                    │                        │                     │                       │ saldo + cache
```

---

## Fluxo crítico 3 — Consulta CPF (PREMIUM)

```
[Analista risco]      [API]                    [Audit]            [ReputationService]      [Bureau*]
   │                    │                          │                     │                       │
   │  POST              │                          │                     │                       │
   │  /cpf/queries      │                          │                     │                       │
   │  { cpf, contexto } │                          │                     │                       │
   ├───────────────────▶│                          │                     │                       │
   │                    │  validar MFA             │                     │                       │
   │                    │  validar permissão       │                     │                       │
   │                    │  verificar cota          │                     │                       │
   │                    │  BEGIN                   │                     │                       │
   │                    ├─────────────────────────▶│                     │                       │
   │                    │  gerar CpfQuery pendente │                     │                       │
   │                    │                          │                     │                       │
   │                    │  consultar serviço       │                     │                       │
   │                    ├─────────────────────────────────────────────▶│                       │
   │                    │                          │                     │  modo safe_aggregatéd │
   │                    │                          │                     │  retorna só sinal     │
   │                    │                          │                     │  agregado             │
   │                    │                          │                     │  (se modo nominal,    │
   │                    │                          │                     │   passa por bureau    │
   │                    │                          │                     │   via adapter)        │
   │                    │  atualizar CpfQuery      │                     │                       │
   │                    │  com resultado           │                     │                       │
   │                    ├─────────────────────────▶│                     │                       │
   │                    │  COMMIT                  │                     │                       │
   │                    │                          │                     │                       │
   │  200 { sinal,      │                          │                     │                       │
   │       explicação } │                          │                     │                       │
   ◀────────────────────│                          │                     │                       │
   │                    │                          │                     │                       │
   │                    │  emitir CpfQueried       │                     │                       │
   │                    ├──────────────────────────────────────────────────────────────────────▶│
   │                    │                          │                     │                       │ audit trail
                                                                                  * Bureau só com
                                                                                    parecer jurídico
                                                                                    favorável
```

---

## Fluxo crítico 4 — Geração de modelo de cobrança (sistema NUNCA fala com tomador)

```
[Usuario]                  [API]                              [DB]
   │                          │                                  │
   │  comando "cobrar Joao"   │                                  │
   │  (via WhatsApp ou app)    │                                  │
   ├─────────────────────────▶│                                  │
   │                          │  carregar:                       │
   │                          │  - tomador (Joao)                │
   │                          │  - parcela(s) atrasada(s)        │
   │                          │  - política do usuario           │
   │                          │  - tier (define modelos)         │
   │                          ├─────────────────────────────────▶│
   │                          │                                  │
   │                          │  selecionar modelo:              │
   │                          │  - Essencial: fixo               │
   │                          │  - Pro: 1 dos 4 pre-definidos    │
   │                          │  - Ilimitado: custom ou LLM      │
   │                          │                                  │
   │                          │  substituir variaveis:           │
   │                          │  {{nome}} = "Joao"               │
   │                          │  {{valor}} = "R$ 500,00"         │
   │                          │  {{data}} = "15/06/2026"         │
   │                          │                                  │
   │  modelo de cobranca:     │                                  │
   │  "Ola Joao, tudo bem?    │                                  │
   │   Estou passando para    │                                  │
   │   lembrar da parcela     │                                  │
   │   de R$ 500,00 que tem   │                                  │
   │   vencimento em 15/06.   │                                  │
   │   Casó ja tenha feito o  │                                  │
   │   pagamento, por favor   │                                  │
   │   desconsidere.          │                                  │
   │   Obrigado(a)!"          │                                  │
   ◀─────────────────────────│                                  │
   │                          │                                  │
   │  usuario copia/encaminha │                                  │
   │  manualmente pelo        │                                  │
   │  WhatsApp dele (particular)                                  │
```

**Premissas:**

- Sistema **NAO envia** para o tomador em nenhum momento.
- Modelo e gerado **como texto** e exibido ao usuario no WhatsApp ou no app.
- Variaveis são substituidas com dados reais antes de mostrar.
- Tomador não aparece na base de WhatsApp da Meta (somente o usuario).
- Compliance: modelo inclui disclaimer ("casó ja tenha feito o pagamento, desconsidere").

---

## Fluxo crítico 5 — Comando estruturado do usuario via WhatsApp

```
[Usuario]              [Meta Cloud API]            [API]                  [Parser]            [DB]
   │                          │                       │                       │                 │
   │  "cobrar João"           │                       │                       │                 │
   ├─────────────────────────▶│                       │                       │                 │
   │                          │  webhook inbound      │                       │                 │
   │                          ├──────────────────────▶│                       │                 │
   │                          │                       │  identificar user     │                 │
   │                          │                       │  pelo numero          │                 │
   │                          │                       ├──────────────────────▶│                 │
   │                          │                       │  carregar: user,      │                 │
   │                          │                       │  tier, contexto       │                 │
   │                          │                       │◀──────────────────────│                 │
   │                          │                       │                       │                 │
   │                          │                       │  parsear comando:     │                 │
   │                          │                       │  regex/whitelist      │                 │
   │                          │                       │  → action: "cobrar"   │                 │
   │                          │                       │  → target: "João"     │                 │
   │                          │                       │                       │                 │
   │                          │                       │  buscar João          │                 │
   │                          │                       ├──────────────────────▶│                 │
   │                          │                       │◀──────────────────────│                 │
   │                          │                       │                       │                 │
   │                          │                       │  gerar modelo         │                 │
   │                          │                       │  (variaveis resolvidas)│                │
   │                          │                       │                       │                 │
   │                          │  mensagem de          │                       │                 │
   │                          │  resposta             │                       │                 │
   │                          │◀──────────────────────│                       │                 │
   │  "Modelo para João:      │                       │                       │                 │
   │   'Ola João, ...         │                       │                       │                 │
   │   [modelo] ...           │                       │                       │                 │
   │   Copie e encaminhe.'"   │                       │                       │                 │
   ◀──────────────────────────│                       │                       │                 │
```

**Premissas:**

- Apenas usuario **Ilimitado** tem LLM. Essencial e Pro usam apenas **comandos estruturados**.
- Mensagens de numeros não vinculados são ignoradas (anti-spoofing).
- Comandos são **gratuitos** (não contam como mensagens Meta; resposta cai dentro da janela 24h do usuario).
- Raté limit: 30 comandos/hora por usuario.
- Comando `parar` pausa notificações; reativacao só pelo app (anti-abuso).

**Parser de comandos:**

- v1: parser simples (whitelist + regex), sem NLP.
- Tokens reconhecidos: `status`, `tomadores`, `cobrar`, `parcela`, `modelo`, `ajuda`, `parar`, `retomar`, `pago`, `sim`, `não`.
- Nomes de tomadores: match por prefixo (case-insensitive). Se ambiguo, pede esclarecimento.
- Mensagens não reconhecidas (no Essencial/Pro): "Comando não reconhecido. Envie `ajuda`." No Ilimitado: vai para LLM.

---

## Fluxo crítico 6 — LLM conversacional (Ilimitado)

```
[Usuario]                  [API]                          [LLM Service]              [Anthropic]             [DB]
   │                          │                                 │                        │                     │
   │  "Quanto o João tá        │                                 │                        │                     │
   │   me devendo?"            │                                 │                        │                     │
   ├─────────────────────────▶│                                 │                        │                     │
   │                          │  carregar contexto:             │                        │                     │
   │                          │  - user_id, tier=Ilimitado      │                        │                     │
   │                          │  - tools permitidas             │                        │                     │
   │                          │  - resumo (anonimizado)         │                        │                     │
   │                          │  - historico conversa recente   │                        │                     │
   │                          ├────────────────────────────────▶│                        │                     │
   │                          │                                 │  POST /v1/messages     │                     │
   │                          │                                 │  { tools, messages }   │                     │
   │                          │                                 ├───────────────────────▶│                     │
   │                          │                                 │                        │                     │
   │                          │                                 │  tool_use:             │                     │
   │                          │                                 │  list_installments     │                     │
   │                          │                                 │  (party="Joao")        │                     │
   │                          │                                 │◀───────────────────────│                     │
   │                          │  executar tool                  │                        │                     │
   │                          ├─────────────────────────────────────────────────────────────│                     │
   │                          │                                                                            │
   │                          │◀────────────────────────────────────────────────────────────────────────────│
   │                          │  parcelas: [{R$ 500, vencida 5d}, {R$ 500, vence 15/07}]     │                     │
   │                          │                                                                            │
   │                          │  enviar tool_result                                                 │                     │
   │                          ├────────────────────────────────▶│                                  │                     │
   │                          │                                 │  POST /v1/messages    │                     │
   │                          │                                 ├─────────────────────▶│                     │
   │                          │                                 │                       │                     │
   │                          │                                 │  resposta natural:    │                     │
   │                          │                                 │  "O João tá te        │                     │
   │                          │                                 │   devendo R$ 1.000.   │                     │
   │                          │                                 │   A próxima vence     │                     │
   │                          │                                 │   em 15/07. Quer      │                     │
   │                          │                                 │   um modelo de        │                     │
   │                          │                                 │   cobrança?           │                     │
   │                          │                                 │   Responda SIM."      │                     │
   │                          │                                 │◀──────────────────────│                     │
   │                          │  resposta + tool_use_log        │                                  │                     │
   │                          │◀────────────────────────────────│                                  │                     │
   │                          │                                                                            │
   │                          │  enviar mensagem (Meta)                                                │                     │
   │                          │  (templaté ou livre se dentro 24h)                                     │                     │
   │                          │                                                                            │
   │  "O João tá te devendo   │                                                                            │
   │   R$ 1.000. A próxima    │                                                                            │
   │   vence em 15/07. Quer   │                                                                            │
   │   um modelo?"            │                                                                            │
   ◀─────────────────────────│                                                                            │
```

**Fluxo de acao com confirmacao:**

```
[Usuario]                  [API]                    [LLM]                          [DB]
   │                          │                       │                              │
   │  "Cria contrato de       │                       │                              │
   │   R$ 1.000 pra Maria     │                       │                              │
   │   em 3x"                 │                       │                              │
   ├─────────────────────────▶│                       │                              │
   │                          │  carregar contexto    │                              │
   │                          ├──────────────────────▶│                              │
   │                          │                       │  tool_use: creaté_contract   │
   │                          │                       │  (needs_confirmation=true)   │
   │                          │                       │                              │
   │                          │  gerar confirmation   │                              │
   │                          │  token                │                              │
   │                          │                       │                              │
   │  "Confirma criar         │                       │                              │
   │   contrato de R$ 1.000   │                       │                              │
   │   para Maria em 3x?      │                       │                              │
   │   Juros 2% a.m.          │                       │                              │
   │   Responda SIM."         │                       │                              │
   ◀─────────────────────────│                       │                              │
   │                          │                       │                              │
   │  "SIM"                   │                       │                              │
   ├─────────────────────────▶│                       │                              │
   │                          │  tool_use:            │                              │
   │                          │  confirm_creaté       │                              │
   │                          │  (confirmation_token) │                              │
   │                          ├──────────────────────▶│                              │
   │                          │                       │                              │
   │                          │  executar (DB)        │                              │
   │                          ├──────────────────────────────────────────────────────▶│
   │                          │                       │                              │
   │                          │◀─────────────────────────────────────────────────────┤
   │                          │                       │  audit_log                  │
   │                          │                       ├─────────────────────────────▶│
   │                          │                       │                              │
   │                          │  resposta:            │                              │
   │                          │  "Contrato criado!    │                              │
   │                          │   ID 12345.           │                              │
   │                          │   3 parcelas de       │                              │
   │                          │   R$ 346,67."         │                              │
   │                          │◀──────────────────────│                              │
   │                          │                       │                              │
   │  "Contrato criado!       │                       │                              │
   │   ID 12345. 3 parcelas   │                       │                              │
   │   de R$ 346,67."         │                       │                              │
   ◀─────────────────────────│                       │                              │
```

**Premissas LLM:**

- Provider: **Anthropic Claude** (Sonnet 4.6 default, Opus 4.8 para raciocinio profundo).
- Tools (function calling) com escopo restrito.
- **Toda escrita exige confirmacao** do usuario antes de aplicar.
- Logs: `llm_call_log` com prompt (sem PII completa), tools chamadas, resposta (sem PII completa), correlation_id.
- Raté limit: 100 mensagens/dia, 20/hora, USD 5/mes hard cap.
- Privacidade: PII (CPF, valores grandes) **mascarada** antes de enviar a LLM quando não essencial.

---

## Fluxo crítico 7 — Notificação ao usuario (sistema -> WhatsApp)

```
[Sistema]                  [EventBus]              [Worker]              [Meta Cloud API]      [Usuario]
   │                          │                       │                       │                   │
   │  evento (parcela         │                       │                       │                   │
   │  venceu, ha 2 dias)      │                       │                       │                   │
   ├─────────────────────────▶│                       │                       │                   │
   │                          │  outbox               │                       │                   │
   │                          │  (mesma transacao)    │                       │                   │
   │                          ├──────────────────────▶│                       │                   │
   │                          │                       │  agrupar eventos      │                   │
   │                          │                       │  (mesmo tipo,         │                   │
   │                          │                       │   mesma hora)         │                   │
   │                          │                       │  selecionar templaté  │                   │
   │                          │                       │  notif_parcela_venceu │                   │
   │                          │                       │  renderizar vars      │                   │
   │                          │                       │  enviar               │                   │
   │                          │                       ├──────────────────────▶│                   │
   │                          │                       │                       │  entrega          │
   │                          │                       │                       ├──────────────────▶│
   │                          │                       │                       │                   │
   │                          │                       │  webhook delivered    │                   │
   │                          │                       │◀──────────────────────│                   │
   │                          │                       │  atualizar status     │                   │
```

**Premissas:**

- Eventos são **agrupados** (mesmo tipo + mesma hora) para evitar spam.
- Opt-out granular por catégoria: usuario pode desativar "limite 80%" mas manter "tomador respondeu".
- Se usuario sair do WhatsApp (opt-out total) -> fallback para e-mail.
- Frequencia maxima por usuario: 1 msg/evento + 1 msg/dia de agrupamento.

---

## Estratégia de eventos

Eventos de domínio publicados via `EventBus` (NestJS EventEmitter) **com Outbox pattern**:

1. Mutação grava no DB + insere evento em tabela `outbox` na mesma transação.
2. Worker lê `outbox` e publica em destinos (fila, webhook, projection).
3. Marcação de processado + retry com backoff.

**Eventos-chave do `CORE V1`:**

- `PartyCreatéd`, `PartyUpdatéd`, `ReferralLinked`
- `ContractCreatéd`, `ContractRenegotiatéd`, `ContractClosed`
- `InstallmentScheduled`, `InstallmentOverdue`
- `PaymentReceived`, `PaymentAllocatéd`, `PaymentReversed`
- `FinancialEventRecorded`, `CashPeriodClosed`
- `RiskEvaluatéd`, `RiskOverridden`
- `NotificationSent`, `NotificationFailed`
- `SubscriptionUpdatéd`, `InvoicePaid`

---

## Diagrama de deploy

```
                    ┌──────────────────┐
                    │  Cloudflare WAF  │
                    │  + DDoS + Raté   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Load Balancer  │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  API instance   │           │  API instance   │
    │  (NestJS)       │           │  (NestJS)       │
    └────────┬────────┘           └────────┬────────┘
             │                             │
             └──────────────┬──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ Postgres │        │  Redis   │        │   OIDC   │
  │  Neon    │        │ Upstash  │        │ Kratos+  │
  │  (RLS)   │        │ (queues) │        │  Hydra   │
  └──────────┘        └──────────┘        └──────────┘

    ┌─────────────────────────────────────┐
    │  Workers (NestJS, mesmo código,      │
    │  entrypoint diferente)               │
    │  - notifications                     │
    │  - projections                       │
    │  - integrations                      │
    └─────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │  Observabilidade                     │
    │  - OTel Collector → Grafana Cloud    │
    │  - Sentry (errors)                   │
    └─────────────────────────────────────┘
```

---

## Princípios arquiteturais (resumo)

1. **Backend é fonte da verdade.** Frontend nunca calcula juros, decide permissões ou valida risco.
2. **Monólito modular com eventos internos.** Pronto para extrair satélites por gargalo, não por antecipação.
3. **Multi-tenant com defesa em profundidade.** `tenant_id` na aplicação **e** RLS no banco.
4. **Tudo que muta dados sensíveis é auditado.** Trilha imutável append-only.
5. **Eventos com Outbox pattern.** Garante entrega sem duplicidade.
6. **Idempotência por chave natural.** Webhooks e jobs nunca processam o mesmo evento duas vezes.
7. **Redaction por padrão em logs.** Logger middleware mascar antes do write.
8. **Observabilidade desde o dia 1.** `correlation_id` em toda requisição, fila e integração.
