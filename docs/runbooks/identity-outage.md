# Runbook: Indisponibilidade do Ory Kratos + Hydra

> **Severidade:** alta (usuários não conseguem logar).
> **Detecção:** alerta `identity_login_error_rate > 5%` por 5min, ou reports de usuários.

---

## Sintomas

- Login retorna 500 ou timeout.
- MFA setup falha.
- Validação de token falha para usuários já logados (sessões morrem).

## Impacto

- Todos os tenants sem acesso ao app.
- Sessões ativas podem expirar em ≤ 15min.

---

## Investigação inicial (5min)

1. **Status do cluster:**
   ```bash
   kubectl get pods -n identity
   # ou, em ambiente gerenciado:
   curl -fsS https://identity.controlecredito.com.br/health/ready
   ```
2. **Logs recentes:**
   ```bash
   kubectl logs -n identity -l app=kratos --tail=200
   kubectl logs -n identity -l app=hydra --tail=200
   ```
3. **Dependências:**
   - Postgres acessível? (ver runbook `db-failover.md`)
   - Redis acessível?
   - Certificado TLS válido?

## Mitigação imediata

### Cenário A: pods crashando

```bash
kubectl rollout restart deployment/kratos -n identity
kubectl rollout restart deployment/hydra -n identity
kubectl rollout status deployment/kratos -n identity --timeout=120s
```

### Cenário B: Postgres indisponível (ver `db-failover.md`)

Kratos e Hydra **não funcionam** sem Postgres. Resolver Postgres primeiro.

### Cenário C: bug conhecido / config errada

```bash
kubectl rollout undo deployment/kratos -n identity
```

### Cenário D: Ataque / abuso

- Ativar `LOGIN_RATE_LIMIT=hard` via feature flag (`configmap`).
- Bloquear ranges de IP no Cloudflare WAF.

---

## Comunicação

| Audiência | Canal | Mensagem |
|---|---|---|
| Usuários | Status page + banner no app | "Login temporariamente indisponível. Sessões ativas podem expirar. Equipe investigando." |
| Time interno | Slack `#incidentes` | Atualização a cada 15min |
| Sponsor | E-mail se > 1h | Status, ETA, próximo update |

---

## Pós-mortem (obrigatório)

Dentro de 48h:

1. Root cause analysis.
2. Linha do tempo.
3. Ações preventivas (ADR se arquitetural).
4. Atualizar este runbook se aplicável.
5. Adicionar teste de caos se categoria nova.

---

## Contatos

| Papel | Pessoa | Contato |
|---|---|---|
| On-call primário | (definir) | (definir) |
| On-call secundário | (definir) | (definir) |
| Security Lead | (definir) | (definir) |
| Sponsor | (definir) | (definir) |
