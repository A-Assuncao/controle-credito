# ADR-0013: Política financeira padrão

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Seções 15 e 16 do plano definem motor de contratos parametrizável e ledger operacional, mas não fixam defaults de arredondamento, alocação e penalidades. Esses defaults viram o "presets" do produto.

## Decisão

**Política financeira padrão (editável por tenant):**

- **Moeda:** BRL, armazenada como inteiro em centavos (`bigint`/`number` com regra de validação).
- **Arredondamento:** `HALF_EVEN` (banker's rounding) para minimizar viés acumulado.
- **Alocação de pagamento (ordem padrão):**
  1. Mora (juros de atraso)
  2. Multa
  3. Juros correntes
  4. Principal
- **Penalidades default:**
  - Multa: 2% sobre parcela vencida.
  - Mora: 1% a.m. pro rata die sobre principal + juros.
  - Carência: configurável por contrato (dias após vencimento antes de aplicar mora).
- **Timezone:** America/Sao_Paulo por padrão (configurável por tenant).

## Consequências

**Positivas:**

- `HALF_EVEN` é o padrão bancário e reduz viés estatístico.
- Ordem de alocação padrão é a mais comum em contratos brasileiros.
- Multa 2% / mora 1% a.m. é benchmark do mercado.
- Timezone fixo evita bugs clássicos de "vencimento à meia-noite".

**Negativas:**

- Configurabilidade por tenant exige UI de administração e testes por combinação.
- Risco de "configuração divergente" entre tenants sem governança.

**Mitigação:**

- `ProductSchema` versionado (seção 15.4) — alteração não afeta contratos antigos.
- Testes dourados por combinação padrão + combinação customizada.
- Auditoria de mudanças de configuração por tenant.

**Detalhamento técnico:** ver `docs/financial-engine.md`.
