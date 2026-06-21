# Changelog

Todas as mudancas relevantes neste projeto sao registradas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## [Nao liberado]

### Em andamento
- **Sprint 1 / EXE-001 — Fundação conta/IAM/auditoria** (autorizada em 2026-06-21). Ver `docs/sprint-1-plan.md` e `docs/adr/0024-auth-nextauth-substitui-kratos.md`.

### Pendente
- Decisoes juridicas sobre LGPD, transferencia internacional, modulo PREMIUM e provedor LLM.
- DPIA para PREMIUM e dados fora do BR (Sprint 1.5 / 2).
- Subprocessadores formais e revisão jurídica final do modo nominal no PREMIUM.

---

## [0.5.0-code] - 2026-06-21

### Adicionado
- `AUTORIZO CODAR` recebido para Sprint 1 (EXE-001), escopo conforme `docs/sprint-1-plan.md`.
- **ADR-0024**: NextAuth v5 (Auth.js) + TOTP próprio (otplib) substitui Ory Kratos + Hydra. Justificativas: menos peça móvel, código auditável, sem subprocessor de identidade, melhor encaixe no modelo single-user, recuperação de senha por e-mail+SMS (Resend/Twilio como providers, ainda não selecionados).
- Branch `sprint/001-foundation` em criação.
- Monorepo (pnpm + Turborepo), migrations 001/002/003 com RLS FORCE, apps/api (NestJS), apps/web (Next.js + shadcn/ui) — em construção.

### Modificado
- `docs/master-plan.md`: `EXE-001` agora `EM_ANDAMENTO (código)`; novo registro de entrega em 2026-06-21; resumo de estado atualizado; nota de desvio (desktop-first, sem preview.yml/release.yml nesta sprint, OTel só console).
- `docs/sprint-1-plan.md`: ajustes pendentes para refletir os desvios (a fazer no PR da Sprint 1).

### Desvios ratificados (Sprint 1)
- **Auth:** NextAuth v5 (Auth.js) + TOTP próprio no lugar de Ory Kratos + Hydra.
- **UX:** desktop-first, mobile-friendly depois (plano original era mobile-first 375x812).
- **CI:** `preview.yml` (Neon branch + deploy efêmero) **adiado para Sprint 1.5**; `release.yml` simplificado (sem changelog automático).
- **Observabilidade:** OTel SDK plugado, OTLP endpoint comentado (apenas console em dev).
- **Compliance:** `docs/compliance/dpia-template.md` e `subprocessors.md` adiados — não há dado pessoal de domínio na Sprint 1.
- **Bootstrap:** script `bootstrap.sh` removido (YAGNI — sem novos devs onboardando).

---

## [0.4.0-docs] - 2026-06-20

### Modificado
- **ADR-0019 (WhatsApp) reescrito**: WhatsApp NUNCA fala com o tomador. Apenas com o usuario (notificacoes + comandos). Sistema gera **modelos de cobranca** (texto) que o usuario copia/encaminha manualmente.
- **master-plan §8.4**: reescrito — sem envio ao tomador, sem janela 24h Meta para tomador, sem opt-out cross-account, sem cobranca conversacional automatica.
- **master-plan §10 / ADR-0020**: tiers com nova coluna LLM. WhatsApp simplificado. Modelos de cobranca por tier (1 / 4 / custom).
- **architecture.md**: Fluxo 4 substituido (gera modelo de cobranca, nao envia); Fluxo 5 (comando estruturado) e Fluxo 6 (LLM conversacional) adicionados; Fluxo 7 (notificacao ao usuario).

### Adicionado
- **ADR-0023 (LLM conversacional)**: Anthropic Claude (Sonnet 4.6 / Opus 4.8) no plano Ilimitado, com tool use, confirmacao obrigatoria para escritas, mascaramento de PII, logs de 90 dias, rate limit e cap de custo.
- `security-model.md` §7.4: controles de LLM (escopo de tools, confirmacao, privacidade, anti-prompt-injection).
- `compliance-checklist.md` itens 20 e 21: provedor LLM e retencao de logs de conversa.

### Removido
- Envio de cobranca ao tomador via WhatsApp (substituido por geracao de modelo).
- Templates Meta aprovados para tomador.
- Webhook inbound do tomador.
- Opt-out WhatsApp do tomador (item 16a do compliance).
- Janela 24h Meta para tomador.
- Cobranca conversacional automatica.
- Auto-cobranca (job).

---

## [0.3.0-docs] - 2026-06-20

### Modificado
- **ADR-0019 (WhatsApp) reescrito**: WhatsApp passa a ser canal **principal** de notificacoes ao usuario, com **comandos** que disparam acoes (inclusive envio ao tomador). Tres direcoes: sistema -> usuario, usuario -> sistema, sistema -> tomador.
- **master-plan §8.4**: secoes reescritas com WhatsApp-first, comandos (`status`, `tomadores`, `cobrar`, `ajuda`, `parar`, `retomar`), e auto-cobranca configuravel.
- **master-plan §10 (tiers)**: coluna WhatsApp ajustada — Essencial com notificacoes + comandos basicos, Pro com todos os comandos + 50 envios/mes, Ilimitado com 200 envios + custom templates.
- **ADR-0020 (tiers)**: tabela de tiers atualizada com comandos e contagens de envio WhatsApp.
- **architecture.md**: Fluxo 5 (comando do usuario via WhatsApp) e Fluxo 6 (notificacao ao usuario) adicionados. Atores externos atualizados.
- **security-model.md**: secao 7.2 (autenticacao de comandos via WhatsApp) adicionada; rate limits atualizados (comandos 30/h, notificacoes 20/h).
- **compliance-checklist.md**: item 16a (consentimento WhatsApp do tomador) adicionado.

