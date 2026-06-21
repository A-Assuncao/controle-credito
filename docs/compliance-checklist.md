# Checklist de Compliance

> Itens que **exigem parecer juridico formal** antes de ativacao. O assistente prepara estrutura e templates; **advogado/DPO valida e assina**.

---

## Status atual

| # | Item | Bloqueia | Status | Responsavel |
|---|---|---|---|---|
| 1 | Transferencia internacional de dados (LGPD art. 33) | Go-live | Pendente | DPO/advogado |
| 2 | Hospedagem fora do Brasil (ANPD) | Go-live | Pendente | DPO/advogado |
| 3 | DUE diligence de subprocessadores | Go-live | Pendente | DPO/advogado |
| 4 | Politica de privacidade | Go-live | Pendente | DPO/advogado |
| 5 | Termos de uso (B2B SaaS) | Go-live | Pendente | Advogado civel |
| 6 | Politica de retencao e descarte | Go-live | Pendente | DPO |
| 7 | Mecanismo de exportacao de dados (LGPD art. 18, V) | Go-live | Preparacao tecnica | Tech Lead + DPO |
| 8 | Mecanismo de exclusao de dados (LGPD art. 18, VI) | Go-live | Preparacao tecnica | Tech Lead + DPO |
| 9 | Canal de comunicacao com DPO | Go-live | Pendente | DPO |
| 10 | Procedimento de resposta a incidente | Go-live | Pendente | DPO + Security Lead |
| 11 | Compartilhamento nominal cross-account (PREMIUM) | EXE-006/007 | Pendente | DPO/advogado |
| 12 | Mecanismo de contestacao (PREMIUM) | EXE-006/007 | Pendente | DPO + Product |
| 13 | Base legal para tratamento de CPF | Go-live | Pendente | DPO/advogado |
| 14 | Consentimento do tomador no cadastro (score compartilhado) | EXE-005 | Estrutura prevista | Tech Lead + DPO |
| 15 | Contratos com bureaus (Serasa/SCPC) | F6 | Pendente | DPO + Compras |
| 16 | Consentimento WhatsApp do tomador (base legal) | EXE-004 | Estrutura prevista | Tech Lead + DPO |
| 16a | Politica de opt-out WhatsApp (do tomador) | EXE-004 | Estrutura prevista | Tech Lead + DPO |
| 20 | Provedor LLM (Anthropic) e transferencia de dados | EXE-007/F5 | Pendente | DPO/advogado |
| 21 | Retencao de logs de conversas LLM | EXE-007/F5 | Estrutura prevista | Tech Lead + DPO |
| 17 | Contrato comercial com clausulas LGPD | Go-live | Pendente | Advogado civel |
| 18 | DPIA (Relatorio de Impacto a Protecao de Dados) | Go-live | Template pronto | DPO |
| 19 | RIPD quando PREMIUM for ativado | EXE-007 | Template pronto | DPO |

---

## Detalhamento por item

### 1. Transferencia internacional de dados (LGPD art. 33)

**Necessario:**
- Parecer sobre base legal para transferencia (SCCs, clausulas-padrao contratuais, cooperacao ANPD).
- Lista de paises de processamento (Neon: US, Upstash: US/EU, Cloudflare: global).
- Avaliacao de adequacao (EUA: Data Privacy Framework, EU: GDPR adequacy).
- Mecanismos alternativos se algum pais nao tiver adequacy.

**Acoes tecnicas:**
- [ ] Inventario de subprocessadores em `docs/compliance/subprocessors.md`
- [ ] Politica de privacidade com clausula explicita de transferencia internacional
- [ ] Contratos com SCCs quando aplicavel

