# ADR-0023: LLM conversacional no plano Ilimitado

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

O usuario do sistema e pessoa fisica que faz emprestimos informais. As tarefas rotineiras (consultar parcelas, criar contratos, registrar pagamentos, gerar modelos de cobranca) exigem varios cliques no app. Comandos estruturados resolvem parte, mas nao dao a **fluidez** de conversa natural.

Decisao: no plano **Ilimitado**, adicionar uma LLM que o usuario pode conversar via WhatsApp (ou no app). A LLM:

- Entende linguagem natural em portugues.
- Acessa dados do usuario via **tool use** (function calling) com escopo definido.
- Executa **funcoes rotineiras** com confirmacao do usuario.
- NUNCA executa acao destrutiva sem confirmacao explicita.
- E auditada: toda chamada e logada.

## Decisao

**LLM conversacional disponivel apenas no plano Ilimitado**, com provider Anthropic Claude (modelo Sonnet por padrao, Opus para tarefas que exigem raciocinio mais profundo).

### Provider

- **Anthropic Claude** (Sonnet 4.6 para tarefas rotineiras, Opus 4.8 para tarefas que exigem mais).
- API key em vault.
- Sem treinamento em dados do usuario (Claude nao usa dados para treino por default; verificar termos periodicamente).

### Canais de acesso

| Canal         | Como                                                       |
| ------------- | ---------------------------------------------------------- |
| **WhatsApp**  | Usuario conversa com a LLM via mesma interface de comandos |
| **App (web)** | Widget de chat no canto da tela                            |

### Capacidades (escopo de tools)

A LLM tem acesso a um conjunto **whitelist** de tools (function calling):

**Leituras (sem confirmacao):**

| Tool                | Descricao                                               |
| ------------------- | ------------------------------------------------------- |
| `list_parties`      | Lista tomadores com filtros                             |
| `get_party`         | Detalhe de um tomador                                   |
| `list_contracts`    | Lista contratos com filtros (status, vencimento, valor) |
| `get_contract`      | Detalhe de um contrato                                  |
| `list_installments` | Lista parcelas (vencidas, a vencer, pagas)              |
| `get_cash_summary`  | Resumo de caixa (saldo, projecao 7 dias)                |
| `get_risk_signal`   | Sinal de risco do CPF (cross-account conforme tier)     |
| `search_app_help`   | Busca na documentacao de ajuda do app                   |

**Escritas (COM confirmacao obrigatoria):**

| Tool                           | Descricao                       | Confirmacao                                                                |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------------- |
| `create_contract`              | Criar contrato com parametros   | "Confirma criar contrato de R$ X para [nome] em Y parcelas? Responda SIM." |
| `update_contract`              | Editar contrato                 | "Confirma alterar [campo] de [A] para [B]?"                                |
| `record_payment`               | Registrar pagamento recebido    | "Confirma registrar pagamento de R$ X do [nome]?"                          |
| `cancel_contract`              | Cancelar contrato (soft delete) | "Confirma CANCELAR o contrato com [nome]? Valor em aberto: R$ X."          |
| `create_party`                 | Criar novo tomador              | "Confirma criar tomador [nome] com CPF XXX?"                               |
| `update_party`                 | Editar tomador                  | Confirmacao                                                                |
| `generate_collection_template` | Gerar modelo de cobranca        | (retorna texto, usuario copia/encaminha)                                   |

**Acoes BLOQUEADAS para a LLM (mesmo no Ilimitado):**

- Mudanca de plano / billing.
- Exclusao permanente de contratos (apenas soft delete via cancel).
- Operacoes PREMIUM nominais (exigem MFA + auditoria adicional).
- Alteracao de configuracoes de risco.
- Exportacao em massa de dados.
- Cadastro/alteracao de metodos de pagamento.

### Fluxo de uma conversa

```
[Usuario via WhatsApp]                  [API]                              [LLM]
   │                                       │                                  │
   │  "Quanto o Joao tá                    │                                  │
   │   me devendo?"                        │                                  │
   ├──────────────────────────────────────▶│                                  │
   │                                       │  carregar contexto:              │
   │                                       │  - conta do usuario              │
   │                                       │  - tools permitidas (escopo)     │
   │                                       │  - resumo de dados (anonimizado) │
   │                                       ├─────────────────────────────────▶│
   │                                       │                                  │
   │                                       │  tool call:                      │
   │                                       │  list_installments(party="Joao") │
   │                                       │◀─────────────────────────────────│
   │                                       │                                  │
   │                                       │  executar tool (DB)              │
   │                                       │  retorna: [parcela 1, parcela 2] │
   │                                       ├─────────────────────────────────▶│
   │                                       │                                  │
   │                                       │  resposta natural:               │
   │                                       │  "O Joao tem 2 parcelas          │
   │                                       │   atrasadas, total R$ 1.000..."  │
   │                                       │◀─────────────────────────────────│
   │  "O Joao tem 2 parcelas atrasadas,    │                                  │
   │   total R$ 1.000. A próxima vence     │                                  │
   │   em 15/07. Quer um modelo de         │                                  │
   │   cobranca? Responda SIM."            │                                  │
   ◀──────────────────────────────────────│                                  │
```

