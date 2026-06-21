# Runbook: Failover do PostgreSQL

> **Severidade:** alta (aplicação inteira indisponível).
> **Detecção:** alerta `db_connection_error_rate > 1%` ou `db_replication_lag_seconds > 60`.

---

## Sintomas

- API retorna 500 em massa.
- Migrations falham.
- Login não funciona (Kratos depende de Postgres).
- Workers travam (job timeout em queries).

---

## Investigação inicial (3min)

1. **Status do Neon:**
   - Dashboard Neon: <https://console.neon.tech>
   - Página de status Neon: <https://neonstatus.com>
2. **Conexão direta:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
3. **Replicação:**
   ```sql
   SELECT pid, state, query_start, query
   FROM pg_stat_activity
   WHERE state IN ('active', 'idle in transaction')
   ORDER BY query_start NULLS LAST;
   ```
4. **Lock contention:**
   ```sql
   SELECT blocked_locks.pid AS blocked_pid,
          blocking_locks.pid AS blocking_pid,
          blocked_activity.query AS blocked_query
   FROM pg_catalog.pg_locks blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity
   ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_catalog.pg_locks blocking_locks
   ON blocking_locks.locktype = blocked_locks.locktype
   ...
   ```

---

## Mitigação

### Cenário A: Neon indisponível regionalmente

- Neon faz failover automático entre AZs.
- Aguardar até 5min.
- Se > 5min, abrir ticket Neon.

### Cenário B: Query pesada travando banco

1. Identificar pid da query problemática:
   ```sql
   SELECT pid, query, state, query_start
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY query_start;
   ```
2. Cancelar (não matar ainda):
   ```sql
   SELECT pg_cancel_backend(pid);
   ```
3. Se persistir:
   ```sql
   SELECT pg_terminate_backend(pid);
   ```
4. Investigar causa raiz (índice faltando? query ruim?).

### Cenário A: Conexões esgotadas

- Verificar PgBouncer:
  ```bash
  pgbouncer -h $PGBOUNCER_HOST -p 6432 -U pgbouncer pgbouncer
  # SHOW POOLS;
  ```
- Aumentar `default_pool_size` temporariamente.
- Identificar conexões idle em `pg_stat_activity`.

### Cenário D: Migração falhou no meio

- **Não** rodar migration de novo.
- Verificar estado parcial:
  ```sql
  SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5;
  ```
- Decidir entre:
  - Rollforward manual (escrever SQL corretivo).
  - Rollback (se migration reversível).
- Comunicar status antes de qualquer ação destrutiva.

### Cenário E: Disco cheio

- Verificar tamanho de tabelas:
  ```sql
  SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(relid) DESC
  LIMIT 20;
  ```
- Neon oferece auto-scaling de storage; verificar se atingiu limite de conta.
- Curto prazo: identificar tabelas com `audit_log` ou `events` antigos e arquivar.

---

## Pós-failover

1. Validar RLS ainda ativo:
   ```sql
   SELECT relname, relrowsecurity, relforcerowsecurity
   FROM pg_class
   WHERE relname IN ('users', 'roles', 'user_roles', 'audit_log');
   ```
2. Validar que `SET LOCAL app.tenant_id` é chamado em toda request (procurar gaps em log).
3. Rodar suite de testes de isolamento tenant em staging.

---

## Comunicação

| Audiência | Mensagem |
|---|---|
| Usuários | Status page: "Sistema temporariamente instável. Operações podem demorar." |
| Time interno | Slack `#incidentes` a cada 10min |
| Sponsor | Se > 30min |

---

## Pós-mortem

48h. Foco em: causa raiz, tempo de detecção, tempo de mitigação, gaps de observabilidade.

---

## Contatos

| Papel | Pessoa | Contato |
|---|---|---|
| On-call primário | (definir) | (definir) |
| On-call secundário | (definir) | (definir) |
| Backend Lead | (definir) | (definir) |
| Sponsor | (definir) | (definir) |
| Suporte Neon | suporte@neon.tech | Plano atual define SLA |
