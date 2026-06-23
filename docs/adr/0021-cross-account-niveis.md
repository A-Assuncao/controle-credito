# ADR-0021: Análise de crédito cross-account por níveis

- **Status:** Aceito
- **Data:** 2026-06-20
- **Substitui/Refina:** master-plan seção 18 (PREMIUM)

## Contexto

O "Serasa interno" do produto usa dados de **todos os contratos de todos os usuários** para alimentar o score de CPF. O titular dos dados (tomador inadimplente) **não acessa o sistema**. O modelo tem que funcionar para pessoa física com diferentes níveis de assinatura, sem expor PII sem necessidade.

## Decisão

**Três níveis de visibilidade, gated por plano e com consentimento explícito do tomador.**

### Níveis

| Nível       | Plano              | Conteúdo                                                                            |
| ----------- | ------------------ | ----------------------------------------------------------------------------------- |
| **Comum**   | Essencial          | Apenas dados do próprio usuário. Análise de risco intra-account.                    |
| **Médio**   | Pro                | Estatísticas agregadas da base: pendências, % atraso, ticket médio, tempo médio.    |
| **Premium** | Ilimitado (inclui) | Detalhe nominal: lista de usuários, contratos, parcelas, status onde o CPF aparece. |

### Consentimento do tomador

- No **cadastro do tomador**, há flag `consentimento_score_compartilhado: boolean`.
- Termo de ciência explícito: "Seus dados podem ser usados de forma agregada para análise de crédito".
- **Sem consentimento**: dados do tomador **não alimentam** a base compartilhada.
- Consentimento é revogável (LGPD art. 18, IX).
- Revogação anonimiza o tomador na base compartilhada (preserva histórico, remove identificadores).

### Estrutura da base

- `reputation_signals_aggregated`: dados agregados por CPF (consolidados de todos os usuários com consentimento).
- `reputation_signals_nominal`: dados nominais por CPF (com `account_id` de origem).
- **`reputation_signals_nominal` requer MFA obrigatório** e feature flag de jurídica habilitada.
- Auditoria total: `cpf_query_log` registra `account_id`, `purpose`, `result_layer`, `correlation_id`, `mfa_verified`.

### Pseudonimização

- Tomador é identificado na base compartilhada por `cpf_hash` (SHA-256 + salt global).
- `cpf_hash` é a chave de cruzamento. Plaintext nunca é gravado.
- Salt global é trocado anualmente (ou em incidente).

### Roteiro de ativação

1. **Estágio 1 (go-live):** níveis Comum e Médio ativos. Sem nominal. Sem bureau.
2. **Estágio 2 (90 dias após go-live, com jurídico):** nível Premium habilitado para Ilimitado, com parecer jurídico.
3. **Estágio 3 (6-12 meses):** integração com bureaus (Serasa, SCPC) como camada adicional.

### Limites

- **Essencial:** sem acesso a cross-account.
- **Pro:** até 100 consultas agregadas/mês. Excedente R$ 1,50/consulta.
- **Ilimitado:** até 50 consultas nominais/mês + 100 agregadas. Excedente R$ 5,00/nominal, R$ 1,50/agregada.
- Limites diários: 50 consultas agregadas/dia, 20 nominais/dia (anti-abuso).
- Detecção de padrão anômalo (rajada) → trava automática + alerta.

### Tomador pode ver seus dados?

- **Não** via app (tomador não acessa).
- **Sim** via canal dedicado: titular pode pedir revisão/correção por e-mail (DPO) ou formulário.
- Contestação gera ticket e revisão em até 15 dias (LGPD art. 18, IX).

## Consequências

**Positivas:**

- Diferencial competitivo real desde o Essencial (Comum já entrega valor via análise intra-account).
- Cross-account agrega inteligência sem expor PII sem necessidade.
- Consentimento dá base legal sólida (LGPD art. 7º, I).
- Gating por plano gera upgrade orgânico.

**Negativas:**

- Custo computacional para agregação em tempo real (mitigado com materialized views + job noturno).
- Risco de contestação por titular insatisfeito com sinal.
- Complexidade de auditoria e rate limiting.

**Mitigações:**

- Job noturno agrega sinais; cache Redis com TTL de 1h.
- Processo de contestação registrado em compliance.
- Trilha imutável e revisão periódica de acessos (a cada 90 dias).
- Pseudonimização forte + salt rotacionado.

**Pendências:**

- Parecer jurídico formal antes do Estágio 2 (PREMIUM nominal).
- Definição do canal de contestação (e-mail DPO ou formulário).
- Política de anonimização após revogação de consentimento (LGPD art. 16).
