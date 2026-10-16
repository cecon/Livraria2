# Feature Specification: Ajustar estoque a partir do cadastro do livro

**Feature Branch**: `014-ajuste-estoque-cadastro`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Ao entrar na tela de cadastro de produto quero que tenha um botao para ajustar o estoque, assim como existe no pdv"

## Contexto

Hoje o ajuste avulso de estoque (quantidade ± com motivo) só existe no **detalhe da Pesquisa** do
escritório — herdado da Pesquisa do PDV, que desde a feature 012 é apenas consulta (ADR-0024). Na tela
**Alterar livro** do Cadastro, o campo "Estoque atual" aparece como "—" e bloqueado, e não há como
corrigir o saldo dali: o usuário precisa sair do cadastro, ir à Pesquisa, achar o livro de novo e só
então ajustar. Esta feature traz o mesmo ajuste para dentro do cadastro do livro.

## Clarifications

### Session 2026-10-16

- Q: Um ajuste que deixaria o estoque negativo deve ser permitido? → A: **Bloquear** — o ajuste é
  recusado se o saldo resultante ficar abaixo de zero; a regra vale para o Cadastro **e** a Pesquisa
  (uma regra só). (FR-012)
- Q: Onde o botão "Ajustar estoque" aparece no Cadastro? → A: **Só na tela "Alterar livro"**, junto
  ao "Estoque atual"; a lista do Cadastro não ganha ação de ajuste. (FR-002)
- Q: Como o motivo do ajuste é informado? → A: **Texto livre** obrigatório, igual à Pesquisa hoje;
  sem lista de motivos padrão. (FR-003)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ajustar o estoque ao alterar um livro (Priority: P1)

Ao abrir um livro existente no Cadastro (tela "Alterar livro"), o usuário do escritório vê o estoque
atual do livro e um botão **"Ajustar estoque"**. Ao clicar, informa a quantidade (positiva para
entrada, negativa para saída) e o motivo, e aplica. O estoque atual exibido passa a refletir o ajuste
sem sair da tela.

**Why this priority**: é o pedido inteiro — elimina a ida à Pesquisa só para corrigir o saldo, no
momento em que o usuário já está olhando para o livro.

**Independent Test**: abrir um livro com estoque 5 no Cadastro, ajustar −2 com motivo "quebra" e
verificar que a tela passa a mostrar 3, que a Pesquisa e a lista do Cadastro também mostram 3 e que o
extrato do livro registra o ajuste com o motivo.

**Acceptance Scenarios**:

1. **Given** um livro cadastrado com estoque 5, **When** o usuário abre "Alterar livro", **Then** o
   campo "Estoque atual" mostra **5** (não "—") e o botão "Ajustar estoque" está visível.
2. **Given** a tela "Alterar livro" aberta, **When** o usuário clica em "Ajustar estoque", informa
   **−2** e o motivo **"quebra"** e aplica, **Then** recebe a confirmação "Estoque ajustado" e o
   "Estoque atual" passa a mostrar **3** sem sair da tela.
3. **Given** o ajuste aplicado, **When** o usuário volta à lista do Cadastro ou consulta o livro na
   Pesquisa, **Then** ambos mostram o estoque **3** e o extrato do livro lista o ajuste de −2 com o
   motivo "quebra".
4. **Given** o formulário de ajuste aberto, **When** o usuário clica em "Cancelar", **Then** nada é
   registrado e o estoque continua o mesmo.

---

### User Story 2 - Não perder edições do cadastro ao ajustar (Priority: P2)

O usuário pode ter alterado título, preço ou outros campos do livro e, antes de salvar, ajustar o
estoque. O ajuste não pode descartar nem salvar implicitamente essas edições.

**Why this priority**: sem isso, o botão novo vira armadilha — o usuário perde o que digitou ou
salva algo sem querer.

**Independent Test**: alterar o preço no formulário sem salvar, aplicar um ajuste de +1 e verificar
que o preço digitado continua no campo e que o livro ainda tem o preço antigo até clicar em "Alterar".

**Acceptance Scenarios**:

1. **Given** o preço foi editado mas não salvo, **When** o usuário aplica um ajuste de estoque,
   **Then** o preço editado continua no formulário e **não** é gravado até o usuário clicar em
   "Alterar".
2. **Given** um ajuste aplicado, **When** o usuário clica em "Cancelar" o formulário do livro,
   **Then** as edições de cadastro são descartadas, mas o ajuste de estoque **permanece** registrado
   (o ajuste é uma operação independente, já confirmada).

---

### Edge Cases

- **Livro novo**: na tela "Novo livro" não há botão de ajuste — o saldo inicial continua sendo
  informado no campo "Estoque inicial" (ADR-0017).
- **Quantidade inválida**: zero, vazia ou não numérica → o ajuste é recusado com "Informe a quantidade
  (ex.: -2 ou 3)" e nada é registrado.
- **Motivo vazio** (ou só espaços) → recusado com "Motivo é obrigatório".
- **Ajuste que deixa o estoque negativo** (ex.: estoque 1, ajuste −3): é **recusado** com uma
  mensagem que informa o estoque atual (ex.: "O estoque ficaria negativo (atual: 1)"); nada é
  registrado e o formulário de ajuste continua aberto com os valores digitados. Zerar o estoque
  (ajuste −1 com estoque 1) é permitido.
