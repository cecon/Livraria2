# Feature Specification: Cadastro de Fornecedores & Lançamento de Notas de Entrada

**Feature Branch**: `003-fornecedores-lancamento-notas`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "precisamos de um cadastro e edição de fornecedores, pq a janela de lançamento de notas deveria ser uma lista com um botão novo lançamento e que possamos fazer a entrada de forma parcial, escolhe o fornecedor lançamos os itens e damos entrada"

## Contexto

Na feature 002, a entrada de mercadoria é de **um livro por vez**, com o fornecedor digitado em **texto
livre** e a entrada aplicada imediatamente. Esta feature evolui isso em duas frentes:

1. **Cadastro de fornecedores** — uma lista gerenciável de fornecedores (incluir/editar/remover), em vez de
   texto livre, para padronizar e reaproveitar.
2. **Lançamento de notas** — a tela de Entrada passa a ser uma **lista de lançamentos (notas)** com um botão
   **"Novo lançamento"**. Cada nota: escolhe-se o **fornecedor**, lançam-se **vários itens** (livro +
   quantidade + custo) e, ao final, **dá-se entrada** — o que sobe o estoque pela razão de movimentos
   (reusa o ledger e o custo médio da 002). O usuário deve poder fazer a entrada **de forma parcial**.

Esta feature **reaproveita** a razão de movimentos (`movimento_estoque`), o custo médio ponderado e a regra
de custo total↔unitário já existentes na feature 002 — não os redefine.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar e editar fornecedores (Priority: P1)

A pessoa responsável mantém uma lista de fornecedores (editoras, distribuidoras, doadores) para selecioná-los
ao lançar uma nota, em vez de redigitar o nome toda vez.

**Why this priority**: É pré-requisito para o lançamento por fornecedor e elimina divergências de nome
("Editora X" vs "editora x"). Sozinha já entrega valor: uma base de fornecedores consultável.

**Independent Test**: Cadastrar um fornecedor com nome e contato; editá-lo; buscá-lo na lista; inativá-lo e
confirmar que ele some da seleção mas o histórico de notas que o referenciam permanece.

**Acceptance Scenarios**:

1. **Given** a tela de Fornecedores, **When** cadastro "Editora X" com telefone e CNPJ, **Then** ele aparece na lista e fica disponível para seleção em novos lançamentos.
2. **Given** um fornecedor existente, **When** altero o telefone, **Then** a alteração é salva e refletida na lista.
3. **Given** uma lista com muitos fornecedores, **When** digito parte do nome na busca, **Then** a lista filtra para os correspondentes.
4. **Given** um fornecedor já usado em notas, **When** o inativo/removo, **Then** ele deixa de aparecer para seleção, mas as notas antigas continuam mostrando o fornecedor.

---

### User Story 2 - Novo lançamento de nota com vários itens e dar entrada (Priority: P1)

Ao receber uma compra/remessa, a pessoa cria um **novo lançamento**, escolhe o **fornecedor**, adiciona os
**itens** (cada livro com quantidade e custo) e, quando confere tudo, **dá entrada** — subindo o estoque de
cada livro e atualizando o custo médio, com tudo registrado no extrato.

**Why this priority**: É o coração da feature — substitui a entrada de um livro por vez por uma nota
multi-item por fornecedor, que é como a livraria realmente recebe mercadoria.

**Independent Test**: Criar um lançamento para "Editora X", adicionar 3 livros (com quantidades e custos),
dar entrada e verificar que o estoque dos 3 subiu, que o custo médio foi recalculado e que existe um
movimento de entrada por item referenciando a nota.

**Acceptance Scenarios**:

1. **Given** um novo lançamento, **When** escolho o fornecedor e adiciono um livro (busca por código/título) com quantidade 10 e custo, **Then** o item aparece na nota com seu subtotal.
2. **Given** uma nota com 3 itens, **When** dou entrada, **Then** o estoque de cada livro sobe pela quantidade lançada, o custo médio de cada um é recalculado e é criado um movimento de entrada por item vinculado à nota.
3. **Given** uma nota em edição, **When** removo um item antes de dar entrada, **Then** ele sai da nota e o total é recalculado, sem afetar estoque.
4. **Given** um item, **When** informo o custo total da linha em vez do unitário (ou vice-versa), **Then** o sistema deriva o outro (regra da feature 002).
5. **Given** uma nota sem fornecedor ou sem itens, **When** tento dar entrada, **Then** o sistema impede e explica o que falta.

---

