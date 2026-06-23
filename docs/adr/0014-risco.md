# ADR-0014: Motor de risco — política padrão

- **Status:** Refinado por ADR-0022
- **Data original:** 2026-06-20
- **Última atualização:** 2026-06-20

## Contexto

Seção 17 do plano define motor de risco híbrido, mas não fixa score/faixas/semáforo. Defaults precisam ser calibrados e justificados. O modelo single-user muda o cenário: a **política é por contrato**, não global, e o **usuário decide** se usa a sugestão (opt-in com alerta de segurança).

## Decisão

**Política de risco padrão (editável por contrato):**

- **Score:** 0–1000.
- **Faixas:**
  - **Verde** (baixo risco): 700–1000.
  - **Amarelo** (atenção): 450–699.
  - **Vermelho** (alto risco): 0–449.
- **Travas:**
  - `soft_block` (recomendação forte): permite override com justificativa opcional.
  - `hard_block` (bloqueio lógico): alerta explícito + exige justificativa ≥ 20 caracteres.
- **Override:**
  - Sempre auditável.
  - Justificativa opcional no v1 para `soft_block`, **obrigatória para `hard_block` desde o v1**.
  - Schema do banco já prevê campo `justification` para evitar migration futura.
- **Escopo:** política por **contrato** (cada contrato pode ter versão própria da política).
- **Aplicação:** sempre sugestão visível; usuário opt-in; **alerta automático em vermelho de alto risco**.
- **Reforço positivo:** "esse CPF já pagou X contratos em dia na nossa base" aparece em todos os níveis.
- **Critérios iniciais cobertos:** todos os 12 da seção 17.2 (atraso recorrente, pagamento abaixo, só juros, padrão small-then-big, pedido alto sem histórico, relacionamento curto + ticket alto, inadimplência anterior, qtd. contratos, vínculos cross-account, rede de indicação, relação suspeita, transferência de confiança, exposição crescente, pedido vs caixa, extensibilidade).

## Consequências

**Positivas:**

- Score com range 0–1000 é conhecido (FICO-style).
- Faixas bem espaçadas evitam ambiguidade.
- `hard_block` com justificativa desde o v1 já atende governança futura sem refactor.
- Política por contrato respeita contexto (credor pode ser conservador com um amigo, agressivo com outro).
- Reforço positivo incentiva bom comportamento na rede.

**Negativas:**

- Calibração inicial sem dados reais — esperado.
- Risco de "alerta ignorado" pelo usuário.
- Complexidade de UX (explicar semáforo, fatores, decisão sem sobrecarregar).

**Mitigação:**

- Calibração via telemetria após 90 dias em produção.
- Modo `simulation` (`FUTURO`) para "what-if" antes de ativar nova política.
- Trilha de override audita decisões de alto risco.
- UI simples: semáforo + 1 frase + botão de detalhes.

**Refinamentos posteriores:** ver ADR-0022 (análise por contrato completa).
