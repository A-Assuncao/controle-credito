# ADR-0004: Cache e filas

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

O plano recomenda Redis + BullMQ (seção 11.3) para cache e filas. Necessário:

- Filas para notificações e-mail, projeções de caixa, integrações externas com idempotência e retry (seção 19.2).
- Cache multi-tenant seguro com namespace por tenant (seção 23.2).
- Workers separados da API.

## Decisão

**Redis gerenciado por Upstash** + **BullMQ** para filas.

- Conexão única por ambiente com **namespace por tenant** em todas as chaves: `t:{tenant_id}:...`.
- BullMQ com:
  - Idempotência por `jobId` determinístico (hash de tenant + entidade + ação).
  - Retry com **backoff exponencial** + DLQ.
  - Concurrency configurável por fila.
- Workers em processo separado (`apps/api/src/workers/`) com deploy independente.

## Consequências

**Positivas:**

- Upstash tem HTTP fallback (bom para serverless, embora estejamos em monólito).
- BullMQ maduro, com UI de inspeção (`bull-board`) em ambiente restrito por IP/VPN.
- Filas separadas para `notifications`, `projections`, `integrations` evitam starvation cruzada.

**Negativas:**

- Mais um serviço para monitorar (métricas, custos, latência).
- Necessário cuidado com TTL em chaves sensíveis (não cachear CPF plaintext).

**Mitigação:**

- Métricas por fila em Grafana (`bull_queue_*`).
- Política explícita de TTL em `docs/security-model.md`.
- Proibido cachear payload bruto de bureau/CPF (regra 4 do master-plan).