### User Story 3 - Lista de lançamentos com "Novo lançamento" (Priority: P1)

A tela de Entrada deixa de ser um formulário solto e passa a ser uma **lista das notas lançadas**
(histórico), com um botão **"Novo lançamento"** e a possibilidade de abrir uma nota para consultar ou
continuar.

**Why this priority**: É a forma pedida de organizar o trabalho — ver o que já foi lançado, retomar
rascunhos e iniciar uma nova nota.

**Independent Test**: Após lançar duas notas, abrir a tela e ver as duas na lista (fornecedor, data, status,
total, nº de itens); clicar em "Novo lançamento" abre uma nota em branco; clicar numa nota finalizada mostra
seus itens.

**Acceptance Scenarios**:

1. **Given** a tela de Entrada, **When** abro, **Then** vejo a lista de lançamentos com fornecedor, data, status, total e quantidade de itens, mais o botão "Novo lançamento".
2. **Given** a lista, **When** clico em "Novo lançamento", **Then** abre uma nota em branco para escolher fornecedor e lançar itens.
3. **Given** uma nota finalizada na lista, **When** a abro, **Then** vejo seus itens e valores (somente leitura).

---

### User Story 4 - Entrada parcial (Priority: P2)

O usuário deve poder fazer a entrada **de forma parcial** — não precisa concluir tudo de uma vez.

[NEEDS CLARIFICATION: "entrada parcial" significa (A) **rascunho retomável** — salvar a nota incompleta e
continuar/dar entrada depois, lançando tudo de uma vez quando finalizar; ou (B) **recebimento parcial** —
dar entrada de parte dos itens/quantidades agora (estoque sobe só do recebido) e o restante fica pendente na
mesma nota para receber depois, em mais de uma entrada?]

**Why this priority**: Conforto operacional; o fluxo principal (US2/US3) funciona sem isso, mas o usuário
pediu explicitamente. Detalhar após a clarificação.

**Independent Test**: A definir conforme a interpretação escolhida (rascunho retomável vs. recebimento parcial).

---

### Edge Cases

- **Dar entrada duas vezes na mesma nota**: uma nota finalizada não pode gerar movimentos novamente (idempotente); a ação fica indisponível após finalizada.
- **Fornecedor inativado com rascunho aberto**: a nota mantém o fornecedor já escolhido; novas notas não o listam.
- **Item repetido na nota** (mesmo livro duas vezes): o sistema soma as quantidades ou impede duplicar (a definir na regra de item).
- **Quantidade ou custo inválido** (≤ 0): impedido por item, com mensagem.
- **Remover/editar nota finalizada**: bloqueado (preserva o histórico e a reconciliação); correções de estoque vão por Ajuste/Inventário (feature 002).
- **Migração**: os fornecedores em texto livre já usados nas entradas da 002 devem aparecer como fornecedores cadastrados (sem perder o histórico).

## Requirements *(mandatory)*

### Functional Requirements

#### Fornecedores (US1)

- **FR-001**: Usuários MUST poder cadastrar um fornecedor com **nome** (obrigatório) e campos opcionais: documento (CNPJ/CPF), telefone, e-mail e observações.
- **FR-002**: Usuários MUST poder **editar** e **inativar/remover** (soft-delete) um fornecedor, preservando as notas que já o referenciam.
- **FR-003**: O sistema MUST exibir uma **lista de fornecedores** com **busca** por nome.
- **FR-004**: O sistema MUST impedir cadastrar fornecedor sem nome e MUST evitar duplicidade óbvia de nome (mesmo nome normalizado).
- **FR-005**: Ao adotar a feature, o sistema MUST **popular** a lista de fornecedores a partir dos nomes de fornecedor já usados nas entradas da feature 002 (idempotente), para não perder o que já existe.

#### Lançamento de notas (US2, US3)

