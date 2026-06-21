# ADR-0019: WhatsApp como canal com o USUARIO (nunca com o tomador)

- **Status:** Aceito
- **Data:** 2026-06-20
- **Substitui:** ADR-0019 v0.3.0

## Contexto

O sistema serve pessoa fisica que faz emprestimos informais. Tomador e credor **se conhecem** — nao e cobranca automatizada de empresa para cliente anonimo. A comunicacao entre credor e tomador acontece no WhatsApp **particular** deles, nao via plataforma.

Decisao: o WhatsApp do sistema fala **apenas com o usuario**. Para o tomador, o sistema **gera modelos de cobranca** (texto pronto) que o usuario copia/encaminha manualmente pelo WhatsApp dele.

**Por que:**
- Tomador e usuario ja se conhecem — intermediar a conversa e desnecessario.
- LGPD mais simples (nao somos operador de comunicacao com tomador).
- Sem custo Meta por envio ao tomador.
- Sem complexidade de janela 24h, templates aprovados pela Meta para tomador, opt-out cross-account.

## Decisao

**WhatsApp (Meta Cloud API, oficial) fala exclusivamente com o usuario, em tres direcoes:**

1. **Sistema -> Usuario** (notificacoes automaticas)
2. **Usuario -> Sistema** (comandos estruturados)
3. **Usuario <-> LLM** (conversacao natural no Ilimitado, ver ADR-0023)

**Sistema NAO fala com tomador.** Para o tomador, o sistema gera **modelos de cobranca** (templates de texto) que o usuario encaminha manualmente.

### 1. Notificacoes ao usuario via WhatsApp

Eventos que disparam mensagem ao usuario:

| Evento | Mensagem exemplo |
|---|---|
| Parcela venceu | "Parcela de R$ 500 do Joao venceu ontem. Quer um modelo de cobranca? Responda `cobrar Joao`." |
| Parcela vence hoje | "Lembrete: parcela de R$ 300 da Maria vence hoje." |
| Tomador pagou (informado manualmente) | "Pagamento de R$ 500 do Joao registrado. Caixa: R$ 4.500." |
| Caixa fechou | "Fechamento do periodo realizado. Saldo final R$ 4.500. Ver detalhes no app." |
| Limite 80% | "Voce esta em 80% do limite de contratos ativos. Plano Pro libera 200." |
| Risco amarelo/vermelho | "Score da nova proposta para Pedro: 480 (amarelo). Ver detalhes no app." |
| Fechamento de periodo perto | "Fechamento da semana em 2 dias. Verifique se ha lancamentos pendentes." |
| Billing | "Sua assinatura Pro foi renovada (R$ 199). Obrigado!" |
| LLM (Ilimitado) | Resposta da conversa natural |

**Frequencia:** eventos sao enviados em tempo real. Agrupamento (3 vencimentos -> 1 mensagem).

**Opt-out granular por categoria.**

### 2. Comandos estruturados do usuario

Comandos disponiveis (todos os planos com WhatsApp):

| Comando | Descricao | Exemplo de resposta |
|---|---|---|
| `status` | Resumo rapido | "3 parcelas vencidas (R$ 1.200), 2 vencendo hoje (R$ 700), caixa R$ 4.500." |
| `tomadores` | Lista tomadores com pendencia | "1. Joao (2 atrasadas). 2. Maria (1 hoje). Total: R$ 1.900." |
| `cobrar [nome]` | **Gera modelo de cobranca** (NAO envia) | "Modelo: 'Ola Joao, tudo bem? Lembrete da parcela de R$ 500 que venceu dia 15/06. Qualquer duvida, me chama. Obrigado!' - Copie e encaminhe ao Joao." |
| `cobrar todos` | Gera modelos para todos com pendencia | "3 modelos gerados. [modelo Joao] [modelo Maria] [modelo Pedro]" |
| `parcela [nome]` | Detalhe das parcelas | "Joao: 1a vence 15/06 (R$ 500), 2a vence 15/07 (R$ 500)." |
| `modelo [tipo]` | Modelos pre-prontos | `modelo amigavel`, `modelo firme`, `modelo curto`, `modelo formal` |
| `ajuda` | Lista comandos | "Comandos: status, tomadores, cobrar [nome], modelo, parar, ajuda" |
| `parar` | Pausa notificacoes | "Notificacoes pausadas. Para reativar, use `retomar` no app." |
| `retomar` | Reativa | "Notificacoes reativadas." |

**Comandos destrutivos** (ex.: criar/editar/excluir contrato, registrar pagamento) **nao sao comandos estruturados** — sao feitos via LLM no Ilimitado (com confirmacao) ou via app nos demais planos.