### Fluxo de acao com confirmacao

```
[Usuario]                              [LLM]                        [API]
   │                                       │                          │
   │  "Cria contrato de R$ 1.000           │                          │
   │   pra Maria em 3x"                    │                          │
   ├──────────────────────────────────────▶│                          │
   │                                       │  tool call:              │
   │                                       │  create_contract(...)    │
   │                                       │  needs_confirmation=true │
   │                                       │                          │
   │  "Confirma criar contrato de          │                          │
   │   R$ 1.000 para Maria em 3x?          │                          │
   │   Juros 2% a.m. Responda SIM."        │                          │
   ◀──────────────────────────────────────│                          │
   │                                       │                          │
   │  "SIM"                                │                          │
   ├──────────────────────────────────────▶│                          │
   │                                       │  tool call:              │
   │                                       │  confirm_create_contract │
   │                                       ├─────────────────────────▶│
   │                                       │                          │  executar (DB)
   │                                       │                          │  audit log
   │                                       │◀─────────────────────────│
   │                                       │                          │
   │  "Contrato criado! ID: 12345.         │                          │
   │   3 parcelas de R$ 346,67."           │                          │
   ◀──────────────────────────────────────│                          │
```

### Privacidade e seguranca

**Dados enviados a LLM:**

- **Nunca plaintext**: CPF, valores nominais, dados de tomadores vao **mascarados** ou **resumidos** quando nao essenciais.
- Ex.: "Joao da Silva (CPF **\*123.456.789-**)" em vez de CPF completo.
- Valores: usuario pode pedir "quanto falta" → LLM chama tool que retorna valor real; LLM **nao precisa ver todos os valores historicos** — so o necessario para a pergunta atual.

**System prompt:**

- Define persona ("assistente do app para gestao de emprestimos").
- Lista tools permitidas.
- Instrui a **pedir confirmacao** para qualquer tool de escrita.
- Instrui a **recusar** acoes fora do escopo.

**Logs:**

- `llm_call_log` registra: timestamp, user_id, mensagem do usuario (texto), tools chamadas, resposta da LLM (texto), correlation_id.
- **Nunca** loga valores monetarios completos, CPFs completos, ou dados de tomadores em plaintext.
- Retencao: 90 dias (mesmo que logs operacionais).
- Acesso restrito: apenas o proprio usuario pode ver seu historico de conversa.

**Rate limiting:**

| Limite                   | Valor               |
| ------------------------ | ------------------- |
| Mensagens por dia        | 100                 |
| Mensagens por hora       | 20                  |
| Tool calls por mensagem  | 10                  |
| Custo mensal por usuario | USD 5 (limite hard) |

Excedente: bloqueio suave com mensagem "Voce atingiu o limite diario. Tente novamente amanha ou use o app."

### Auditoria

- Toda tool de escrita grava `audit_log` com: `action = 'llm.tool.create_contract'` (ou similar), `metadata = { tool, args, llm_message_id, confirmation_token }`.
- `correlation_id` propaga da mensagem do usuario ate a tool executada.
- Revisao semanal automatica: tools mais usadas, falhas, alucinacoes detectadas.

### Custo

- Custo Anthropic: ~USD 0.003 por mensagem tipica (Sonnet).
- Custo WhatsApp (Meta) por resposta da LLM: varia se for template ou livre (dentro de 24h do usuario).
- Estimativa: 100 mensagens/dia \* 30 dias = 3000 mensagens/mes/usuario ≈ USD 9/mes + Meta.
- Margem do plano Ilimitado (R$ 449) absorve com folga para usuarios medios.
- Usuarios muito ativos: rate limit + nudge para usar comandos estruturados.

## Consequencias

**Positivas:**

- UX diferenciada — usuario fala naturalmente em vez de decorar comandos.
- Funcoes rotineiras aceleradas (criar contrato, registrar pagamento) — 1 mensagem vs varios cliques.
- **Diferencial competitivo** claro do plano Ilimitado.
- Auditoria rigorosa mitiga riscos de LLM agir fora do escopo.

**Negativas:**

- Custo recorrente maior para usuarios ativos.
- LLM pode alucinar ou interpretar mal — mitigamos com tool use deterministico + confirmacao.
- Privacidade: dados do usuario vao para provider LLM (mitigamos com mascaramento e termos Anthropic).
- Latencia: 1-3s por resposta (vs 200ms de comando estruturado).

**Mitigacoes:**

- System prompt rigoroso com escopo de tools.
- Toda escrita exige confirmacao.
- Logs detalhados para auditoria.
- Rate limit diario + custo hard.
- Fallback para comandos estruturados se LLM falhar.
- Validacao humana periodica das conversas (sample de 1%).

## Pendencias

- Definicao do system prompt (versao 1 a fazer na Sprint 6 — F5 do roadmap).
- Lista final de tools (acima e rascunho).
- UI do widget de chat no app.
- Politica de retencao de logs (90 dias provisorio, validar com juridico).
- Validacao juridica do envio de dados a provider LLM.