- **FR-010**: A tela de Entrada MUST ser uma **lista de lançamentos (notas)** com um botão **"Novo lançamento"**.
- **FR-011**: A lista MUST exibir, por nota: fornecedor, data, status, total (centavos) e quantidade de itens; e MUST permitir abrir uma nota.
- **FR-012**: Um lançamento MUST referenciar um **fornecedor** (obrigatório, selecionado da lista de cadastrados) e MAY registrar número da nota e data.
- **FR-013**: Usuários MUST poder **adicionar itens** ao lançamento — cada item é um **livro** (localizado por código de barras/código ou busca por título/autor) com **quantidade** (> 0) e **custo**.
- **FR-014**: O item MUST aceitar o custo **total** OU **unitário**, derivando o outro (regra da feature 002); e MUST permitir **remover** itens enquanto a nota não estiver finalizada.
- **FR-015**: Ao **dar entrada**, o sistema MUST, para cada item, **aumentar o estoque** do livro pela quantidade e **recalcular o custo médio**, gerando um **movimento de entrada** por item **vinculado à nota** (reusa a razão de movimentos da 002).
- **FR-016**: O sistema MUST impedir dar entrada de uma nota **sem fornecedor** ou **sem itens**, explicando o motivo.
- **FR-017**: Uma nota **finalizada** MUST ser **imutável** (não edita, não exclui, não dá entrada de novo); o lançamento é **idempotente** (dar entrada não pode aplicar o estoque duas vezes).
- **FR-018**: O sistema MUST permitir **abrir/consultar** uma nota finalizada em modo somente leitura (itens e valores).

#### Entrada parcial (US4)

- **FR-020**: O sistema MUST suportar **entrada parcial** conforme [NEEDS CLARIFICATION: rascunho retomável vs. recebimento parcial — ver US4]. Os requisitos detalhados desta seção dependem dessa decisão.

#### Localização e consistência

- **FR-030**: Todos os valores monetários (custo) MUST ser tratados em **centavos (inteiro)** e exibidos em pt-BR.
- **FR-031**: A feature MUST preservar a invariante de estoque da 002 (`soma dos movimentos = estoque exibido`); o estoque continua mudando **apenas por movimentos**.

### Key Entities *(include if feature involves data)*

- **Fornecedor**: origem de uma compra. Atributos: identificador, nome (único normalizado), documento (CNPJ/CPF) opcional, telefone, e-mail, observações, ativo/inativo. Referenciado por lançamentos.
- **LançamentoEntrada (Nota)**: uma nota de entrada. Atributos: identificador, fornecedor (referência), número da nota (opcional), data, status (`rascunho` | `finalizada`), data de finalização. Agrega itens. Ao finalizar, gera os movimentos de entrada.
- **ItemLançamento**: uma linha da nota. Atributos: lançamento (referência), livro (referência), quantidade (> 0), custo unitário (centavos). O custo total da linha é derivado.
- **MovimentoEstoque** (existente, feature 002): a entrada de cada item gera um movimento `entrada` cuja referência aponta para a nota; fonte da verdade do estoque.
- **Livro** (existente): tem o estoque e o custo médio atualizados ao dar entrada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das entradas de estoque feitas por nota geram movimento de entrada rastreável vinculado à nota; a soma dos movimentos de um livro continua igual ao estoque exibido.
- **SC-002**: Lançar uma nota com 5 itens e dar entrada é concluído em menos de 2 minutos.
- **SC-003**: Selecionar um fornecedor já cadastrado num novo lançamento leva menos de 10 segundos (busca + seleção).
- **SC-004**: 0 entradas com fornecedor digitado errado/divergente após a adoção (todas vêm da lista de fornecedores).
- **SC-005**: 100% das notas finalizadas ficam consultáveis na lista com fornecedor, data, total e itens.
- **SC-006**: Nenhuma nota finalizada consegue aplicar estoque em duplicidade (idempotência verificável).

## Assumptions

- **Reuso da feature 002**: razão de movimentos, custo médio ponderado e regra custo total↔unitário são reaproveitados; esta feature não os reimplementa.
- **Fornecedor**: nome é a identidade de exibição; documento/telefone/e-mail são opcionais (livraria de igreja, cadastro leve). Sem integração fiscal/NF-e nesta versão.
- **Substituição da Entrada da 002**: a tela de "Entrada de mercadoria" (um livro por vez) é substituída pela lista de lançamentos por nota; a entrada de um único livro vira uma nota de um item.
- **Migração de fornecedores**: a lista inicial é semeada a partir dos textos de fornecedor distintos já gravados nos movimentos de entrada da 002 (idempotente).
- **Imutabilidade**: correções após finalizar a nota são feitas por Ajuste/Inventário (002), não editando a nota.
- **Plataforma e localização**: app desktop offline, pt-BR, dinheiro em centavos, arquitetura Hexagonal e limite de 300 linhas por arquivo (constituição).

## Dependencies

- Baseia-se na feature **002-estoque-movimentos-inventario** (razão de movimentos, entrada com custo médio, busca de livro por código/título). Esta feature formaliza o fornecedor e agrupa entradas em notas multi-item.