**Subprocessadores atuais:**
| Nome | Servico | Pais | Status |
|---|---|---|---|
| Neon | PostgreSQL gerenciado | EUA (us-east-1) | SCCs pendentes |
| Upstash | Redis gerenciado | EUA/EU | SCCs pendentes |
| Cloudflare | CDN/WAF/R2 | Global | SCCs pendentes |
| Postmark | E-mail transacional | EUA | SCCs pendentes |
| Stripe | Billing | EUA | Contrato proprio Stripe |
| Ory | Identity (self-hosted) | N/A (nosso host) | N/A |
| Meta Cloud API | WhatsApp Business | EUA/BR | Termos Meta |
| Grafana Cloud | Observabilidade | EUA | SCCs pendentes |
| Sentry | Error tracking | EUA | SCCs pendentes |
| GitHub | CI/CD + repositorio | EUA | Contrato proprio GitHub |

---

### 2. Hospedagem fora do Brasil

**Necessario:**
- DPIA formal (item 18).
- Politica de privacidade com aviso claro ao titular.
- Analise de risco especifica para transferencia.

---

### 3. DUE diligence de subprocessadores

**Necessario:**
- Questionario de seguranca e privacidade aplicado a cada um.
- Clausulas LGPD em contratos.
- Certificacao SOC 2 / ISO 27001 (preferivel).

---

### 4. Politica de privacidade

**Necessario:**
- Redacao por advogado especializado.
- **Linguagem acessivel para pessoa fisica** (publico leigo, nao corporativo).
- Publicacao no site e aceite no onboarding.
- Atualizacao em qualquer mudanca de subprocessador ou finalidade.

**Estrutura tecnica:**
- Quem somos (controlador vs operador)
- Dados que coletamos
- Finalidades
- Bases legais
- Compartilhamento
- Transferencia internacional
- Retencao
- Direitos do titular (LGPD art. 18)
- Cookies
- Encarregado (DPO)
- Como contatar
- Alteracoes na politica

---

### 5. Termos de uso (B2B SaaS)

**Necessario:**
- Clausulas de SLA.
- Limitacao de responsabilidade.
- Propriedade intelectual.
- Rescisao.
- LGPD (operador).
- Foro.

---

### 6. Politica de retencao e descarte

**Ja estruturada tecnicamente em `docs/security-model.md` secao 10. Juridicamente:**
- Validar prazos por tipo de dado.
- Validar descarte vs anonimizacao.
- Validar requisitos especificos do setor financeiro (se aplicavel).

---

### 7. Mecanismo de exportacao de dados (LGPD art. 18, V)

**Acao tecnica:**
- Endpoint `GET /api/me/data-export` retorna JSON com todos os dados do titular.
- Inclui contratos, parcelas, pagamentos, consultas CPF (com metadata).
- **Disponivel diretamente pelo app** (decisao do usuario).
- Processamento assincrono (job); notificacao por e-mail quando pronto.

**Status:** Estrutura prevista em `apps/api/src/modules/privacy/export/`.

---

### 8. Mecanismo de exclusao de dados (LGPD art. 18, VI)

**Acao tecnica:**
- Endpoint `POST /api/me/account/delete`.
- Workflow: solicitacao → confirmacao (e-mail + celular) → execucao assincrona → **anonimizacao preservando integridade financeira** (dados pessoais sao removidos, mas hashes e estatisticas sao mantidos para score historico).
- **Sinais compartilhados (cross-account) sao mantidos de forma anonimizada** para preservar historico de score (LGPD art. 16).
- Trilha auditavel da solicitacao e execucao.

**Status:** Estrutura prevista em `apps/api/src/modules/privacy/deletion/`.

---

### 9. Canal de comunicacao com DPO

**Necessario:**
- E-mail dedicado (ex.: `dpo@controlecredito.com.br`).
- Formulario de contato.
- SLA de resposta (LGPD: 15 dias).

---

### 10. Procedimento de resposta a incidente

**Necessario:**
- Definicao de incidente de seguranca.
- Equipe de resposta (CSIRT minimo).
- Plano de comunicacao (titulares, ANPD, mercado).
- Janela de notificacao a ANPD: prazo legal + razoavel.
- Templates de comunicacao.
- Runbooks especificos (vazamento de CPF, acesso indevido, etc.).

