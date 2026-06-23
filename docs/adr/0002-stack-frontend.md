# ADR-0002: Stack do frontend

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Frontend precisa ser **mobile-first** (seção 22), operar com usuários majoritariamente operacionais, e tipar contratos com o backend para reduzir erros em domínio financeiro.

## Decisão

**Next.js 15 (App Router) + TypeScript 5 + Tailwind CSS + shadcn/ui + React Hook Form + Zod + TanStack Query.**

- App Router para streaming e layouts compartilhados.
- shadcn/ui para componentes acessíveis (base Radix UI) com Tailwind — evita dependência de lib opinativa.
- Zod para validação de formulários; schemas exportados de `packages/contracts` e reaproveitados no backend.
- TanStack Query para cache e invalidação coordenada com o backend.

## Consequências

**Positivas:**

- Mesma linguagem do backend (TS) → contratos tipados ponta-a-ponta.
- shadcn/ui é copiado para o repo (não é dependência npm), auditável e customizável.
- Server Components do App Router reduzem JS no cliente (importante para mobile em rede instável).
- Conformidade WCAG via Radix por padrão.

**Negativas:**

- App Router ainda evolui — exige cuidado com Server Actions vs API routes.
- shadcn/ui exige manutenção manual de componentes.

**Mitigação:**

- Padrão de uso: Server Components para leitura, Client Components para interação, Server Actions só para mutações internas (mutações externas vão pela API).
