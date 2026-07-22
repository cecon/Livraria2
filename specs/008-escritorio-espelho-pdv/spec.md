# Feature Specification: Escritório espelho do PDV (paridade nuvem ↔ local)

**Feature Branch**: `008-escritorio-espelho-pdv`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "vamos trabalhar em uma nova feature, preciso que a parte nuvem seja idêntica a parte local, basicamente as mesmas telas e funções, mas conectado direto no supabase, mesmo css mesmo tema, para não gerar estranhamento em que vai usar"

## Resumo

Hoje existem dois programas para a mesma livraria: o **PDV local** (roda no notebook do balcão, funciona offline, visual moderno) e o **Escritório na nuvem** (roda no navegador, lê/grava direto na base da nuvem, visual simples e diferente). Quem sabe usar um **estranha** o outro: telas diferentes, cores diferentes, funções que existem num e faltam no outro.

Esta feature faz o **Escritório na nuvem ficar idêntico ao PDV local**: as mesmas telas, os mesmos nomes, o mesmo fluxo, o mesmo tema e as mesmas cores. A diferença fica só "por baixo": o Escritório grava direto na nuvem, enquanto o PDV grava local e sincroniza. Para quem usa, os dois parecem o **mesmo sistema** — muda apenas onde ele está aberto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconhecer o sistema à primeira vista (Priority: P1)

Uma operadora que aprendeu no PDV do balcão abre o Escritório no navegador de casa e **reconhece tudo na hora**: mesma barra lateral, mesmos ícones e nomes de menu, mesmas cores, mesmos botões e tabelas. Ela não precisa reaprender nada nem perguntar "onde fica tal coisa aqui".

**Why this priority**: é o objetivo declarado ("não gerar estranhamento"). Sem paridade visual e de navegação, todo o resto perde o propósito. Entrega valor mesmo antes de qualquer nova função, só por unificar a aparência e a estrutura das telas que já existem.

**Independent Test**: colocar lado a lado o PDV e o Escritório nas telas equivalentes (Início, Cadastro, Pesquisa, Fornecedores, Relatórios…) e verificar que layout, tema, cores, tipografia, ícones, rótulos de menu e disposição dos elementos são os mesmos.

**Acceptance Scenarios**:

1. **Given** uma pessoa que só usou o PDV, **When** ela abre o Escritório, **Then** ela encontra a mesma barra lateral de navegação, com os mesmos itens, na mesma ordem e com os mesmos nomes.
2. **Given** a tela de Cadastro no PDV e no Escritório, **When** comparadas, **Then** apresentam os mesmos campos, botões, cores e comportamento visual (estados de carregando/vazio/erro incluídos).
3. **Given** o tema visual do PDV (cores, cantos, fontes), **When** aplicado ao Escritório, **Then** ambos exibem a mesma identidade — nenhuma tela "de aparência antiga".

---

### User Story 2 - Fazer o trabalho de retaguarda com as mesmas funções (Priority: P2)

A pessoa da retaguarda usa o Escritório para as tarefas do dia a dia — cadastrar/precificar livros, pesquisar estoque e vendas, lançar notas de entrada, gerir fornecedores e formas de pagamento, registrar destinações (doações) e ver relatórios — e cada função **se comporta igual à do PDV**, produzindo os mesmos resultados, só que gravando direto na nuvem.

**Why this priority**: paridade de aparência sem paridade de função ainda gera confusão ("a tela é igual mas o botão não faz o mesmo"). Cobre o conjunto de tarefas de retaguarda que fazem sentido rodar no Escritório.

**Independent Test**: executar cada tarefa de retaguarda no Escritório e conferir que o resultado (dados gravados, validações, mensagens) é equivalente ao da mesma tarefa no PDV, e que o dado aparece nas duas pontas.

**Acceptance Scenarios**:

1. **Given** um livro cadastrado/precificado no Escritório, **When** o PDV sincroniza, **Then** o livro aparece no PDV com os mesmos dados, e vice-versa.
2. **Given** uma nota de entrada lançada no Escritório, **When** concluída, **Then** o estoque e o custo refletem exatamente o que o PDV produziria para a mesma nota.
3. **Given** uma regra de negócio existente no PDV (ex.: exigir saldo inicial, limitar baixa ao estoque disponível, cálculo de custo médio), **When** a mesma operação é feita no Escritório, **Then** a mesma regra é aplicada e o mesmo resultado é obtido.
4. **Given** uma pesquisa de estoque/vendas ou um relatório, **When** aberto no Escritório e no PDV para o mesmo período, **Then** os números conferem.

---

### User Story 3 - Operações "de balcão" no Escritório: Venda e Inventário completos na nuvem (Priority: P3)

Além da retaguarda, o Escritório também oferece as telas mais operacionais do PDV — **Venda** (checkout completo) e **Inventário** (contagem física) — com o mesmo visual e fluxo, **registrando direto na nuvem**. É possível concluir uma venda pelo navegador (itens, pagamento, baixa de estoque, custo, troco) e realizar a contagem de inventário digitando/usando a câmera, sem leitor dedicado.

**Why this priority**: são as telas de maior risco/complexidade (dinheiro e estoque em tempo real, contagem física), pois replicam as regras mais sensíveis do PDV fora dele. Ficam por último porque exigem que a mesma lógica de venda/estoque/custo valha na nuvem; podem ser entregues após US1/US2 sem comprometê-las.

**Independent Test**: concluir uma venda completa no Escritório e uma contagem de inventário, e confirmar mesmo visual/fluxo do PDV e resultado consistente nas duas pontas (estoque, custo, valores e itens conferem).

**Acceptance Scenarios**:

1. **Given** um carrinho com itens e uma forma de pagamento no Escritório, **When** a venda é concluída, **Then** a venda é gravada na nuvem, o estoque é baixado e o custo/troco resultam iguais ao que o PDV produziria para a mesma venda.
2. **Given** uma baixa de venda que excederia o estoque disponível, **When** concluída no Escritório, **Then** a mesma regra do PDV é aplicada (não permite/limita), com a mesma mensagem.
3. **Given** uma contagem de inventário feita no Escritório (digitação/câmera), **When** finalizada, **Then** os itens e ajustes resultantes são gravados na nuvem e conferem com o que o PDV registraria para a mesma contagem.

---

### Edge Cases

- **Sem internet no Escritório**: como o Escritório grava direto na nuvem, sem conexão ele não opera. A pessoa deve receber um aviso claro de "sem conexão" (o PDV, por ser local, continua funcionando).
- **Edição concorrente**: o mesmo registro (ex.: preço de um livro) é alterado no Escritório e no PDV quase ao mesmo tempo — o resultado final deve seguir a mesma regra de convergência já usada na sincronização, sem perder dados silenciosamente.
- **Dado ainda não sincronizado**: um registro criado no PDV offline ainda não chegou à nuvem — o Escritório mostra apenas o que já está na nuvem, sem "inventar" o que falta.
- **Permissão insuficiente**: uma conta do Escritório sem direito a uma ação tenta executá-la — a resposta é a mesma regra de acesso vigente, com mensagem clara.
- **Valores em dinheiro**: exibição e cálculo de preços/totais/troco devem bater exatamente com o PDV (mesma precisão, sem divergência de centavos).
- **Telas que dependem de hardware** (leitor de código no Inventário): comportamento no navegador deve ter equivalente utilizável (ex.: digitação/câmera) ou estar explicitamente fora de escopo.

## Requirements *(mandatory)*

### Functional Requirements

#### Paridade visual e de navegação (US1)