---

### 11. Compartilhamento nominal cross-account (PREMIUM)

**Status:** `EXE-007` BLOQUEADO ate este parecer.

**Necessario:**
- Base legal especifica (consentimento vs legitimo interesse).
- Analise de risco de reidentificacao.
- Politica de minimizacao.
- Clausulas em contrato com usuario sobre uso do dado.
- Fluxo de contestacao para o titular.

**Workaround aprovado:** modo `safe_aggregated` (ADR-0012, ADR-0021) e juridicamente mais seguro.

---

### 12. Mecanismo de contestacao (PREMIUM)

**Necessario:**
- Canal dedicado para titular contestar sinal negativo.
- SLA de revisao.
- Comite ou responsavel pela decisao.
- Trilha imutavel.

---

### 13. Base legal para tratamento de CPF

**Necessario:**
- Analise caso a caso: o CPF e coletado para **execucao de contrato** (relacao tomador ↔ credor).
- Pode requerer consentimento especifico dependendo da finalidade (ex.: consulta a bureau).

---

### 14. Consentimento do tomador no cadastro (score compartilhado)

**Acao tecnica:**
- No cadastro do tomador, registrar:
  - Flag `consentimento_score_compartilhado: boolean`.
  - Versao do termo de ciencia no momento do aceite.
  - IP, user-agent, timestamp.
- Sem consentimento → tomador nao alimenta a base compartilhada.
- Consentimento revogavel a qualquer momento (LGPD art. 18, IX).

**Status:** Estrutura prevista em `apps/api/src/modules/parties/` (Sprint 2).

**Necessario juridico:** validar redacao do termo de ciencia (linguagem simples).

---

### 15. Contratos com bureaus (Serasa/SCPC)

**Necessario quando F6 entrar:**
- Contrato comercial com cada bureau.
- Clausulas LGPD.
- Limites de uso.
- Retencao (nao reter dado de bureau alem do necessario).

---

### 16. Politica de opt-out WhatsApp

**Acao tecnica:**
- Tomador responde "PARAR"/"SAIR" → sistema marca `party.opt_out_whatsapp = true`.
- Regra **global**: se opt-out, nenhum usuario pode enviar a esse numero.
- Opt-out e revogavel (tomador pode pedir para voltar a receber).

**Status:** Estrutura prevista em `apps/api/src/modules/whatsapp/` (Sprint 3).

**Necessario juridico:** validar conformidade com regulamentacao de telecom (Anatel) e LGPD.

---

### 16a. Consentimento WhatsApp do tomador (base legal)

**Contexto:** o tomador recebe mensagens WhatsApp (cobranca) enviadas pelo sistema. Alem do opt-out (item 16), o sistema precisa de **base legal** para iniciar o contato.

**Acao tecnica:**
- No cadastro do tomador, registrar:
  - Flag `consentimento_whatsapp: boolean`.
  - Como foi obtido: `manual_input` (usuario digitou numero e declarou consentimento), `first_response` (tomador respondeu apos usuario ter iniciado conversa dentro da janela 24h).
  - Versao do termo, IP, user-agent, timestamp.
- Sem consentimento explicito -> sistema **nao envia** mensagem ao tomador.
- Se tomador responde (abrindo janela 24h), sistema pode enviar mensagens livres por 24h; a primeira cobranca formal exige template aprovado pela Meta.
- Consentimento revogavel: tomador pode pedir para sair a qualquer momento (item 16).

**Status:** Estrutura prevista em `apps/api/src/modules/parties/` (Sprint 2) e `apps/api/src/modules/whatsapp/` (Sprint 3).

**Necessario juridico:**
- Validar base legal: execucao de contrato (relacao tomador ↔ credor) e/ou legitimo interesse.
- Validar redacao do termo de ciencia quando usuario cadastra o tomador.
- Confirmar se "primeira mensagem dentro da janela 24h" e suficiente base legal para cobranca subsequente.
- Validar politica de retencao do consentimento (LGPD art. 16).

