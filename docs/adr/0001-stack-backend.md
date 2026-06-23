# ADR-0001: Stack do backend

- **Status:** Aceito
- **Data:** 2026-06-20
- **Decisor:** Sponsor do projeto (delegado para o assistente)

## Contexto

O `master-plan.md` (seção 11.3) compara Node.js + TypeScript, .NET 8 e Kotlin/Spring Boot. A escolha impacta velocidade de MVP, hiring no Brasil, ecossistema de filas/observabilidade e custo operacional.

## Decisão

Adotar **Node.js 22 LTS + TypeScript 5 (modo strict) + NestJS 10 + TypeORM 0.3**.

- TypeScript estrito em todo o monorepo.
- NestJS para injeção de dependência, módulos e padrões consistentes (guards, interceptors, pipes, filters).
- TypeORM com migrations versionadas para PostgreSQL.

## Consequências

**Positivas:**

- Tipagem ponta-a-ponta com o frontend (Next.js + TS).
- Ecossistema rico para BullMQ, OpenTelemetry SDK, Sentry, Postmark, Stripe.
- Hiring amplo no Brasil.
- Monólito modular + eventos internos (seção 12.3) mapeia direto para NestJS modules.

**Negativas:**

- Disciplina de tipos precisa ser enforcement forte no CI (`tsc --noEmit`, ESLint `@typescript-eslint`).
- Reforçar testes de regressão no motor financeiro (TS não tem a rigidez de tipos numéricos do C#).

**Mitigação:**

- Linter com regras de money handling (`no-floating-decimal`).
- Testes dourados do motor financeiro com cobertura obrigatória ≥ 95% em `packages/domain`.
