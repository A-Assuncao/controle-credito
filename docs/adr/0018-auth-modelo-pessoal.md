# ADR-0018: Modelo de autenticação single-user

- **Status:** Aceito
- **Data:** 2026-06-20
- **Substitui/Refina:** ADR-0005 (auth) parcialmente

## Contexto

O modelo de uso do produto é **1 usuário por conta** (pessoa física credora, ou MEI no caso de borda). O usuário é dono absoluto da própria conta — não há papéis, não há RBAC granular, não há convite de outros usuários. Essa decisão tem implicações em auth, sessão, MFA e recuperação.

## Decisão

**Single-user por conta, single-session ativa, MFA opcional, recuperação por duplo fator (e-mail + celular).**

### Auth

- Login por **e-mail + senha**.
- Senha mínima 12 caracteres, score zxcvbn ≥ 3.
- Sessão única: ao autenticar em novo dispositivo, a sessão anterior é **revogada automaticamente**.
- TTL de sessão: **12 horas** desde a última atividade (refresh renova).
- Logout manual encerra a sessão.

### MFA

- **Opcional**, com **banner recomendando ativar** no primeiro login.
- Quando ativado: TOTP (Authenticator/Google Authenticator/Authy).
- O usuário pode ativar/desativar a qualquer momento na área de configurações.
- Para PREMIUM nível Premium (nominal), MFA passa a ser **obrigatório** no momento do upgrade.

### Recuperação de senha

- Duplo fator: o usuário confirma primeiro por **e-mail** (link) e depois por **celular** (código SMS).
- Celular deve estar previamente cadastrado e validado.
- Sem acesso a ambos, recuperação requer **contato com suporte via formulário** (com validação manual).

### Cadastro

- E-mail + senha + celular + nome completo.
- Confirmação por e-mail + celular antes de ativar a conta.
- Termo de uso e política de privacidade com aceite explícito.

## Consequências

**Positivas:**

- Modelo simples, sem complexidade de RBAC.
- Risco de vazamento por compartilhamento de credencial é de responsabilidade do usuário.
- Single-session reduz superfície de ataque (não há tokens de longa duração em múltiplos dispositivos).
- Recuperação dupla (e-mail + celular) é mais segura que só e-mail.

**Negativas:**

- Usuário em viagem que perde celular fica sem conta até falar com suporte.
- Single-session pode frustrar quem alterna entre celular e PC.
- SMS pode ser interceptado (SIM swap); mitigamos exigindo também o e-mail.

**Mitigações:**

- Backup de códigos TOTP no app (após ativar MFA).
- Tela de "esqueci celular" com fluxo guiado para suporte.
- Limite de tentativas de recuperação (5/dia).
- Alerta ao usuário sempre que nova sessão é iniciada em outro dispositivo.

**Permissões:**

Não há RBAC. O usuário tem **todas** as permissões sobre os próprios dados. Permissões sensíveis são flags lógicas no código (gate por plano), aplicadas pelo backend (fonte da verdade), nunca pelo cliente.
