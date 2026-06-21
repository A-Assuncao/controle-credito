# ADR-0008: Observabilidade

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Necessário tracing distribuído, métricas e logs estruturados com **redaction** de dados sensíveis (seção 21, regra 4 do master-plan). Padrão aberto evita lock-in.

## Decisão

**OpenTelemetry (OTel)** como SDK + **Grafana Cloud** (free tier) como backend + **Sentry** para erros.

- OTel Collectors exportando para Grafana (traces, métricas, logs).
- `correlation_id` propagado em API, filas e provedores externos.
- Logs estruturados em JSON com **redaction central**:
  - CPF, e-mail, telefone, valor nominal → mascarados por padrão.
  - Logger middleware inspeciona payloads antes do write.
- Sentry captura exceções com scrubbing de PII ativado.
- Painel de auditoria para `Admin` do tenant (export limitado).

## Consequências

**Positivas:**
- Padrão aberto, portável.
- Free tier cobre early-stage.
- Tracing ponta-a-ponta atende NFR-10.

**Negativas:**
- Grafana Cloud free tem limites de ingestão (monitorar).
- OTel SDK em NestJS ainda tem APIs em evolução.

**Mitigação:**
- Alertas quando ingestão > 70% do free tier.
- Redaction testada em CI com suíte de payloads sintéticos (CPF, e-mail, valores).
