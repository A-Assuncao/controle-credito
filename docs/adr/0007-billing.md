# ADR-0007: Billing e assinatura

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Necessário gateway de assinatura com webhooks idempotentes e suporte a tiers (seção 10, 19).

## Decisão

**Stripe** para assinaturas + usage-based billing (PREMIUM).

- **Stripe Billing** para assinaturas com tiers.
- **Stripe Meters** para PREMIUM (consultas internas/bureau).
- **Webhooks idempotentes** com verificação de assinatura (`stripe.webhooks.constructEvent`) + chave de deduplicação por `event.id`.
- **Customer Portal** para self-service de plano/cancelamento.
- **Stripe Tax** para cálculo de impostos (ISS, ICMS se aplicável).

## Consequências

**Positivas:**

- Ecossistema maduro, código pronto em NestJS (`@nestjs/stripe`).
- Suporte nativo a BR (BRL, boleto via PIX, se necessário no futuro).
- Dashboard financeiro pronto.

**Negativas:**

- Custo % por transação (considerar no plano Pro/Business).
- Necessário PCI compliance — mitigada por hospedar checkout no Stripe.

**Mitigação:**

- Camada `BillingProvider` no backend, isolando domínio de Stripe SDK.
- Sincronização periódica de assinatura como `source of truth` (Stripe → nosso DB).
- Replay de webhook com `Stripe CLI` em ambiente dev.

**Pendência:**

- Validar jurídico se uso de Stripe implica contrato adicional com cláusulas LGPD.
