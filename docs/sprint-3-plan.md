# Plano da Sprint 3 — Contratos + Parcelas + Recebimentos (EXE-002)

> **Status:** Pronto para execução. Requer **AUTORIZO CODAR** explícito do sponsor.
> Referência no quadro de execução: `EXE-002` (master-plan seção "Controle de execução do desenvolvimento").
> Documentação de apoio: [`docs/financial-engine.md`](financial-engine.md), [`docs/master-plan.md`](master-plan.md) §14-17.

---

## Objetivo da sprint

Entregar o **núcleo do motor financeiro** do SaaS: contratos de empréstimo parametrizáveis, cronograma de parcelas determinístico, e alocação de recebimentos. Esta é a fundação que destrava EXE-003 (caixa), EXE-004 (risco) e o fluxo de cobrança via WhatsApp.

**Resultado esperado:** um usuário consegue criar um contrato de empréstimo (com juros simples/compostos, frequência semanal/quinzenal/mensal, carência, multa, mora), ver o cronograma gerado, e registrar um recebimento que é alocado automaticamente entre mora → multa → juros → principal.

---

## Escopo (in / out)

### Dentro (Sprint 3)

- **Motor de cálculo** em `packages/domain` (puro, sem I/O):
  - Geração de cronograma: Price (parcela fixa) e Só Juros.
  - Cálculo de juros: simples e compostos, pro-rata-die.
  - Multa + mora + carência parametrizáveis.
  - Alocação de pagamento: mora → multa → juros → principal.
  - Quitação antecipada.
- **Versionamento de esquema** (`ProductSchema` com semver).
- **Migrations** (4+ novas tabelas):
  - `product_schemas` (versionamento de produto financeiro).
  - `parties` (tomadores com validação BR).
  - `contracts` (com FK para `accounts`, `parties`, `product_schemas`).
  - `installments` (parcelas: número, due_date, principal, interest, balance, status).
  - `payments` (recebimentos).
  - `payment_allocations` (alocação por bucket).
  - RLS policies para isolamento por `account_id`.
- **API REST** (NestJS) com:
  - `POST /parties` (criar tomador com validação CPF).
  - `GET /parties` (listar).
  - `POST /contracts` (criar contrato + gerar cronograma via motor).
  - `GET /contracts` (listar).
  - `GET /contracts/:id` (detalhe + cronograma).
  - `POST /contracts/:id/payments` (registrar recebimento + alocar).
  - `GET /contracts/:id/installments` (listar parcelas).
- **Frontend** (Next.js):
  - `/contracts` — listagem com KPIs básicos (total emprestado, recebido, vencido).
  - `/contracts/new` — formulário de criação (tomador + parâmetros).
  - `/contracts/[id]` — detalhe com cronograma e botão "registrar pagamento".
- **Golden tests** em `packages/domain/__tests__/` (determinismo + invariantes).
- **Testes E2E** (Playwright) para fluxo: criar contrato → registrar pagamento → ver parcela quitada.
- **Documentação**: atualizar master-plan com EXE-002 → IMPLANTADO/VALIDADO, registrar entregas.

### Fora (sprints seguintes)

- Caixa + projeções + dashboard (Sprint 4 — `EXE-003`).
- Risco híbrido + override + e-mail (Sprint 5 — `EXE-004`).
- Billing SaaS + limites por plano (Sprint 6 — `EXE-005`).
- WhatsApp (Meta Cloud API) como canal de cobrança (Sprint 5 junto com EXE-004).
- Bullet contracts e Custom contracts (FUTURO, segunda versão da EXE-002).
- Migração de `number` para `bigint` em Cents (dívida técnica, F4 ou depois).
- Renegociação de contratos (FUTURO, segunda versão da EXE-002).
- PREMIUM modo seguro e nominal (F5/F6/F7 — bloqueado por jurídico).

---

## Marcos em ordem

### EXE-002.1: Motor de cálculo (packages/domain) — **PRIMEIRO**
- Sem I/O, determinístico, puro.
- 6 novos módulos: `productSchema`, `interest`, `schedule`, `penalty`, `allocátion`, `earlySettlement`.
- Golden tests em `__tests__/`.
- Critério: 100% cobertura, invariantes verificadas, mesmo input → mesmo output.

