# ADR-0020: Tiering comercial para pessoa física

- **Status:** Aceito
- **Data:** 2026-06-20
- **Substitui:** ADR-0016 (tiering enterprise)

## Contexto

O público-alvo é **pessoa física** (credor individual) com caso de borda MEI. Decisão de compra é pessoal e sensível a preço. Não há multi-user, mas há **features** que agregam valor em camadas — incluindo o canal de cobrança WhatsApp e o score cross-account (PREMIUM).

## Decisão

**3 tiers: Essencial, Pro, Ilimitado. Mais excedentes opcionais.**

### Tabela de tiers

| Plano               | Preço/mês (BRL) | Contratos ativos | Tomadores       | E-mails (complementar) | WhatsApp (principal)                                                                 | Score cross-account         |
| ------------------- | --------------- | ---------------- | --------------- | ---------------------- | ------------------------------------------------------------------------------------ | --------------------------- | ------------------------------- |
| **Essencial**       | R$ 79           | 30               | 50              | 500                    | Notificacoes + **comandos basicos** (`status`, `ajuda`, `parar`)                     | —                           |
| **Pro**             | R$ 199          | 200              | 500             | 3.000                  | Notificacoes + **todos os comandos** + envio ao tomador (50 msg/mes) + auto-cobranca | **Médio** (agregado)        |
| **Ilimitado**       | R$ 449          | ∞                | ∞               | 15.000                 | Notificacoes + todos os comandos + LLM + modelos custom + sob demanda via LLM        | **Premium** (nominal)       |
| Excedente Essencial | —               | R$ 1,50/contrato | R$ 0,50/tomador | R$ 0,05/e-mail         | (WhatsApp ao usuario e sempre incluso)                                               | —                           |
| Excedente Pro       | —               | R$ 1,00/contrato | —               | R$ 0,04/e-mail         | —                                                                                    | R$ 1,50/consulta agregada   |
| Excedente Ilimitado | —               | —                | —               | R$ 0,03/e-mail         | —                                                                                    | USD 5/mes hard cap para LLM | R$ 5,00/consulta bureau externa |

### Observacoes

- **Notificacoes ao usuario** via WhatsApp sao **inclusas** em todos os planos (custo Meta coberto pela margem).
- **Comandos do usuario** sao **gratis** (nao contam como mensagens Meta).
- **Envio de cobranca ao tomador** via WhatsApp nao existe — sistema gera **modelos de cobranca** que o usuario encaminha manualmente. 1 fixo no Essencial, 4 pre-definidos no Pro, custom + sob demanda via LLM no Ilimitado.
- **LLM conversacional** apenas no **Ilimitado** (Claude Sonnet/Opus), com cap de USD 5/mes e rate limit.
- **E-mail** passa a ser **complementar** (resumo diario, billing, fallback se usuario sair do WhatsApp).

### Justificativa dos números

- **PF típica** (empresta para 5–30 conhecidos): cabe no **Essencial** (R$ 79) — so recebe notificacoes, nao cobra pelo sistema.
- **PF com 30–200 contratos** (semi-profissional): **Pro** (R$ 199) comeca a cobrar pelo sistema.
- **MEI ou operação grande**: **Ilimitado** (R$ 449) com templates customizados.
- Margem no Pro (~2.5x do Essencial) absorve uso intenso.
- **WhatsApp e o grande diferenciador** — o comando `cobrar` no WhatsApp e a razão de migrar do Essencial para o Pro.

### Add-ons transversais

- **Não há** add-on de "usuário extra" (modelo single-user).
- Templates WhatsApp customizados: **só no Ilimitado**.
- Score cross-account **Médio**: Pro e Ilimitado; **Premium**: só Ilimitado (inclui 50 consultas/mês).

### Migração entre tiers

- Upgrade é imediato, proporcional ao ciclo de cobrança.
- Downgrade é ao final do ciclo vigente (sem reembolso parcial).
- Cancelamento: acesso até o fim do ciclo, depois conta suspensa.
- Após cancelamento, **dados anonimizados** mantidos para histórico de score (LGPD art. 16).

### Política de excedentes

- Aviso ao atingir 80% do limite (banner no app).
- Bloqueio soft ao atingir 100% (cobrança de excedente mediante confirmação).
- Bloqueio hard se inadimplência de excedente (com aviso prévio 7 dias).

## Consequências

**Positivas:**

- Decisão de compra simples (3 tiers, fácil de explicar).
- Margem protegida por excedentes e gating por feature.
- Upgrade orgânico conforme uso cresce.
- WhatsApp puxa upgrade (cobrança é dor real).

**Negativas:**

- Tabela ainda não calibrada com dados reais.
- Risco de subprecificação em Pro com uso intenso.
- Custo WhatsApp pode comprimir margem do Ilimitado se uso for alto.

**Mitigações:**

- Revisão trimestral com base em uso médio e custo marginal.
- Tabela de uso atual sempre visível no app (transparência).
- Meta-custo WhatsApp orçado e contingenciado.
- Planos anuais com desconto (10–15%) para lock-in.

## Revisão

Será revisitado após 90 dias em produção com dados reais de cobrança, uso e margem.

**Relacionados:**

- ADR-0019 (WhatsApp CORE)
- ADR-0021 (cross-account por nível)
