# Motor Financeiro

> Complementa [`master-plan.md`](master-plan.md) (seções 14.3, 15, 16). Define invariantes, política de arredondamento, alocação de pagamento e cenários dourados.

---

## 1. Princípios fundamentais

1. **Parametrizável** — todo contrato referencia um `ProductSchema` versionado.
2. **Determinístico** — mesmo input + mesma versão → mesma saída.
3. **Sem lógica espalhada** — toda a matemática vive em `packages/domain` (puro, sem I/O).
4. **Imutável** — mudança de cálculo = nova versão, nunca mutação silenciosa.
5. **Auditável** — cada cálculo salva `formula_version` e inputs.

---

## 2. Representação de dinheiro

**Tipo:** `bigint` em centavos (sem ponto flutuante).

```ts
type Cents = bigint; // 12345n = R$ 123,45

function cents(reais: number | string): Cents {
  /* ... */
}
function reaisFromCents(c: Cents): string {
  /* ... */
}
```

**Por que `bigint`:**

- `number` em JS perde precisão após 2^53 (~R$ 90 trilhões em centavos — ok financeiramente, mas péssimo para evitar bugs em composição de juros).
- `Decimal` libraries (ex.: `decimal.js`) funcionam, mas `bigint` tem performance e auditabilidade superiores.
- Em SQL: `BIGINT` mapeia direto para `bigint` JS.

**Conversão UI ↔ API:**

- API sempre envia `string` (nunca `number`) para evitar perda em serialização JSON.
- Schema Zod: `z.string().regex(/^-?\d+$/)` com validação adicional no domínio.

---

## 3. Política de arredondamento

