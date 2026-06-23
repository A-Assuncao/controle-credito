# ADR-0003: Banco de dados e provider

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

O plano fixa PostgreSQL como banco (seção 11.3). A hospedagem **fora do Brasil** (seção 1.3) exige seleção de provider que atenda LGPD via SCCs. Operação multi-tenant exige **RLS** como defesa em profundidade (seção 13).

## Decisão

**PostgreSQL 16 gerenciado por Neon** (region `us-east-1`), com:

- **RLS ativo** desde o v1 em todas as tabelas multi-tenant (seção 13).
- **Branching por PR** via Neon API — preview environments isolados.
- **PITR (Point-in-Time Recovery)** habilitado, RPO ≤ 15min.
- Conexão via **PgBouncer** em transaction pooling (reduz custo e latência).
- `tenant_id` em toda tabela mutável + índice composto `(tenant_id, ...)`.

## Consequências

**Positivas:**

- Branching do Neon simplifica CI com bancos descartáveis por PR.
- RLS elimina classe de bugs de vazamento cross-tenant se houver falha de aplicação.
- Custo previsível (compute por uso ativo, não por instância 24/7).

**Negativas:**

- Lock-in moderado ao Neon (mitigado: SQL padrão, export trivial).
- RLS exige disciplina de roles e testes específicos.
- Cold start em branching pode exigir aquecimento em CI.

**Mitigação:**

- Testes automatizados de isolamento tenant (seção 24) — suíte obrigatória em CI.
- Script de export/import para garantir portabilidade.
- Documentação clara em `docs/security-model.md` sobre roles e policies.

**Pendência jurídica:**

- Necessário parecer formal sobre transferência internacional (LGPD art. 33) — ver `docs/compliance-checklist.md`.
