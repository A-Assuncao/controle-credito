# ADR-0012: Modo PREMIUM de lançamento

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Seção 18.5 do plano oferece duas opções:

1. Lançar PREMIUM já nominal (A/B) — maior percepção de valor, maior risco jurídico.
2. Lançar PREMIUM em modo seguro (C+D) e evoluir para nominal só após validação — menor risco comercial inicial.

## Decisão

**Opção 2 (C + D) — `safe_aggregated` desde o go-live.**

- Operação robusta **intra-tenant** desde o início (RF-14 com fallback).
- Sinais agregados opcionais (ex.: percentil de comportamento anonimizado).
- Reputação nominal cross-tenant **só após**:
  - Parecer jurídico favorável.
  - Governança formal (comitê de privacidade, processo de contestação).
  - Revisão de risco aprovada.
- Feature flag em 3 níveis: `off` → `safe_aggregated` → `nominal_validated`.

## Consequências

**Positivas:**

- Reduz risco jurídico e reputacional.
- Preserva a proposta de valor central (operação, caixa, risco intra-tenant).
- Permite maturar governança/auditoria antes de ativar modo nominal.

**Negativas:**

- Valor comercial inicial do PREMIUM menor.
- Possível pressão comercial por ativar modo nominal antes do jurídico estar pronto.

**Mitigação:**

- Roadmap explícito com gate jurídico obrigatório antes de `nominal_validated` (seção 25).
- Comunicação transparente ao mercado sobre escopo do PREMIUM por estágio.
- Telemetria de uso para calibrar quando há tração suficiente para justificar investimento jurídico.

**Bloqueios:**

- `EXE-007` permanece `BLOQUEADO` no quadro de execução até parecer jurídico.
