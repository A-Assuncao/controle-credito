# Modelo de Segurança

> Complementa [`master-plan.md`](master-plan.md) (secoes 6, 13, 20, 21). Define controles concretos por camada.
> Modelo: **1 usuario por conta, single-session**, sem RBAC (ver master-plan secao 6 e ADR-0018).

---

## 1. Identidade e autenticação

**Stack:** Ory Kratos + Hydra (ADR-0005, refinado por ADR-0018).

**Políticas:**

- Senha mínima 12 caracteres, score zxcvbn ≥ 3.
- **MFA TOTP opcional** por padrao, com **banner recomendando** ativar.
- **MFA obrigatório** ao acessar dados nominais PREMIUM (cross-account Premium) ou para ações sensíveis (fechamento de período, override de risco vermelho).
- **Single-session**: novo login revoga o anterior automaticamente.
- TTL de sessão: **12 horas** desde a última atividade.
- Bloqueio após 5 tentativas falhas em 15min (Kratos `selfservice_flows`).
- **Recuperação de senha** por duplo fator: confirmação por e-mail **e** código SMS no celular cadastrado.

**Tokens:**

- Access token JWT assinado (RS256), TTL 15min.
- Refresh token opaco em Redis, TTL 30 dias com rotação.
- `aud` valida origem (web/app); `iss` fixado no Hydra.
- `correlation_id` adicionado em claims para tracing ponta-a-ponta.

**Cadastro:**

- E-mail + senha + celular + nome completo.
- Confirmação por e-mail **e** SMS antes de ativar a conta.
- Termo de uso e política de privacidade com aceite explícito.

---

## 2. Autorização — modelo single-user

### 2.1 Sem RBAC

O modelo é **single-user por conta** (ver master-plan secao 6 e ADR-0018). Nao ha papéis, nao ha RBAC granular, nao ha convite de outros usuarios. O titular da conta é o **unico** com acesso.

> Compartilhamento de senha é decisão pessoal do titular — nao é feature do produto e nao é suportado nativamente.

### 2.2 Permissões do próprio titular

O usuario tem **todas** as permissões sobre os próprios dados. As "permissoes" abaixo sao flags lógicas no código (gate por plano), aplicadas pelo backend (fonte da verdade):

```
cpf:consult            # registrar consulta CPF (auditada)
cpf:view_full          # ver CPF plaintext na UI
risk:evaluate          # rodar motor de risco
risk:override          # sobrescrever trava (auditada)
risk:configure_policy  # editar política de risco por contrato
cash:close_period      # fechar período
cash:reopen_period     # reabrir (auditada)
contract:write         # criar/editar contrato
contract:renegotiate   # renegociar
premium:reputation:view_aggregated  # ver sinais agregados (Pro+)
premium:reputation:view_nominal     # ver histórico nominal (Ilimitado)
billing:manage         # gerenciar assinatura
audit:export           # exportar trilha
data:export            # export CSV de dados próprios
account:export         # export completo da conta
account:delete         # cancelar conta
```

**Defesa em profundidade:**

- Backend nunca confia em flag vinda do cliente.
- Permissões sensíveis (nominal, override) **exigem MFA verificado no momento**.
- Toda ação sensível é gravada em `audit_log` com `correlation_id`.

---

## 3. Isolamento por conta — defesa em profundidade

### 3.1 Camada de aplicação

- Middleware `AccountContextMiddleware` extrai `account_id` do token e popula request context.
- Toda query no `Repository` recebe `account_id` automaticamente via interceptor.
- **Teste em CI:** tentativa cross-account deve falhar.

### 3.2 Camada de banco (RLS)

```sql
-- Cada tabela de dados do usuario:
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;

CREATE POLICY contracts_account_isolation ON contracts
  USING (account_id = current_setting('app.account_id')::uuid)
  WITH CHECK (account_id = current_setting('app.account_id')::uuid);
```

**Conexão:**

- Role `app_runtime` com `BYPASSRLS = false`.
- Cada conexão abre transação com:
  ```sql
  SET LOCAL app.account_id = '<uuid>';
  ```
- **CI check:** script SQL falha build se detectar role com `BYPASSRLS = true`.

### 3.3 Tabelas globais

Exceções raras (ex.: `reputation_signals_aggregated` que agrega de múltiplas contas, `accounts` que é a própria tabela de contas, `subscriptions_stripe_events` global). Tem RLS diferente ou estao fora do escopo do `app_runtime`.

---

## 4. Dados sensíveis — CPF e PII

### 4.1 Estratégia de armazenamento