- **Falha de conexão ou de permissão na nuvem**: o ajuste não é registrado, a mensagem de erro é
  exibida, o formulário de ajuste continua aberto com os valores digitados e o estoque exibido não
  muda.
- **Clique duplo em "Aplicar"**: um único ajuste é registrado.
- **Venda no PDV durante a edição**: o estoque exibido após o ajuste reflete o saldo atual da nuvem
  (incluindo vendas já sincronizadas), não um valor calculado só na tela.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A tela "Alterar livro" do Cadastro MUST exibir o **estoque atual** do livro (o mesmo
  saldo oficial mostrado na lista do Cadastro e na Pesquisa), em vez de "—".
- **FR-002**: A tela "Alterar livro" MUST oferecer o botão **"Ajustar estoque"** junto ao "Estoque
  atual"; a tela "Novo livro" e a **lista** do Cadastro MUST NOT oferecê-lo.
- **FR-003**: O ajuste MUST pedir **quantidade com sinal** (inteiro diferente de zero) e **motivo**
  obrigatório em **texto livre** (sem lista de motivos padrão), com as mesmas validações e mensagens
  do ajuste da Pesquisa.
- **FR-004**: O ajuste aplicado MUST ser registrado como **movimento de ajuste** do livro, com a
  quantidade, o motivo, a origem (escritório), o usuário que o fez e o momento — idêntico ao ajuste
  feito pela Pesquisa (uma única regra de ajuste, DRY).
- **FR-005**: Após um ajuste bem-sucedido, o estoque atual exibido na tela MUST ser atualizado a
  partir do saldo oficial, sem sair da tela "Alterar livro".
- **FR-006**: Aplicar um ajuste MUST NOT salvar nem descartar as edições pendentes dos demais campos
  do livro.
- **FR-007**: Um ajuste já aplicado MUST permanecer registrado mesmo que o usuário cancele a edição do
  livro.
- **FR-008**: Em caso de erro ao registrar, o sistema MUST exibir a mensagem, manter o formulário de
  ajuste aberto com os valores digitados e não alterar o estoque exibido.
- **FR-009**: Enquanto um ajuste está sendo registrado, o sistema MUST impedir um segundo envio do
  mesmo ajuste.
- **FR-010**: O ajuste a partir do Cadastro MUST estar disponível para os mesmos usuários que hoje
  podem ajustar pela Pesquisa — não cria nem amplia permissão.
- **FR-011**: O ajuste pela Pesquisa MUST continuar funcionando como hoje, exceto pela nova
  checagem de saldo negativo (FR-012).
- **FR-012**: O sistema MUST recusar todo ajuste cujo saldo resultante (saldo oficial atual +
  quantidade) fique **abaixo de zero**, no Cadastro e na Pesquisa, informando o estoque atual.
  Resultado igual a zero é aceito.

### Key Entities

- **Livro**: item do catálogo (código de barras, título, preço etc.) cujo estoque é ajustado.
- **Movimento de estoque (ajuste)**: registro do razão de estoque (ADR-0008) com quantidade ±, motivo,
  origem, autor e momento; é ele que altera o saldo.
- **Saldo oficial**: estoque do livro calculado na nuvem a partir dos movimentos (ADR-0023), exibido
  na lista do Cadastro, na Pesquisa e agora na tela "Alterar livro".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário corrige o estoque de um livro que está alterando em **até 3 interações**
  (clicar em "Ajustar estoque", preencher quantidade e motivo, aplicar), sem sair da tela do livro.
- **SC-002**: Em 100% dos ajustes feitos pelo Cadastro, o novo saldo aparece igual na tela do livro,
  na lista do Cadastro e na Pesquisa logo após a confirmação.
- **SC-003**: Em 100% dos ajustes, as edições não salvas do formulário do livro permanecem intactas.
- **SC-004**: 100% dos ajustes feitos pelo Cadastro aparecem no extrato do livro com quantidade,
  motivo e autor, indistinguíveis de um ajuste feito pela Pesquisa (exceto pelo momento).

## Assumptions

- "Tela de cadastro de produto" é o **Cadastro de livros do escritório** (web/nuvem), na tela
  **"Alterar livro"**; "assim como existe no PDV" refere-se ao botão "Ajustar estoque" do detalhe da
  Pesquisa, que reproduz o ajuste que o PDV tinha antes de virar consumidor (ADR-0024). O PDV
  **não** ganha ajuste de estoque — a retaguarda continua na nuvem (constituição v2.1.0).
- A única mudança de regra de negócio é a recusa de saldo negativo (FR-012); no mais, o ajuste é o
  mesmo já existente (mesma validação, mesmo movimento, mesmo cálculo de saldo).
- O ajuste exige conexão com a nuvem, como toda função de retaguarda do escritório.
- Um botão de ajuste direto na **lista** do Cadastro (por linha) está fora do escopo (decidido na
  clarificação); o ajuste fica na tela do livro.