---

### 17. Contrato comercial com clausulas LGPD

**Necessario:**
- Contrato B2B entre SaaS e titular da conta define claramente:
  - SaaS = operador (LGPD).
  - Titular = controlador.
  - Finalidades permitidas.
  - Subprocessadores autorizados.
  - SLA de seguranca.
- Aceite no onboarding.

---

### 18. DPIA

**Template tecnico em `docs/compliance/dpia-template.md` (a criar).**

**Necessario:**
- Preenchimento pelo DPO/advogado.
- Revisao periodica (anual ou em mudanca significativa).
- Arquivo acessivel para ANPD.

---

### 19. RIPD (Relatorio de Impacto a Protecao de Dados Pessoais)

**Mesmo template do DPIA, foco em PREMIUM.**

---

### 20. Provedor LLM (Anthropic) e transferencia de dados

**Contexto:** no plano Ilimitado, conversas do usuario com a LLM sao enviadas a Anthropic (provider Claude). Dados do usuario (incluindo dados de tomadores, mesmo que mascarados) cruzam fronteira internacional para processamento.

**Necessario:**
- Adicionar Anthropic ao inventario de subprocessadores.
- Validar base legal para transferencia internacional (LGPD art. 33) — mesma base dos outros subprocessadores US (SCCs, Data Privacy Framework US-EU).
- Avaliar termos de uso e politica de privacidade da Anthropic:
  - Dados nao sao usados para treino (confirmar).
  - Retencao: Anthropic retem por periodo determinado? Logs sao expurgados?
  - Subprocessadores da Anthropic.
- Atualizar politica de privacidade para informar que o usuario do Ilimitado tem dados processados por LLM.
- Consentimento explicito no upgrade para Ilimitado: "Ao usar o plano Ilimitado, suas conversas serao processadas por um provedor de IA (Anthropic) nos EUA."

**Acoes tecnicas:**
- [ ] Adicionar Anthropic ao inventario em `docs/compliance/subprocessors.md`.
- [ ] SCCs assinadas com Anthropic.
- [ ] System prompt e mascaramento aplicados antes de envio (ja definido em `security-model.md` §7.4).
- [ ] Aviso no onboarding do Ilimitado.

---

### 21. Retencao de logs de conversas LLM

**Contexto:** toda conversa LLM gera registro em `llm_call_log` (mensagem do usuario, tools chamadas, resposta da LLM, custo, correlation_id). Logs sao necessarios para auditoria e debugging, mas tem dados pessoais.

**Necessario:**
- Definicao de prazo de retencao (proposta: 90 dias).
- Definicao de politica de expurgo.
- Acesso restrito (proprio usuario; equipe tecnica apenas para debugging).
- Criptografia em repouso (ja garantida pela infra).
- Mecanismo de expurgo automatico (job diario).

**Acoes tecnicas:**
- [ ] Job de expurgo diario para `llm_call_log` com `created_at > now() - 90 days`.
- [ ] UI permite usuario ver e apagar seu proprio historico de conversa.
- [ ] Logs sem PII completa (mascaramento automatico antes de gravar).

**Juridico:**
- Validar prazo conforme LGPD art. 16 (eliminacao apos cessada a finalidade).
- Avaliar se conversa pode ser solicitada pelo titular via LGPD art. 18, V (exportacao).

---

## Proximos passos recomendados

1. **Acionar DPO/advogado** agora — em paralelo a Sprint 1.
2. **Reservar budget** para pareceres formais (estimativa: R$ 8k–R$ 25k para o pacote inicial).
3. **Preparar material de apoio:** inventario tecnico, arquitetura resumida, fluxos de dados.
4. **Definir calendario:** meta de ter itens 1–6 fechados antes do go-live; 11–19 sao incrementais.
