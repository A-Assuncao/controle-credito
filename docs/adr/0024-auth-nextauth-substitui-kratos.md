# ADR-0024 — NextAuth.js (Auth.js) substitui Ory Kratos + Hydra na Sprint 1

- **Status:** Aceito (Sprint 1 / EXE-001, autorizado em 2026-06-21)
- **Data:** 2026-06-21
- **Decisor:** A-Assuncao (Backend Lead + Security Lead)
- **Substitui / revisa:** plano da Sprint 1 (`docs/sprint-1-plan.md`) no item "Auth via Ory Kratos + Hydra"; refina ADR-0005 e ADR-0018.

## Contexto

O plano original da Sprint 1 previa Ory Kratos + Hydra para identidade OIDC. Em revisão pré-implementação, três fatores empurraram para uma alternativa mais enxuta:

1. **Encaixe no modelo single-user.** O produto tem 1 usuário por conta (ADR-0018). Kratos + Hydra são peças desenhadas para cenários multi-tenant complexos com fluxos OIDC entre serviços — o que é superdimensionado para o caso real.
2. **Custo de manutenção.** Kratos é um sistema opinionated com templates próprios,UI de identidade, webhooks de identidade e ciclo de vida de sessão fora do controle da aplicação. Para um time de 1 pessoa, o ônus de dominar e manter essa camada é alto.
3. **LGPD / subprocessadores.** Kratos pode ser auto-hospedado, mas a alternativa hospedada (Ory Cloud) seria um subprocessor a mais no inventário — sem ganho claro de segurança para o caso de uso.
4. **Janela de implementação.** A Sprint 1 já é densa (RLS FORCE, auditoria imutável, MFA, recuperação, e2e). Substituir uma peça pesada por uma mais conhecida da stack TypeScript reduz risco de estouro de prazo.

## Decisão

Adotar **NextAuth.js v5 (Auth.js)** para autenticação na Sprint 1, com:

- **TOTP próprio** (biblioteca `otplib` + QR via `qrcode`) para MFA opcional. Sem dependência externa de TOTP.
- **Recuperação de senha** por e-mail (provider ainda não selecionado; recomendado: **Resend**) e SMS (provider ainda não selecionado; recomendado: **Twilio**). Stubs nesta sprint, providers reais quando entrar a feature de billing.
- **Sessão JWT** com chave simétrica compartilhada entre `apps/web` (que gerencia a sessão do browser) e `apps/api` (que valida o JWT a cada request). Decisão arquitetural complementar: o `apps/web` lida com o cookie httpOnly + refresh; o `apps/api` é stateless e só verifica assinatura/expiração.
- **Single-session** (revoga sessão anterior no novo login) implementado via Redis com chave `session:{user_id}` e TTL 12h.
- **MFA opcional** com banner de recomendação, conforme ADR-0018.

## Consequências

### Positivas

- Menos peça móvel: 1 lib a mais (`next-auth`) em vez de 2 serviços (Kratos + Hydra).
- Tudo em TypeScript, auditável no mesmo repositório.
- Sem novo subprocessor de identidade.
- Recuperação de senha implementável sem dependência obrigatória de SMS (e-mail só — SMS é camada extra opt-in na Sprint 2, com provider stub nesta sprint).
- `apps/web` e `apps/api` compartilham o mesmo secret JWT — verificação de sessão é só `jose.jwtVerify`, sem chamada extra a Kratos.

### Negativas

- Própria implementação da trilha de eventos de identidade (login, logout, falha de MFA). Mitigação: `AuditLoggerInterceptor` cobre isso desde a Sprint 1.
- Recuperação por SMS depende de provider externo (Twilio ou similar). Mitigação: provider é adapter; a Sprint 1 entrega a interface, a Sprint 2 liga em produção.
- NextAuth v5 ainda está em beta (Auth.js). Mitigação: pinar versão e avaliar migração quando sair GA; a API básica (`signIn`, `signOut`, `getSession`, JWT callback) é estável.

### Riscos aceitos

- Se o produto crescer para multi-user por conta (não previsto), NextAuth ainda suporta, mas com mais código de aplicação. Aceitável porque o modelo single-user é decisão de produto (ADR-0018).
- Bug de segurança no JWT (assinatura, algoritmo) é risco集中. Mitigação: usar `jose` (mantido pelo Panva), validar `alg` explicitamente, secret rotacionável, testes de sessão forjada em CI.

## Itens em aberto

- **Provider de e-mail transacional para recovery:** Resend é o candidato (simples, DX boa, preço claro). Decisão formal na Sprint 2 quando entrar billing.
- **Provider de SMS:** Twilio (caro, completo) vs MessageBird (alternativa). Decisão na Sprint 2.
- **Política de rotação de JWT secret:** TODO. Sugestão: rotação a cada 90 dias, com 2 segredos válidos simultaneamente durante a janela de transição.
- **MFA recovery codes:** não previsto no plano da Sprint 1. Avaliar entrar na Sprint 2 para reduzir suporte operacional quando o usuário perde o dispositivo TOTP.

## Notas de governança

- Esta mudança é uma **revisão de plano**, não uma decisão fora de escopo. Está documentada em `master-plan.md` (registro de entrega de 2026-06-21) e `CHANGELOG.md` (versão 0.5.0-code).
- Impacto em segurança: **positivo** (menos superfície de ataque, mesmo modelo de sessão forte).
- Impacto em LGPD: **neutro** (não há dado pessoal novo; recovery via providers ainda não está ligado em produção).
- Itens em aberto acima devem virar tarefas explícitas na Sprint 2, não ficar soltos.

## Referências

- ADR-0005 (auth — visão original)
- ADR-0018 (modelo de autenticação single-user)
- `docs/sprint-1-plan.md` (plano original, item "Auth via Ory Kratos + Hydra" substituído por esta decisão)
- [NextAuth.js v5 / Auth.js](https://authjs.dev)
- [otplib](https://www.npmjs.com/package/otplib) — TOTP/HOTP