### Adicionado
- Verificacao obrigatoria do numero WhatsApp no cadastro do usuario.
- Confirmacao explicita para comandos destrutivos (`cobrar`, `cancelar`).
- Opt-out granular por categoria de notificacao.
- Limite de 1 auto-cobranca por tomador por dia (anti-spam).
- Reativacao de notificacoes pausadas via `parar` so pelo app (anti-clonagem).

---

## [0.2.0-docs] - 2026-06-20

### Adicionado
- **ADRs 0018-0022** com refinamentos do modelo single-user:
  - ADR-0018: autenticacao single-user (single-session, MFA opcional, recuperacao e-mail+celular).
  - ADR-0019: WhatsApp como canal CORE V1 (Meta oficial).
  - ADR-0020: tiering para pessoa fisica (Essencial/Pro/Ilimitado).
  - ADR-0021: analise de credito cross-account por niveis (Comum/Medio/Premium).
  - ADR-0022: analise de credito por contrato (sugestao sempre visivel, opt-in).
- `docs/architecture.md` com novo fluxo critico 4 (cobranca via WhatsApp).
- `docs/security-model.md` ajustado para modelo single-user (sem RBAC).
- `docs/compliance-checklist.md` com 19 itens (anonimizacao preservada, opt-out WhatsApp, consentimento do tomador).
- `docs/sprint-1-plan.md` ajustado (sem `user_roles`, MFA opcional, recovery dupla).

### Modificado
- `master-plan.md`: secao 6 (sem RBAC), secao 8.4 (WhatsApp CORE), secao 10 (tiers PF), secao 17 (analise por contrato), secao 18 (3 niveis cross-account), roadmap F3 (WhatsApp), quadro EXE-001.
- `ADR-0005` (auth) marcado como refinado por ADR-0018.
- `ADR-0014` (risco) marcado como refinado por ADR-0022.
- `ADR-0016` (tiering) deprecado e substituido por ADR-0020.

### Deprecado
- `ADR-0016` (tiering enterprise): modelo multi-user nao se aplica ao publico PF.

---

## [0.2.0-docs] - 2026-06-20

### Adicionado
- **ADRs 0018-0022** com refinamentos do modelo single-user:
  - ADR-0018: autenticacao single-user (single-session, MFA opcional, recuperacao e-mail+celular).
  - ADR-0019: WhatsApp como canal CORE V1 (Meta oficial).
  - ADR-0020: tiering para pessoa fisica (Essencial/Pro/Ilimitado).
  - ADR-0021: analise de credito cross-account por niveis (Comum/Medio/Premium).
  - ADR-0022: analise de credito por contrato (sugestao sempre visivel, opt-in).
- `docs/architecture.md` com novo fluxo critico 4 (cobranca via WhatsApp).
- `docs/security-model.md` ajustado para modelo single-user (sem RBAC).
- `docs/compliance-checklist.md` com 19 itens (anonimizacao preservada, opt-out WhatsApp, consentimento do tomador).
- `docs/sprint-1-plan.md` ajustado (sem `user_roles`, MFA opcional, recovery dupla).

### Modificado
- `master-plan.md`: secao 6 (sem RBAC), secao 8.4 (WhatsApp CORE), secao 10 (tiers PF), secao 17 (analise por contrato), secao 18 (3 niveis cross-account), roadmap F3 (WhatsApp), quadro EXE-001.
- `ADR-0005` (auth) marcado como refinado por ADR-0018.
- `ADR-0014` (risco) marcado como refinado por ADR-0022.
- `ADR-0016` (tiering) deprecado e substituido por ADR-0020.

### Deprecado
- `ADR-0016` (tiering enterprise): modelo multi-user nao se aplica ao publico PF.

---

## [0.1.0-docs] - 2026-06-20

### Adicionado
- `docs/master-plan.md` v1.2 — plano mestre consolidado, fonte de verdade.
- Quadro de execucao `EXE-001` a `EXE-007` com status e responsavel.
- Regras persistentes minimas do projeto (12 itens).
- Protocolo de governanca de documentacao.
- ADRs 0001-0017 com decisoes iniciais de stack, seguranca, financeiro, monetizacao e operacao.
- `docs/architecture.md` (visao C4 + fluxos).
- `docs/security-model.md` (modelo inicial com RBAC).
- `docs/financial-engine.md` (motor financeiro).
- `docs/compliance-checklist.md` (17 itens iniciais).
- `docs/sprint-1-plan.md` (plano inicial com RBAC).
- `docs/runbooks/identity-outage.md`, `docs/runbooks/db-failover.md`.
- README raiz, CHANGELOG.

---

**Convencao de versao enquanto pre-implementacao:**
- `0.x.y` — docs e configuracao nao-producao.
- `0.x.y-code` — primeiro codigo autorizado.
- `1.0.0` — go-live do `CORE V1`.