### EXE-002.2: Migrations (PostgreSQL)
- Tabelas: `product_schemas`, `parties`, `contracts`, `installments`, `payments`, `payment_allocations`.
- RLS policies para `account_id`.
- Seeds de exemplo para dev/test (3 contratos em cenários diferentes).

### EXE-002.3: API REST (NestJS)
- 7 endpoints listados no escopo.
- Validação Zod em todos os inputs.
- Integração com motor de cálculo da EXE-002.1.
- Auditoria: cada criação de contrato / pagamento gera entrada em `audit_log`.

### EXE-002.4: Frontend (Next.js)
- 3 páginas: listagem, criação, detalhe.
- Server components para SSR + client components para formulários.
- Gráfico simples de progresso do contrato (pago vs devedor).

---

## Critérios de validação (DoD)

### Motor de cálculo (EXE-002.1)
- [ ] Soma de `principal` das parcelas === `loan.principal` (invariante fundamental).
- [ ] Datas de vencimento em ordem estritamente crescente.
- [ ] Nenhuma parcela com `amount` negativo.
- [ ] Última parcela absorve diferença de arredondamento (banker's rounding).
- [ ] Juros simples: `interest = principal × rate × periods` (correto para `periods=1`).
- [ ] Juros compostos: `interest = principal × (1 + rate)^periods - principal` (correto para `periods=1`).
- [ ] Alocação respeita ordem configurável: mora → multa → juros → principal.
- [ ] 100% cobertura de testes (Vitest).
- [ ] Golden tests com valores fixos (determinístico).

### Migrations (EXE-002.2)
- [ ] Aplicam em ordem sem erro.
- [ ] RLS policies bloqueiam acesso cross-account.
- [ ] Teste de isolamento: query com `account_id` diferente retorna vazio.
- [ ] FKs fortes (não permite deletar `account` com `contracts`).

### API (EXE-002.3)
- [ ] `POST /contracts` retorna 201 com cronograma gerado.
- [ ] `POST /contracts/:id/payments` aloca corretamente (mora → multa → juros → principal).
- [ ] Teste de integração: criar contrato → pagar 1 parcela → verificar alocação.
- [ ] Erros validados via Zod retornam 422 com `issues` estruturados.
- [ ] Auditoria: criar contrato gera entrada em `audit_log` com `action='contract.create'`.

### Frontend (EXE-002.4)
- [ ] Listagem mostra KPIs corretos.
- [ ] Criação de contrato valida e mostra cronograma antes de submit.
- [ ] Detalhe mostra parcelas + botão de pagamento.
- [ ] E2E (Playwright): criar contrato → pagar → ver parcela quitada.
- [ ] Mobile-first (testa em iPhone 13 + Pixel 7).

### Geral
- [ ] CI 100% verde (lint + typecheck + test).
- [ ] Master-plan atualizado: EXE-002 → `IMPLANTADO` → `VALIDADO`.
- [ ] CHANGELOG com entrada `1.4.0-contracts`.
- [ ] Memórias atualizadas.

---

## Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Bug em cálculo financeiro (sub/soma de centavos) | Média | **Alto** — pode causar perda de dinheiro | Golden tests com valores fixos; revisão de código focada; testes de invariantes (`sum === principal`); 2 implementações paralelas (Price vs Tabela Price) para cross-check |
| RLS policy permissiva demais | Baixa | **Alto** — vazamento cross-tenant | Teste de isolamento explícito em CI; revisão obrigatória de migration |
| Overhead de locks pessimistas (FOR UPDATE) | Média | Médio — pode degradar performance | Lock apenas em mutações críticas (pagamento); transações curtas; índices apropriados |
| `bigint` em Cents (limitação do `number`) | Baixa | Baixo — R$ 90 trilhões é o limite prático | Manter `number` por agora; documentar como dívida técnica |
| Complexidade do frontend (3 páginas + formulários) | Baixa | Médio | Usar componentes do shadcn/ui existentes; server components para reduzir JS |
| Migrações em prod (downtime?) | Baixa | Médio | Migrations idempotentes (`CREATE TABLE IF NOT EXISTS`); deploy gradual |

---

## Decisões abertas (resolver antes de EXE-002.1)

1. **Tipagem de Cents**: `number` (atual) vs `bigint` (master-plan). **Decisão**: manter `number` por enquanto. Migrar para `bigint` se exceder R$ 90 trilhões (improvável).
2. **Tipos de contrato no v1**: Price + Só Juros (essencial) vs incluir Bullet. **Decisão**: começar com Price + Só Juros. Bullet fica para v2.
3. **Versão do ProductSchema**: semver (`major.minor.patch`) vs só `major`. **Decisão**: semver completo, alinhado com padrão da indústria.
4. **Timezone**: hardcoded `America/Sao_Paulo` vs configurável por tenant. **Decisão**: hardcoded por enquanto. Configurabilidade por tenant é Sprint 5+.
5. **Renegociação**: implementar agora ou na v2. **Decisão**: deixar para v2 (escopo grande, mas opcional para MVP).

---

## Decisões já tomadas (resolvidas)

- ✅ **Currency**: BRL (Real Brasileiro), `Cents = number & { __brand: 'Cents' }` (manter branding).
- ✅ **Política de arredondamento**: `HALF_EVEN` (banker's rounding) — já implementado em `roundHalfEven`.
- ✅ **Calendário**: `America/Sao_Paulo` por padrão (hardcoded nesta sprint).
- ✅ **Feriados**: calendário nacional BR (F0) — sem personalização por tenant nesta sprint.
- ✅ **Tipo de dado para datas**: `string` ISO 8601 (YYYY-MM-DD) sem hora (parcelas são por dia, não timestamp).
- ✅ **Migrations**: SQL puro idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- ✅ **RLS**: `FORCE ROW LEVEL SECURITY` em todas as tabelas tenant-scoped.

---

## Marcos / entregas esperadas

| Marco | Data alvo | Responsável |
| --- | --- | --- |
| EXE-002.1: Motor de cálculo + golden tests | Sessão 1 | Backend Lead |
| EXE-002.2: Migrations (6 tabelas) + RLS | Sessão 2 | Backend Lead |
| EXE-002.3: API REST (7 endpoints) | Sessão 3 | Backend Lead + QA |
| EXE-002.4: Frontend (3 páginas) | Sessão 4 | Frontend Lead |
| EXE-002 → `IMPLANTADO` | Sessão 4 | — |
| EXE-002 → `VALIDADO` | Sessão 5 (smoke test E2E completo) | QA Lead |

---

## Testes (estratégia)

### Golden tests (Vitest)
- `packages/domain/__tests__/schedule.test.ts` — 4 cenários dourados (Price mensal, Price semanal, Só Juros mensal, Price com carência).
- `packages/domain/__tests__/interest.test.ts` — juros simples e compostos com valores fixos.
- `packages/domain/__tests__/allocátion.test.ts` — alocação mora→juros→principal, mora→multa→juros→principal.
- `packages/domain/__tests__/earlySettlement.test.ts` — quitação com e sem dedução.
- `packages/domain/__tests__/penalty.test.ts` — multa fixa, mora diária, carência.

### Integração (supertest)
- `apps/api/test/contracts.e2e-spec.ts` — CRUD completo de contratos via HTTP.

### E2E (Playwright)
- `apps/web/e2e/contracts.spec.ts` — criar contrato via UI, registrar pagamento, ver parcela quitada.

---

## O que vem depois (handoff para próxima sprint)

Quando EXE-002 → `VALIDADO`:

- **Sprint 4 (EXE-003)**: Caixa + projeções + dashboard principal.
  - Já tem modelo conceitual em `master-plan.md` §16.
  - Usa dados da EXE-002 (parcelas + recebimentos).
- **Sprint 5 (EXE-004)**: Risco + WhatsApp + e-mail.
  - Motor de risco pode usar dados da EXE-002 (atraso, pagamento).
  - WhatsApp só com usuário (não com tomador) — ver `master-plan.md` §8.4.

---

## Referências

- [`docs/master-plan.md`](master-plan.md) §14 (entidades), §15 (motor), §16 (caixa), §17 (risco)
- [`docs/financial-engine.md`](financial-engine.md) — invariantes, arredondamento, calendário
- [`docs/architecture.md`](architecture.md) — mapa de módulos
- [`docs/security-model.md`](security-model.md) — RLS, auditoria
- ADRs 0018, 0020, 0024
