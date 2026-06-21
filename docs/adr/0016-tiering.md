# ADR-0016: Tiering comercial proposto

- **Status:** **DEPRECATED** — substituído por ADR-0020
- **Data original:** 2026-06-20
- **Data de deprecação:** 2026-06-20

## Histórico

Este ADR propunha tiers enterprise (Starter R$99 / Pro R$349 / Business R$999) com **multi-usuário e RBAC**. Foi descontinuado em 2026-06-20 quando o modelo de uso foi refinado para **pessoa física** (single-user, sem RBAC). O novo tiering está em [ADR-0020](./0020-tiering-pessoa-fisica.md).

## Conteúdo original (mantido para histórico)

> Tabela original (não mais válida):
>
> | Plano | Preço | Usuários | Contratos ativos | E-mails/mês | PREMIUM |
> |---|---|---|---|---|---|
> | Starter | R$ 99 | 2 | 50 | 500 | — |
> | Pro | R$ 349 | 10 | 500 | 5.000 | add-on |
> | Business | R$ 999 | ilimitado | ilimitado | 50.000 | add-on |
>
> Add-ons: usuário extra R$ 39, contrato extra R$ 1,50.

**Motivo da deprecação:** modelo de uso é single-user, não justifica cobrança por seat. Tiers foram refeitos em ADR-0020 com preços ajustados (~50% menores) e gating por **funcionalidades** (WhatsApp, score cross-account) em vez de por quantidade de usuários.

