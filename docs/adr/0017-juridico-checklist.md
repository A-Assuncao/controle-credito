# ADR-0017: Compliance e pareceres jurídicos necessários

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Seções 4.4, 18.6, 20.2 do plano listam pontos que **exigem parecer jurídico formal** antes de ativação. Não cabe ao assistente gerar compliance — cabe listar com clareza o que precisa de assinatura humana.

## Decisão

**Checklist obrigatório de pareceres jurídicos (não-técnicos):**

| Tema                                                                              | Bloqueia    | Parecer necessário                                                        | Quem aciona                |
| --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- | -------------------------- |
| Transferência internacional de dados (LGPD art. 33)                               | Go-live     | Base legal (SCCs, cláusulas-padrão), DPIA                                 | DPO/advogado               |
| Compartilhamento nominal cross-tenant (PREMIUM modo A/B)                          | EXE-007     | Base legal, consentimento, legítimo interesse, papel controlador/operador | DPO/advogado               |
| Hospedagem fora do Brasil                                                         | Go-live     | Conformidade com ANPD, comunicação na política de privacidade             | DPO/advogado               |
| Contratos com subprocessadores (Neon, Upstash, Cloudflare, Postmark, Stripe, Ory) | Go-live     | DUE diligence de cada um, cláusulas LGPD                                  | DPO/advogado               |
| Política de retenção e descarte                                                   | Go-live     | Prazos por tipo de dado, descarte, portabilidade                          | DPO/advogado               |
| Mecanismo de contestação (PREMIUM)                                                | EXE-006/007 | Fluxo, prazo, canal                                                       | DPO/advogado               |
| Política de privacidade e termos de uso                                           | Go-live     | Redação e aceite                                                          | DPO/advogado               |
| Contrato comercial (B2B SaaS)                                                     | Go-live     | Cláusulas de SLA, LGPD, limitação de responsabilidade                     | Advogado cível/empresarial |

**Checklist técnico que o assistente prepara (mas jurídico valida):**

- DPIA estruturado em `docs/compliance/dpia.md` (template, não conteúdo final).
- Inventário de subprocessadores em `docs/compliance/subprocessors.md`.
- Política de retenção por categoria de dado em `docs/security-model.md`.
- Mecanismo de exportação de dados do titular em `packages/domain/privacy/export.ts` (interface).

## Consequências

**Positivas:**

- Clareza do que bloqueia e do que não bloqueia.
- Não atrasa implementação técnica enquanto jurídico trabalha em paralelo.
- Rastreabilidade para auditorias futuras.

**Negativas:**

- Bloqueios reais (transferência internacional, subprocessadores) podem atrasar go-live.
- Pareceres jurídicos têm custo.

**Mitigação:**

- Acionar jurídico **agora** (em paralelo à Sprint 1).
- Template de DPIA pronto antes do go-live para acelerar assinatura.
- Checklist de subprocessadores atualizado a cada novo vendor.

**Arquivo vivo:** [`docs/compliance-checklist.md`](../compliance-checklist.md) com status por item.