### 3. Modelos de cobranca (nao envio)

O sistema gera **texto pronto** para o usuario copiar/encaminhar. Modelos por tier:

**Essencial:**
- 1 modelo fixo, simples, amigavel.

**Pro:**
- 4 modelos pre-definidos: amigavel, firme, curto, formal.
- Substituicao de variaveis: nome, valor, data, dias atraso.

**Ilimitado:**
- Tudo do Pro.
- + Modelos custom criados/editados pelo usuario (texto livre + placeholders).
- + LLM pode gerar modelo sob demanda ("escreve um modelo mais firme pro Joao").

**Exemplo de modelo:**

```
Ola {{nome}}, tudo bem?

Estou passando para lembrar da parcela de R$ {{valor}} que tem vencimento em {{data}}.

Caso ja tenha feito o pagamento, por favor desconsidere esta mensagem.

Qualquer duvida, estou a disposicao.

Obrigado(a)!
```

**Substituicao:** o sistema substitui `{{variavel}}` com dados reais antes de mostrar ao usuario. **NUNCA envia o modelo ao tomador.**

### 4. WhatsApp NAO fala com tomador — checklist

- [ ] Sem endpoint `POST /whatsapp/send-to-party` (ou equivalente).
- [ ] Sem webhook de status "delivered" para tomador (Meta nao entrega).
- [ ] Sem janela 24h Meta para tomador (nao usamos Meta para isso).
- [ ] Sem templates aprovados pela Meta para cobranca (modelos sao conteudo gerado, nao mensagem WhatsApp).
- [ ] Sem cobranca conversacional automatica (tomador responde no WhatsApp particular).
- [ ] Sem opt-out cross-account (tomador nao esta na nossa base de WhatsApp).

### 5. Templates Meta (apenas para o usuario)

Como nao falamos com tomador, **templates Meta aprovados** sao apenas para:
- Mensagens proativas ao usuario (`notif_parcela_venceu`, `notif_status_geral`, etc.).
- Verificacao de numero no cadastro (`verify_whatsapp_number`).
- Mensagens da LLM no Ilimitado (templates para segmentos maiores que 24h).

### 6. Vinculacao do numero do usuario

- No cadastro, usuario registra numero WhatsApp.
- Verificacao: codigo de 6 digitos enviado via template `verify_whatsapp_number`; usuario responde `verificar 123456`.
- Apenas **1 numero** ativo por conta (single-user).
- Mudanca de numero exige nova verificacao + confirmacao por e-mail.

### 7. Custos

- Meta cobra por **mensagem de template** (proativa) e por **mensagem de sessa** (resposta dentro de 24h).
- Notificacoes proativas: a maioria sao templates (varia por tipo).
- Comandos do usuario: geralmente dentro da janela 24h (o usuario acabou de mandar uma msg), entao **mensagem livre** (nao cobra template).
- LLM no Ilimitado: custo Anthropic Claude (Sonnet) por token + custo Meta por resposta.
- Custo repassa na margem do plano.
- **Envio ao tomador: ZERO** (sistema nao envia).

## Consequencias

**Positivas:**
- Muito mais simples que o modelo anterior (sem janela 24h para tomador, sem opt-out cross-account).
- LGPD drasticamente mais simples — nao somos intermediarios de comunicacao com tomador.
- Custo Meta cai para ~30-50% do modelo anterior.
- Tomador mantem relacao pessoal com credor (nao e notificado por "robô").
- Modelos de cobranca dao **sugestao** mas usuario mantem **controle total** do tom.

**Negativas:**
- Sem visibilidade se tomador recebeu a cobranca (usuario que sabe, se quiser).
- Sem cobranca conversacional automatica (tomador responde no WhatsApp particular, nao temos como capturar).
- Auto-cobranca (job) deixa de fazer sentido — vira **lembrete para o usuario** ("Voce tem 3 pendencias, quer modelos de cobranca?").

**Mitigacoes:**
- App permite usuario marcar "pagemento recebido" manualmente (fluxo rapido pelo app ou comando `pago [nome] [valor]`).
- Comando `pago [nome] [valor]` registra pagamento e atualiza estado.
- App mostra "ultima interacao" manual registrada pelo usuario com o tomador (campo livre, opcional).

## Pendencias

- Provisionamento operacional: conta Meta Business + WABA + numero dedicado.
- Templates Meta para notificacoes proativas (lista a definir na Sprint 4 — `EXE-004`).
- Parser de comandos estruturados (Sprint 4).
- Integracao LLM (Sprint 5/6, plano Ilimitado).
