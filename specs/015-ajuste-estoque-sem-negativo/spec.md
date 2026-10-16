# Feature Specification: Ajuste manual de estoque sem saldo negativo

**Feature Branch**: `015-ajuste-estoque-sem-negativo`
**Created**: 2026-10-16
**Status**: Draft
**Input**: Portar para a arquitetura atual (API NestJS + retaguarda Able Pro) o que faltou da antiga
014 (`014-ajuste-estoque-cadastro`, feita sobre a arquitetura anterior e nunca publicada): bloquear
saldo negativo no ajuste manual, aceitar só quantidade inteira exata e impedir envio duplo.

## Contexto

O botão "Ajustar estoque" já existe no cadastro do livro e na Pesquisa (PR #69, em produção). Hoje:
o ajuste aceita qualquer quantidade negativa, mesmo deixando o saldo abaixo de zero; a tela usa
`parseInt` (aceita "2,5" como 2 e "-2abc" como -2); e "Aplicar" pode ser clicado de novo enquanto o
primeiro envio está em andamento, gerando dois movimentos.

A constituição (IV) manda a nuvem registrar **toda venda**, mesmo que gere saldo negativo para
reconciliação. Por isso a recusa vale só para o **ajuste manual que reduz** o saldo.

## Clarifications

### Session 2026-10-16

- Herdado da 014: ajuste que deixaria o saldo negativo é **bloqueado**, no cadastro e na Pesquisa;
  motivo continua texto livre obrigatório.
- Decisão (constituição IV): se o saldo já estiver negativo por venda, um ajuste **positivo** é
  sempre aceito (é correção), mesmo que o saldo continue negativo. Só ajuste **negativo** cujo
  resultado fique abaixo de zero é recusado. Inventário (contagem) e vendas não mudam.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ajuste não deixa o estoque negativo (Priority: P1)

O administrador ajusta o estoque pelo cadastro do livro ou pela Pesquisa. Se o ajuste reduziria o
saldo abaixo de zero, ele é recusado com o saldo atual, e o saldo exibido é atualizado.

**Why this priority**: evita saldo impossível criado por digitação errada (ex.: −30 em vez de −3).

**Independent Test**: livro com saldo 1 → ajuste −3 recusado com "O estoque ficaria negativo (atual:
1)" e nada no extrato; ajuste −1 aceito, saldo 0.

**Acceptance Scenarios**:

1. **Given** saldo 1, **When** ajuste −3, **Then** recusa "O estoque ficaria negativo (atual: 1)",
   formulário continua aberto com os valores, nenhum movimento gravado.
2. **Given** saldo 3, **When** ajuste −3, **Then** aceito, saldo 0.
3. **Given** saldo −2 (vendas além do estoque), **When** ajuste +1, **Then** aceito, saldo −1.
4. **Given** a tela mostra saldo 3 mas uma venda já levou o saldo oficial a 1, **When** ajuste −2,
   **Then** recusa com "(atual: 1)" e o saldo exibido passa a 1.

---

### User Story 2 - Quantidade exata e um envio só (Priority: P2)

A quantidade só é aceita se for um inteiro exato com sinal opcional; enquanto o ajuste é enviado,
"Aplicar" e "Cancelar" ficam desabilitados.

**Why this priority**: evita ajuste com quantidade diferente da digitada e movimento duplicado.

**Independent Test**: "2,5" e "-2abc" são recusados sem chamar a API; clique duplo em "Aplicar" gera
um único movimento.

**Acceptance Scenarios**:

1. **Given** quantidade "2,5", "-2abc", "0" ou vazia, **When** aplicar, **Then** "Informe a
   quantidade (ex.: -2 ou 3)" e nenhuma chamada à API.
2. **Given** um envio em andamento, **When** o usuário clica "Aplicar" de novo, **Then** nada
   acontece; ao terminar, um único movimento existe.

### Edge Cases

- Reenvio do mesmo `sync_uid` (retry de rede) de um ajuste já gravado: continua idempotente e não é
  reavaliado contra o saldo.
- Livro inexistente ou excluído: continua "Produto indisponivel".
- Contagem de inventário e vendas: não passam pela regra (podem gerar saldo negativo, como hoje).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A API MUST recusar um ajuste manual com quantidade **negativa** cujo saldo oficial
  resultante fique **abaixo de zero**, com status 409 e mensagem "O estoque ficaria negativo (atual:
  N)", sem gravar movimento. Resultado zero é aceito.
- **FR-002**: Ajuste com quantidade **positiva** MUST ser aceito independentemente do saldo atual.
- **FR-003**: A checagem MUST usar o saldo oficial lido na mesma transação que grava o movimento, sob
  o lock já usado para escrita de movimentos (sem janela entre leitura e gravação).
- **FR-004**: Reenvio idempotente (mesmo `sync_uid`, mesmo conteúdo) MUST continuar sendo aceito sem
  nova checagem; contagem de inventário MUST NOT ser afetada.
- **FR-005**: A retaguarda MUST aceitar só quantidade que case com um inteiro exato com sinal
  opcional; o resto mostra "Informe a quantidade (ex.: -2 ou 3)" sem chamar a API.
- **FR-006**: A retaguarda MUST desabilitar "Aplicar" e "Cancelar" durante o envio e ignorar novos
  cliques até a resposta.
- **FR-007**: Em recusa da API, a retaguarda MUST manter o formulário aberto com os valores e
  recarregar o saldo exibido (cadastro e Pesquisa).

### Key Entities

- **Movimento de estoque (ajuste)**: `tipo='ajuste'`, quantidade com sinal, motivo, origem `nuvem`,
  autor. Sem mudança de esquema.
- **Saldo oficial**: soma dos movimentos não excluídos do livro (`vw_saldo_livro`).

## Success Criteria *(mandatory)*

- **SC-001**: 100% dos ajustes negativos que levariam o saldo abaixo de zero são recusados, com o
  saldo atual na mensagem.
- **SC-002**: 0 movimentos duplicados por clique repetido em "Aplicar".
- **SC-003**: 0 ajustes gravados com quantidade diferente da digitada.

## Assumptions

- Mantém o comportamento e o lugar do botão já publicados (PR #69); só regra e validação mudam.
- A regra fica na API (autoridade, constituição II) — sem trigger novo no banco nem migração.
- O ajuste iniciado pelo PDV (online, pela mesma API) também passa a obedecer a regra.