**Default:** `HALF_EVEN` (banker's rounding).

```ts
function roundHalfEven(value: Cents, divisor: number = 1): Cents {
  // Implementação segundo IEEE 754 / ISO 20022
}
```

**Por que `HALF_EVEN`:**

- Reduz viés estatístico em séries longas (diferente de `HALF_UP`).
- É o padrão bancário ISO 20022.
- Comportamento previsível em cenários de teste dourado.

**Configurabilidade:**

- Tenant pode sobrescrever para `HALF_UP` ou `HALF_DOWN` em `tenant_settings`.
- Contrato sempre congela a política vigente no momento da criação.

---

## 4. Calendário e timezone

- **Timezone default:** `America/Sao_Paulo`.
- **Datas de vencimento:** armazenadas como `DATE` (sem hora).
- **Cálculos "pro rata die":** em dias úteis ou corridos, configurável por contrato.
- **Feriados:** calendário nacional BR default; personalizável por tenant (banco de dados com `effective_from`).

---

## 5. `ProductSchema` — estrutura

```ts
interface ProductSchema {
  id: string;
  version: number; // semver
  status: 'draft' | 'active' | 'deprecated';
  tenant_id: string;
  name: string;
  modality: 'fixed_installment' | 'interest_only' | 'bullet' | 'custom';
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  interest: {
    type: 'simple' | 'compound';
    rate_per_period: string; // decimal, ex.: "0.0299" = 2.99% a.m.
    capitalization?: 'daily' | 'monthly';
  };
  penalty: {
    fixed?: string; // % multa
    daily?: string; // % mora a.d.
    grace_days: number; // carência
  };
  early_settlement: {
    method: 'prospectus' | 'simple_deduction';
    deduction_rate?: string;
  };
  rounding: 'HALF_EVEN' | 'HALF_UP' | 'HALF_DOWN';
  effective_from: string; // ISO date
}
```

**Versionamento:**

- Mudança de qualquer campo = nova `version`.
- Contrato sempre referencia `(schema_id, version)`.
- `ContractEngine` recebe a versão congelada — não consulta "última ativa".

---

## 6. Tipos de contrato no `CORE V1`

| Tipo                     | Implementação                                              |
| ------------------------ | ---------------------------------------------------------- |
| **Parcela fixa** (Price) | `pmt = PV × i / (1 − (1+i)^−n)`                            |
| **Só juros**             | `installment.interest = balance × i`; principal preservado |
| **Bullet**               | Juros acumulados, principal no vencimento                  |
| **Custom**               | Plugins via `ScheduleGenerator` interface                  |

**Cobertura mínima (seção 15.5):**

- Mensal, semanal, quinzenal.
- Juros simples e compostos.
- Só juros.
- Amortização parcial.
- Renegociação.
- Quitação antecipada.
- Multa + mora + carência.

---

## 7. Geração de cronograma

```ts
function generateSchedule(
  principal: Cents,
  rate: string,
  periods: number,
  schema: ProductSchema,
  startDate: Date,
  calendar: Calendar,
): Installment[] {
  // 1. Calcular valor de parcela conforme modality
  // 2. Gerar datas conforme frequency + calendar
  // 3. Quebrar parcela em componentes (interest, principal)
  // 4. Aplicar rounding conforme schema
  // 5. Validar invariantes:
  //    - soma(principal_i) === principal
  //    - nenhuma parcela negativa
  //    - datas em ordem
}
```

**Invariantes do cronograma:**

1. `sum(installment.principal) === loan.principal` (considerando rounding).
2. `installment.due_date >= loan.disbursement_date`.
3. `installment[i].due_date < installment[i+1].due_date` (estritamente crescente).
4. `installment.amount >= 0` sempre.
5. Última parcela absorve diferença de arredondamento.

---

## 8. Alocação de pagamento

**Ordem default (configurável por tenant):**

```
1. Mora           (juros de atraso acumulados)
2. Multa          (% fixa)
3. Juros correntes (da parcela atual)
4. Principal      (amortização)
```

**Implementação:**

```ts
function allocatePayment(
  installment: Installment,
  amount: Cents,
  allocationOrder: AllocationOrder,
): Allocation[] {
  let remaining = amount;
  const allocations = [];

  for (const bucket of allocationOrder) {
    const owed = installment[bucket];
    const applied = min(remaining, owed);
    allocations.push({ bucket, amount: applied });
    remaining -= applied;
    if (remaining === 0n) break;
  }

  if (remaining > 0n) {
    // Excedente vira crédito para próxima parcela
    allocations.push({ bucket: 'credit', amount: remaining });
  }

  return allocations;
}
```

**Casos especiais:**

- **Pagamento parcial:** parcelas em estado `parcial`; saldo realocado.
- **Estorno:** novo `Payment` com `kind = 'reversal'` referencia o original (política `PRECISA DE VALIDAÇÃO` por tenant).
- **Adiantamento:** aloca em parcelas futuras se houver crédito.

---

## 9. Juros de mora e multa

**Multa:**

```
multa = installment.amount × penalty.fixed
```

Aplicada após `grace_days` do vencimento. Cobrada uma vez por parcela.

**Mora:**

```
mora_dia = (installment.principal + installment.interest) × penalty.daily
mora_total = mora_dia × days_overdue (após grace_days)
```

**Cap:** configurável por tenant (ex.: 100% do principal).

---

## 10. Quitação antecipada

**Dois métodos suportados:**

| Método             | Cálculo                                                       |
| ------------------ | ------------------------------------------------------------- |
| `prospectus`       | Soma das parcelas futuras a valor presente (taxa do contrato) |
| `simple_deduction` | `principal + (interest_pro_rata)`                             |

**Política configurável** por schema; padrão recomendado: `prospectus` (mais justo para tomador).

---

## 11. Renegociação

**Fluxo:**

1. Criar nova versão `Contract` com `parent_contract_id`.
2. Cronograma antigo **marcado como `superseded`** (não deletado).
3. Novo cronograma vinculado à nova versão.
4. `FinancialEvent: contract_renegotiated` emitido.
5. Projeção de caixa recalculada.

**Histórico imutável** — toda renegociação preserva histórico para auditoria e cálculo de juros pagos.

---

## 12. Ledger de caixa

**Princípio:** append-only.

```ts
interface FinancialEvent {
  id: string;
  tenant_id: string;
  wallet_id: string;
  kind:
    | 'loan_disbursement'
    | 'installment_payment_received'
    | 'interest_recognized'
    | 'penalty_applied'
    | 'manual_cash_in'
    | 'manual_cash_out'
    | 'owner_contribution'
    | 'owner_withdrawal'
    | 'reversal'
    | 'period_close_adjustment';
  amount: Cents; // signed
  related_contract_id?: string;
  related_payment_id?: string;
  related_installment_id?: string;
  metadata: Record<string, unknown>;
  correlation_id: string;
  created_at: Date;
  created_by: string;
}
```

**Saldo de carteira:**

```
balance(wallet, t) = sum(events where wallet_id = w and created_at <= t).amount
```

**Projeção:**

- Cache Redis invalidado em mutação.
- Recalculado em job assíncrono para dashboards.

---

## 13. Fechamento de período

**Fluxo:**

1. Admin/Financeiro solicita fechamento de `t0` a `t1`.
2. Sistema cria `CashPeriodClose` snapshot com:
   - Hash de integridade (SHA-256 dos eventos do período).
   - Saldos finais por carteira.
   - Totais por categoria.
3. Após fechamento, eventos com `created_at < t0` são **bloqueados** para mutação direta.
4. Exceção requer `cash:reopen_period` + justificativa + evento compensatório.

**Reabertura:**

- Gera evento `period_close_adjustment` com referência ao fechamento original.
- Audit trail preservado.

---

## 14. Cenários dourados (golden scenarios)

Suite obrigatória em `packages/domain/__tests__/golden/`. Cada cenário é versionado e roda em CI.

### 14.1 `simple-fixed-monthly`

- Principal: R$ 10.000,00.
- 12 parcelas mensais.
- Juros: 2% a.m. simples.
- Esperado: parcela fixa ≈ R$ 1.033,33; soma principal = 10.000,00.

### 14.2 `interest-only-monthly`

- Principal: R$ 10.000,00.
- 6 parcelas mensais.
- Juros: 1,5% a.m.
- Esperado: parcela = R$ 150,00 (só juros); principal preservado; quitação no vencimento.

### 14.3 `weekly-fixed`

- Principal: R$ 7.000,00.
- 10 parcelas semanais.
- Juros: 0,5% a.s. (ao semana).
- Esperado: soma principal = 7.000,00.

### 14.4 `bullet-quarterly`

- Principal: R$ 50.000,00.
- 4 trimestres.
- Juros: 4% ao trimestre compostos.
- Esperado: 3 parcelas de R$ 2.000,00 + última com principal + juros.

### 14.5 `early_settlement-prospectus`

- Contrato mensal de 12 parcelas (juros 2% a.m.).
- Tomador quita na parcela 6.
- Esperado: valor presente das parcelas 7-12 com taxa do contrato.

### 14.6 `payment_allocation-default`

- Parcela de R$ 500,00 (R$ 300 principal + R$ 200 juros), vencida há 30 dias.
- Multa 2% = R$ 10,00; mora 1% a.m. = R$ 5,00.
- Pagamento de R$ 515,00.
- Esperado: 5,00 (mora) + 10,00 (multa) + 200,00 (juros) + 300,00 (principal) = 515,00.

### 14.7 `partial_payment`

- Parcela de R$ 500,00.
- Pagamento de R$ 200,00.
- Esperado: alocação mora(0) + multa(0) + juros(200); saldo = 300,00; estado `parcial`.

### 14.8 `renegotiation`

- Contrato de R$ 5.000,00 em 10 parcelas; tomador pagou 3.
- Renegocia para 12 parcelas restantes com nova taxa.
- Esperado: contrato antigo `superseded`; novo cronograma com saldo devedor atualizado.

### 14.9 `rounding_half_even`

- Parcela calculada = R$ 100,005.
- Esperado com `HALF_EVEN`: R$ 100,00.
- Esperado com `HALF_UP`: R$ 100,01.

### 14.10 `grace_period`

- Parcela vencida há 3 dias, `grace_days = 5`.
- Esperado: sem multa/mora até o 5º dia.

---

## 15. Validação de invariantes em CI

```bash
# Script de CI
pnpm --filter @controle-credito/domain test:golden
pnpm --filter @controle-credito/domain test:invariants
```

**Falhas bloqueiam merge.**

---

## 16. Política de migration de motor

- Mudanças no engine passam por ADR novo.
- Versão antiga **não removida** enquanto houver contrato referenciando.
- Rollback só via migration de dados (criar versão nova, migrar manualmente se viável).
- Comunicação prévia ao tenant se houver quebra de compatibilidade (não esperado no `CORE V1`).

---

## 17. Métricas de saúde do motor

- `domain_contract_engine_duration_ms` — p95 < 50ms por cálculo.
- `domain_golden_scenario_drift_count` — zero em produção.
- `domain_rounding_diff_cents_total` — diferença acumulada (deve convergir).