| Dado          | Forma                                              | Quem vê plaintext        |
| ------------- | -------------------------------------------------- | ------------------------ |
| CPF           | Hash SHA-256 (com salt global) + últimos 4 dígitos | Próprio titular (sempre) |
| Nome completo | Texto cifrado (pgcrypto)                           | Próprio titular          |
| E-mail        | Texto cifrado                                      | Próprio titular          |
| Telefone      | Texto cifrado                                      | Próprio titular          |
| Endereço      | Texto cifrado                                      | Próprio titular          |
| Valor nominal | Texto cifrado em logs                              | n/a (redaction)          |

**Chaves de criptografia:**

- Globais (nao por tenant) gerenciadas em KMS (Neon permite integração).
- Rotação anual ou em incidente.
- CPF usa hash com **salt global** (nao por tenant) para permitir cross-account com privacidade.

### 4.2 Trilha de `CpfQuery` (auditoria total)

Tabela `cpf_queries` com colunas **obrigatórias**:

| Coluna           | Tipo        | Descrição                                                 |
| ---------------- | ----------- | --------------------------------------------------------- |
| `id`             | uuid        | PK                                                        |
| `account_id`     | uuid        | FK conta (de quem consultou)                              |
| `user_id`        | uuid        | quem consultou (sempre o titular)                         |
| `context`        | enum        | `new_proposal`, `collection`, `periodic_review`, `manual` |
| `cpf_hash`       | text        | hash para auditoria (sem plaintext)                       |
| `result_layer`   | enum        | `common`, `aggregated`, `nominal`                         |
| `result_summary` | jsonb       | retorno normalizado (camadas)                             |
| `source`         | enum        | `internal`, `bureau`                                      |
| `correlation_id` | uuid        | link para trace/log                                       |
| `mfa_verified`   | boolean     | MFA no momento?                                           |
| `created_at`     | timestamptz | sempre                                                    |

**Invariante:** `CpfQuery` é append-only. Sem `UPDATE`/`DELETE` permitido por role de aplicação.

---

## 5. Auditoria — trilha imutável

### 5.1 Tabela `audit_log`

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,           -- ex.: 'cpf.queried', 'risk.overridden'
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',   -- sem PII plaintext
  correlation_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Append-only via:**

- Permissão de role: `INSERT` apenas.
- Trigger que bloqueia `UPDATE`/`DELETE`.
- Replicação para storage WORM (Cloudflare R2 com object lock) como backup.

### 5.2 Ações auditadas (mínimo)

- Login/logout/MFA
- Toda mutação em `parties`, `contracts`, `installments`, `payments`, `cash_period_closes`
- Toda `cpf_queries`
- Toda `risk_overrides`
- Mudança de configuração da conta
- Eventos de billing (Stripe webhooks)
- Export de dados
- Mudança de plano

---

## 6. Trilha de risco e override

`risk_evaluation` salva: score, fatores (cada `rule_id`, peso, evidência, impacto, explicação_ptbr), semáforo.

`risk_override` salva:

- `evaluation_id` (FK)
- `user_id`, `timestamp`
- `score_original`, `score_final` (se alterado)
- `justification` (obrigatória para `hard_block` ≥ 20 caracteres; opcional para `soft_block`)
- `correlation_id`

**Regra:** `risk_override` é imutável. Correções via novo override que referencia o anterior.

---

## 7. Rate limiting e antifraude

### 7.1 Rate limits por superfície

| Superfície                                 | Limite               | Janela   | Por        |
| ------------------------------------------ | -------------------- | -------- | ---------- |
| Login                                      | 10                   | 15min    | IP         |
| Login (sucesso)                            | 50                   | 1h       | user_id    |
| API geral                                  | 1000                 | 1min     | account_id |
| `POST /cpf/queries` (agregado)             | 30                   | 1h       | user_id    |
| `POST /cpf/queries` (nominal)              | 20                   | 1d       | user_id    |
| `risk:evaluate`                            | 60                   | 1min     | user_id    |
| Comandos WhatsApp (usuario)                | 30                   | 1h       | user_id    |
| Notificacoes WhatsApp (sistema -> usuario) | 20                   | 1h       | user_id    |
| Mensagens LLM (Ilimitado)                  | 100/dia, 20/hora     | dia/hora | user_id    |
| Custo LLM (Ilimitado)                      | USD 5/mes (hard cap) | mes      | account_id |
| Recuperação de senha                       | 5                    | 1d       | user_id    |

Implementação: token bucket em Redis (`rate-limiter-flexible`).

### 7.2 Autenticação de comandos via WhatsApp

