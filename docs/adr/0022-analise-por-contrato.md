# ADR-0022: Análise de crédito por contrato (opt-in com sugestão sempre visível)

- **Status:** Aceito
- **Data:** 2026-06-20
- **Substitui/Refina:** master-plan seção 17 (motor de risco)

## Contexto

O motor de risco precisa servir uma persona PF que **não conhece** análise de crédito formal. O sistema não pode decidir pelo usuário, mas também não pode ficar em silêncio quando há risco real. O modelo precisa equilibrar **autonomia** (PF decide) e **proteção** (alerta quando é perigoso).

## Decisão

**Análise de crédito é por contrato, com sugestão sempre visível, opt-in de uso, e alerta automático quando o resultado for claramente perigoso.**

### Fluxo

1. Usuário cria ou edita um **contrato** com tomador.
2. Sistema calcula **sempre** uma sugestão de score (motor de risco) com base em:
   - Parâmetros do contrato (valor, prazo, taxa, modalidade).
   - Histórico do tomador (na conta do usuário e na base compartilhada, conforme plano).
   - Política de risco escolhida para o contrato.
3. UI mostra a **sugestão** com semáforo, fatores explicáveis e ação recomendada.
4. Usuário **decide** se usa a análise (opt-in). Botão: "Aplicar sugestão" ou "Ignorar e prosseguir".
5. **Exceção — alerta automático**: se o score for **vermelho** E houver fatores de alto risco (e.g., pedido alto sem histórico, exposição crescente), o sistema abre um **alerta explícito** que o usuário precisa confirmar que entendeu antes de prosseguir.
6. Decisão do usuário fica registrada na trilha (override, com justificativa opcional).

### Política de risco por contrato

- Cada contrato tem `risk_policy_id` apontando para uma versão de política.
- Usuário pode escolher entre presets: **Conservador**, **Moderado**, **Agressivo**.
- Usuário pode customizar pesos/travas com sliders (variação dentro de limites seguros).
- Versão de política é **congelada no contrato** — mudanças futuras não reescrevem histórico.

### Score e semáforo

- Score 0–1000.
- **Verde** (baixo risco): 700–1000.
- **Amarelo** (atenção): 450–699.
- **Vermelho** (alto risco): 0–449.

### Reforço positivo

- Histórico positivo aparece como "esse CPF já pagou X contratos em dia na nossa base" — ajuda o credor a decidir e ajuda o tomador a construir reputação.
- Funciona em todos os níveis (Comum, Médio, Premium) — é parte da inteligência coletiva.

### Override

- Override é sempre permitido (o usuário decide).
- Override em **vermelho** exige justificativa (campo aberto, ≥20 caracteres).
- Trilha imutável: usuário, timestamp, score, fatores, decisão, justificativa.

### Versionamento

- Política de risco tem `version` e `status: draft | active | deprecated`.
- Contrato sempre referencia `(policy_id, version)`.
- Simulação "what-if" disponível em `FUTURO` para testar nova política antes de ativar.

## Consequências

**Positivas:**
- Usuário sempre tem **orientação**, mesmo sem ser obrigado a seguir.
- Sugestão visível educa o usuário sobre o que considerar.
- Alerta explícito protege contra decisões claramente perigosas.
- Política por contrato respeita o caso de uso (um PF pode ter perfil conservador com um amigo e agressivo com outro).
- Reforço positivo incentiva tomadores a pagarem em dia (rede de confiança).

**Negativas:**
- Risco de "alerta ignorado" se usuário quiser aceitar qualquer contrato.
- Custo computacional de calcular score em todo contrato novo/editado.
- Complexidade de UX: explicar semáforo, fatores e decisão sem sobrecarregar.

**Mitigações:**
- Trilha de override audita decisões de alto risco (gera sinal para revisão do motor).
- Cálculo é assíncrono (não bloqueia criação de contrato).
- UI mostra score em formato simples: "semáforo + 1 frase + botão de detalhes".
- Banner periódico para usuários que ignoram alertas frequentemente.

## Critérios iniciais (do master-plan seção 17.3)

Atraso recorrente; pagamento abaixo da parcela; padrão de pagar só juros; valor pequeno seguido de pedido grande; pedido alto sem histórico; relacionamento curto com ticket alto; inadimplência anterior; quantidade/histórico de contratos; vínculos cross-account (conforme plano); rede de indicação; relação suspeita indicante/indicado; transferência de confiança/desconfiança na rede; aumento brusco de exposição; pedido vs caixa disponível; extensibilidade para novas regras.

Todos esses critérios são **mantidos** e o motor é estruturado para inclusão/remoção sem refactor.