- **FR-001**: O Escritório MUST usar o **mesmo tema visual** do PDV (cores, tipografia, raios de canto, espaçamentos, ícones) de forma que telas equivalentes sejam visualmente indistinguíveis.
- **FR-002**: O Escritório MUST apresentar a **mesma estrutura de navegação** do PDV (mesma barra lateral, mesmos itens de menu, mesma ordem e mesmos nomes).
- **FR-003**: O Escritório MUST reutilizar os **mesmos componentes de interface** (botões, tabelas, campos, cartões, avisos/toasts, badges de estoque) com aparência e comportamento idênticos, incluindo estados de carregando, vazio e erro.
- **FR-004**: Os **rótulos, textos e mensagens** das telas equivalentes MUST ser os mesmos entre PDV e Escritório (mesma linguagem para o usuário).

#### Paridade funcional de retaguarda (US2)

- **FR-005**: O Escritório MUST oferecer as telas de retaguarda equivalentes às do PDV: **Início, Cadastro (livros/preço), Pesquisa (estoque & vendas), Lançamentos (notas de entrada), Fornecedores, Formas de Pagamento, Destinações (doações), Relatórios**.
- **FR-006**: Cada função de retaguarda no Escritório MUST produzir o **mesmo resultado de negócio** que a função equivalente no PDV para a mesma entrada (mesmas validações, mesmas regras, mesmas mensagens).
- **FR-007**: O Escritório MUST **ler e gravar diretamente na base da nuvem**, e as alterações MUST refletir no PDV pelo mecanismo de sincronização existente (e vice-versa).
- **FR-008**: As **regras de negócio já existentes** (ex.: exigir saldo inicial antes de movimentar; limitar baixa de venda ao estoque disponível; cálculo de custo médio ponderado por ordem de entrada; dinheiro sempre em centavos) MUST valer igualmente no Escritório.
- **FR-009**: Relatórios e consultas equivalentes MUST apresentar os **mesmos números** que o PDV para o mesmo período e mesma base de dados.
- **FR-010**: O Escritório MUST exibir um **estado de conexão** claro e, quando sem conexão com a nuvem, impedir gravações e informar o usuário (em vez de falhar em silêncio).

#### Operações de balcão (US3)

- **FR-011**: O Escritório MUST incluir a tela de **Venda** com o mesmo visual/fluxo do PDV e permitir **concluir a venda direto na nuvem** (carrinho, formas de pagamento, baixa de estoque, custo e troco), produzindo o mesmo resultado de negócio que o PDV para a mesma venda.
- **FR-012**: O Escritório MUST incluir a tela de **Inventário** com o mesmo visual/fluxo do PDV e permitir **realizar a contagem física na nuvem** por digitação e/ou câmera (sem leitor dedicado), gravando itens e ajustes resultantes direto na nuvem.

#### Acesso e consistência

- **FR-013**: O Escritório MUST respeitar as **regras de acesso** vigentes (login por conta autenticada; ações não permitidas retornam mensagem clara), sem expor dados ou operações além do permitido.
- **FR-014**: Em edição concorrente do mesmo registro entre Escritório e PDV, o sistema MUST aplicar a **mesma regra de convergência** já usada na sincronização, sem perda silenciosa de dados.
- **FR-015**: O Escritório MUST manter **paridade contínua**: quando uma tela/função do PDV mudar, a equivalente no Escritório deve poder acompanhar sem retrabalho duplicado (evitar duas implementações que divergem com o tempo).

### Key Entities

As entidades são as **mesmas já existentes** no sistema (não há entidade nova nesta feature); o Escritório apenas passa a operá-las com paridade:

- **Livro**: item de catálogo com identidade, preço e custo.
- **Movimento de estoque / Saldo**: entradas, saídas, ajustes e saldo derivado por livro.
- **Nota de entrada (Lançamento) / Fornecedor**: recebimento de mercadoria e sua origem.
- **Pedido / Venda / Pagamento**: ciclo de venda e suas formas de pagamento.
- **Forma de pagamento**: cadastro usado na venda.
- **Destinação (doação)**: saída de estoque para doação e sua contabilidade de fundos.
- **Inventário**: contagem física e seus itens.
- **Operador / Conta de acesso**: quem opera; usado para atribuição e permissão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em uma comparação lado a lado das telas equivalentes, **100% dos itens de navegação** (nome, ordem, ícone) coincidem entre PDV e Escritório.
- **SC-002**: Uma pessoa treinada apenas no PDV realiza, no Escritório e **sem treinamento adicional**, as tarefas de retaguarda de US2 — meta: **90% das tarefas concluídas na primeira tentativa** em teste com usuários.
- **SC-003**: Para um conjunto de operações de retaguarda idênticas executadas nas duas pontas, **100% dos resultados de negócio conferem** (mesmos dados gravados, mesmos números em relatórios, mesma precisão de centavos).
- **SC-004**: **Zero telas** do Escritório com identidade visual divergente do tema do PDV (nenhuma tela "de aparência antiga") ao final da entrega.
- **SC-005**: Redução observável de dúvidas/erros de operação ao alternar entre os dois programas — meta: **queda de 50%** em pedidos de ajuda relacionados a "não achei/está diferente" após a adoção.
- **SC-006**: Um dado criado/alterado no Escritório aparece corretamente no PDV (e vice-versa) após a sincronização, em **100%** dos casos de teste de ida e volta.

## Assumptions

- **Base única na nuvem**: o Escritório opera sobre a **mesma base de dados da nuvem** já usada pela sincronização (feature 007); não há base separada para o Escritório.
- **Fonte da verdade por ponta**: o PDV continua **offline-first** (grava local e sincroniza); o Escritório é **online** (grava direto na nuvem). O offline do PDV permanece invariante.
- **Sem duplicar o núcleo de regras**: as regras de negócio devem ser **compartilhadas ou espelhadas** de forma que Escritório e PDV não divirjam; a decisão de *como* (regras no banco, em serviço compartilhado, etc.) é da fase de plano.
- **Identidade visual do PDV é a referência**: o tema/estilo do PDV é o padrão a ser adotado; o Escritório é que se ajusta (não o contrário).
- **Escopo é paridade, não novas funções**: esta feature não cria funcionalidades novas de negócio — replica as existentes; qualquer função nova é feature à parte.
- **Reaproveitamento das telas atuais do Escritório**: as telas que o Escritório já tem (consulta, fornecedores, livros, operadores, recebimento, relatórios) serão **realinhadas** ao visual/fluxo do PDV, não recriadas do zero quando possível.
- **Conectividade**: usuários do Escritório têm internet; a ausência dela é tratada como estado de erro visível, não como modo de operação.
- **Acesso**: o login e as regras de acesso do Escritório já existentes (contas autenticadas) permanecem; esta feature não redefine o modelo de permissões.

## Dependencies

- Depende da **sincronização com a nuvem (feature 007)** e do esquema-espelho já aplicado na base da nuvem.
- Depende do **tema/identidade visual do PDV** como referência de estilo.
- Depende das **regras de negócio já implementadas** no PDV (estoque, custo médio, venda, destinação) como especificação do comportamento a espelhar.

## Decisões de escopo (resolvidas)

1. **Venda no Escritório** (FR-011): ✅ **Checkout completo na nuvem** — registrar vendas pelo navegador direto no Supabase.
2. **Inventário no Escritório** (FR-012): ✅ **Contagem física na nuvem** — via digitação/câmera, sem leitor dedicado.

> Consequência para o plano: a paridade agora inclui as regras mais sensíveis (venda, baixa de estoque, custo médio) valendo **na nuvem**, não só no PDV. FR-006/FR-008 exigem que esse comportamento seja idêntico ao do PDV — a fase de plano decide *onde* essa lógica vive (regras no banco, serviço compartilhado, etc.) para evitar divergência entre as duas pontas.