O usuario pode digitar comandos no WhatsApp (ex.: `cobrar Joao`). O sistema precisa garantir que o numero que esta mandando o comando e **do usuario autenticado**.

**Vinculacao do numero:**

- No cadastro (ou em configuracoes), o usuario registra o numero WhatsApp.
- Verificacao: sistema envia template `verify_whatsapp_number` com codigo de 6 digitos; usuario responde `verificar 123456` para confirmar.
- Apenas **1 numero** ativo por conta (single-user).
- Mudanca de numero exige nova verificacao + confirmacao por e-mail.

**Validacao de comando:**

- Webhook inbound da Meta chega com `from` (numero) + `body` (texto).
- Sistema busca `users.whatsapp_number` vinculado aquele numero.
- Se nao encontrado: resposta padrao "Numero nao cadastrado" + log de seguranca.
- Se encontrado: processa comando respeitando rate limit (7.1) e permissoes do plano.

**Anti-spoofing:**

- Numeros nao vinculados **nao sao processados** (nem resposta automatica, senao vira vetor de enumeration).
- Tentativas repetidas de numeros nao cadastrados viram alerta de seguranca.
- Logs com `correlation_id` + `source_number_hash` (hash do numero para auditoria sem PII).

**Comandos destrutivos:**

- Comandos que afetam tomadores (ex.: `cobrar`, `cancelar`) exigem **confirmacao explicita** antes de executar (Fluxo 5 do `architecture.md`).
- Sessao de confirmacao expira em 5min.
- `parar` (pausar notificacoes) e imediato, mas reativacao **so pelo app** (anti-abuso via WhatsApp clonado).

### 7.3 Detecção de abuso

- Spike de consultas CPF em janela curta (>5x padrão) → alerta + trava automática.
- Tentativa de enumerar CPFs (sequência) → bloqueio + notificação titular.
- Logs centralizados em painel de governança (próprio titular, com export limitado).

### 7.4 Controles de LLM (Ilimitado)

A LLM conversacional (Anthropic Claude) tem acesso a dados do usuario via **tool use**. Controles obrigatorios:

**Escopo de tools (whitelist):**

- Tools de **leitura** (sem confirmacao): listar/buscar parties, contratos, parcelas, caixa, sinal de risco, ajuda.
- Tools de **escrita** (com confirmacao obrigatoria): criar/editar/cancelar contrato, criar/editar party, registrar pagamento, gerar modelo de cobranca.
- Tools **bloqueadas** (mesmo no Ilimitado): mudanca de plano, billing, PREMIUM nominal, export em massa, configuracoes de risco.

**Validacao antes de tool de escrita:**

- Toda tool de escrita gera um `confirmation_token` (TTL 5min).
- A LLM responde ao usuario com preview da acao ("Confirma criar contrato de R$ 1.000 para Maria em 3x?").
- Usuario responde `SIM` (ou equivalente).
- Sistema valida token, executa tool, grava `audit_log` com `confirmation_token` + `llm_message_id`.

**Privacidade de dados enviados a LLM:**

- **CPF**: sempre mascarado (`***.123.456.789-**`) ao passar para LLM, exceto quando a LLM explicitamente precisa do CPF completo (raro, e registrado no log).
- **Valores monetarios**: enviados completos quando relevantes para a pergunta; resumidos caso contrario.
- **Nome do tomador**: enviado (necessario para conversa).
- **NUNCA enviar**: senha, token, chave de API, dados bancarios do tomador (PIX, conta), endereco completo.

**Logs (`llm_call_log`):**

| Coluna               | Conteudo                                 |
| -------------------- | ---------------------------------------- |
| `id`                 | uuid                                     |
| `account_id`         | FK                                       |
| `user_id`            | FK                                       |
| `created_at`         | timestamp                                |
| `user_message`       | mensagem do usuario (texto)              |
| `llm_response_text`  | resposta da LLM (texto)                  |
| `tools_called`       | JSONB com tool, args, result             |
| `model`              | `claude-sonnet-4-6` ou `claude-opus-4-8` |
| `input_tokens`       | contagem                                 |
| `output_tokens`      | contagem                                 |
| `cost_usd`           | custo calculado                          |
| `correlation_id`     | link para trace                          |
| `confirmation_token` | se houve tool de escrita                 |

- Retencao: **90 dias** (mesmo que logs operacionais).
- Acesso: apenas o proprio usuario pode ver seu historico de conversa.
- Sem PII completa em logs (CPF, valores grandes sao removidos na gravacao).

**System prompt:**

