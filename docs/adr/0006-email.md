# ADR-0006: Provedor de e-mail

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Necessário provedor transacional com boa deliverability e observabilidade de bounce/spam (seção 19).

## Decisão

**Postmark** como provedor primário.

- Templates versionados em Postmark + backup no repo (`apps/api/src/notifications/templates/`).
- Webhooks de bounce, spam-complaint e delivery configurados; processamento idempotente.
- Separação de streams: transacional vs broadcast (se necessário).

## Consequências

**Positivas:**
- Foco em transacional (alta deliverability).
- Observabilidade de entrega nativa.
- API simples e estável.

**Negativas:**
- Custo por mensagem (R$ viável em SaaS pequeno).
- Vendor lock-in moderado (templates podem ser migrados para SES/SendGrid).

**Mitigação:**
- Adapter pattern: `EmailProvider` interface, Postmark como implementação padrão.
- Fallback SES configurável em `IntegrationConfig` por tenant (avaliação `FUTURO`).

**Alternativa rejeitada:** SendGrid — UX de templates inferior para o caso de uso.
