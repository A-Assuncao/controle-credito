# ADR-0011: RLS ativo desde o v1

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Seção 13 do plano sugere RLS como "camada opcional adicional (defesa em profundidade)". Decidir se ativa no v1 ou posterga.

## Decisão

**RLS ativo em todas as tabelas multi-tenant desde o v1.**

- Cada tabela mutável tem `tenant_id UUID NOT NULL` + policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- Aplicação sempre envia `SET LOCAL app.tenant_id = '...'` no início de cada transação.
- Conexão via role dedicada com `BYPASSRLS = false`.
- Testes automatizados em CI tentam acessar dados de tenant B como tenant A — devem falhar.

## Consequências

**Positivas:**

- Elimina classe de bugs: mesmo com falha na aplicação, banco recusa leitura cruzada.
- Atende NFR-06 (testes automatizados de isolamento).
- Auxilia conformidade LGPD (controle de acesso no nível mais baixo).

**Negativas:**

- Overhead de manutenção de policies.
- Risco de bypass acidental se algum role tiver `BYPASSRLS = true`.

**Mitigação:**

- Documentação explícita em `docs/security-model.md` sobre roles e policies.
- Auditoria periódica de roles e policies via script SQL.
- Teste em CI falha build se detectar `BYPASSRLS = true` em role de aplicação.