- Versao em Git, assinada.
- Define persona, escopo de tools, regras de confirmacao.
- Revisado a cada release.

**Rate limit e custo:**

- 100 mensagens/dia, 20/hora (ver 7.1).
- Hard cap de custo: USD 5/mes por conta.
- Excedente: bloqueio suave com mensagem "Limite diario atingido. Tente amanha ou use o app."

**Anti-abuso:**

- Tentativas de prompt injection (usuario tenta fazer LLM ignorar regras) sao detectadas e o tool e chamado **apenas** via codigo, nao via LLM diretamente.
- Tools sempre tem validacao server-side (autorizacao, ownership, valores, schema).
- LLM **nao tem acesso direto** ao DB; passa por `tool_dispatcher` que valida tudo.

---

## 8. Criptografia e transporte

- **TLS 1.3** em todo tráfego (Cloudflare gerencia).
- **HSTS** com `max-age=63072000; includeSubDomains; preload`.
- **Certificados:** gerenciados pelo Cloudflare; rotação automática.
- **Criptografia em repouso:** Neon (volume criptografado), Cloudflare R2 (default), Redis (Upstash AOF criptografado).
- **Backups:** PITR + snapshot semanal em região secundária, criptografados.

---

## 9. Segredos e configuração

- **Segredos** em GitHub Actions Secrets + Doppler/Vault para runtime.
- **Rotação:** chaves de API trimestralmente ou em incidente.
- **`.env` em repositório:** proibido (exceto `.env.example` com placeholders).
- **Logs nunca contêm:** tokens, chaves, senhas, CPF plaintext, payloads brutos de bureau, conteúdo de WhatsApp em claro.

---

## 10. Política de retenção e descarte

| Tipo de dado                         | Retenção                      | Descarte                                                                 |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------ |
| Logs operacionais                    | 90 dias                       | Auto-delete em Loki                                                      |
| Trilha de auditoria                  | 5 anos (mínimo legal)         | Após 5 anos, exporta + delete                                            |
| `cpf_queries`                        | 5 anos                        | Anonimização após                                                        |
| `payments`/`contracts`               | Enquanto conta ativa + 5 anos | Export + delete ao encerrar                                              |
| Dados de conta cancelada             | 30 dias após cancelamento     | Delete hard + confirmação                                                |
| Sinais compartilhados (anonimizados) | **Mantidos**                  | Usados para score agregado futuro, sem possibilidade de re-identificação |

**Implementação:** job diário varre dados com TTL vencido e executa delete (com snapshot prévio).

**Caso especial:** quando o titular cancela a conta, **dados anonimizados sao mantidos** para preservar histórico de score cross-account (ver LGPD art. 16 e ADR-0021).

---

## 11. Backups e DR

| Item              | Valor                             |
| ----------------- | --------------------------------- |
| Backup automático | Diário (PITR contínuo até 7 dias) |
| RPO               | ≤ 15min                           |
| RTO               | ≤ 2h                              |
| Teste de restore  | Trimestral                        |
| Storage de backup | Região secundária (us-west-2)     |
| Criptografia      | AES-256 em repouso                |

---

## 12. Testes de segurança obrigatórios

- **SAST** (Semgrep + CodeQL) em CI, falha em severidade ≥ high.
- **DAST** (OWASP ZAP) semanal em staging.
- **Dependency audit** (`npm audit --audit-level=high`).
- **Trivy** para imagens Docker.
- **Suite de isolamento por conta:** tentativa cross-account deve falhar (NFR-06).
- **Suite de auditoria:** mutação de dado auditado sem trilha falha o teste.
- **Suite de LGPD:** export funciona; anonimização após cancelamento é validada.

---

## 13. Compliance checklist (técnico)

Itens preparados pelo time, **validados por jurídico**:

- [ ] DPIA preenchido em `docs/compliance/dpia.md`
- [ ] Inventário de subprocessadores em `docs/compliance/subprocessors.md`
- [ ] Política de privacidade redigida (linguagem para leigo, PF)
- [ ] Termos de uso redigidos
- [ ] Mecanismo de exportação de dados do titular (LGPD art. 18, V) — **direto pelo app**
- [ ] Mecanismo de exclusão de dados (LGPD art. 18, VI) com anonimização preservada
- [ ] Canal de comunicação com DPO
- [ ] Procedimento de resposta a incidente (com janelas e responsáveis)
- [ ] Política de opt-out WhatsApp
- [ ] Consentimento do tomador registrado no cadastro

Ver [`docs/compliance-checklist.md`](compliance-checklist.md) para status por item.
