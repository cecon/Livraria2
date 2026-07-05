# Feature Specification: Destinação de estoque para doações (contabilidade de fundos)

**Feature Branch**: `006-destinacao-doacoes`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "A livraria é filantrópica e recebe doações de livros com destino definido do valor das vendas (ex.: autor doa 220 cópias, 10 para cobrir custos e 210 para Missões; ou doação 'metade Missões, metade Construção do Espaço'). Precisamos rastrear para onde vai o valor de cada venda e apurar por período (ex.: R$ 1.500 Espaço, R$ 100 Missões)."

## Clarifications

### Session 2026-07-04

- Q: Quando uma venda de um período já fechado é cancelada depois, como o relatório trata isso? → A: Retroativo — a venda cancelada desaparece do período original (relatório sempre reflete o estado atual); e o cancelamento de venda passa a ser **bloqueado após 5 dias** da venda, protegendo fechamentos antigos.
- Q: Deve existir uma visão global da posição atual dos carimbos (quanto ainda resta por destinação, somando todos os livros)? → A: Sim, como seção "Posição atual" na própria tela do relatório por destinação (total de unidades carimbadas por destinação; sem drill-down por livro nesta feature).
- Q: O rateio percentual da nota de doação precisa somar 100%? → A: **Não haverá nota de doação.** A entrada de doações usa o lançamento de entrada normal já existente (custo digitado pelo responsável, ex.: R$ 0,00); a destinação é definida **depois**, pela transferência de destinação ("Destinar estoque"). Rateio percentual, doador e cancelamento especial saem do escopo.

## Visão geral

A livraria recebe doações de livros cujo valor de venda tem **destino definido pelo doador** (ex.: Missões, Construção do Espaço). O sistema passa a "carimbar" quantidades com uma destinação e, a cada venda, registra de qual destinação cada unidade saiu — permitindo apurar por período quanto foi arrecadado para cada destino, batendo com o caixa.

O fluxo é em dois passos, reusando o que já existe:

1. **Entrada normal** (lançamento de nota atual, sem mudança alguma): os livros doados entram como qualquer entrada, com o custo que o responsável digitar (ex.: R$ 0,00 para doação).
2. **Destinar estoque** (novo): o responsável abre o livro e transfere quantidades do saldo livre para as destinações — "220 entraram: 10 para Loja, 210 para Missões".

Princípios centrais do modelo:

- **O estoque físico é um só**; a destinação é uma camada de carimbos por cima. **"Loja"** é a destinação padrão do sistema: tudo que não está carimbado (saldo livre) pertence a ela por definição — estoque atual e compras normais já são Loja, sem nenhuma migração de dados.
- **Carimbo tem prioridade de venda sobre o saldo livre**: a doação é um compromisso com o doador, então os exemplares carimbados vendem primeiro. Ordem de baixa na venda: carimbos na ordem do cadastro (**Loja sempre primeiro**) e, esgotados os carimbos, o saldo livre (contabilizado como Loja).
- **A própria Loja pode ser carimbada**: no exemplo dos 220 exemplares (10 para a Loja cobrir custos, 210 para Missões) com mais 1.000 livres em prateleira, vendem primeiro os 10 da Loja, depois os 210 de Missões, e então a vida segue no livre — que volta a contar como Loja.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Definir destino de estoque (Priority: P1)

Depois de dar entrada nos livros pelo lançamento normal (ou para estoque que já estava em prateleira), o responsável abre o livro, vê os saldos por destinação (livre + carimbos) e **transfere quantidades** entre eles — "mover 210 de Livre para Missões", "mover 10 de Livre para Loja" — sem mexer no estoque físico e sem lançar nota. O mesmo mecanismo corrige enganos (mover de volta para Livre, ou entre destinações).

**Why this priority**: é a porta de entrada de todo o resto — sem carimbar, não há o que apurar. É o único mecanismo de criação de carimbos do sistema.

**Independent Test**: Com um livro de estoque 80 todo livre, transferir 50 para Missões e conferir: estoque físico continua 80, livre 30, Missões 50; transferir 10 de Missões de volta para Livre e conferir 40/40; tentar transferir 100 de Livre (só há 40) é bloqueado.

**Acceptance Scenarios**:

1. **Given** um livro com 80 unidades livres, **When** o responsável transfere 50 de Livre para Missões, **Then** o estoque físico permanece 80, o saldo livre cai para 30 e o carimbo de Missões passa a 50.
2. **Given** um carimbo de Missões com 50 unidades, **When** o responsável transfere 10 de Missões para Espaço (ou de volta para Livre), **Then** os saldos refletem a mudança e o físico não se altera.
3. **Given** um saldo de origem insuficiente (livre 30), **When** o responsável tenta transferir 100, **Then** o sistema bloqueia com mensagem clara indicando o disponível.
4. **Given** qualquer transferência concluída, **When** o responsável consulta o histórico do livro, **Then** vê o registro da transferência (de → para, quantidade, motivo opcional, data).
5. **Given** uma destinação desativada, **When** o responsável abre a transferência, **Then** ela não aparece como destino de novas transferências (mas aparece como origem, se tiver saldo).
6. **Given** uma doação de 220 exemplares recém-entrada pelo lançamento normal (custo R$ 0,00), **When** o responsável transfere 10 para Loja e 210 para Missões, **Then** os carimbos ficam Loja 10 / Missões 210 e essas unidades passam a vender antes do saldo livre.

---

### User Story 2 - Apurar valores por destinação no período (Priority: P2)

Ao final de um período de vendas, o responsável consulta um relatório que mostra **quanto foi arrecadado para cada destinação** (ex.: R$ 1.500,00 Espaço, R$ 100,00 Missões, R$ 830,00 Loja), calculado a partir das alocações gravadas em cada venda — não uma estimativa. A soma das destinações bate com o total vendido do período. Na mesma tela, a seção **"Posição atual"** mostra quantas unidades ainda restam carimbadas por destinação (todos os livros somados).

**Why this priority**: é o valor de negócio final — o repasse correto dos valores aos destinos prometidos aos doadores. Depende da US1 existir, mas é o que fecha o ciclo.

**Independent Test**: Com um livro que tem carimbo Loja 1 e Missões 210, vender 2 unidades por R$ 50,00 cada e conferir no relatório do dia: R$ 50,00 em Loja e R$ 50,00 em Missões; no detalhe da venda, o item exibe a distribuição (1 un. Loja, 1 un. Missões); a posição atual mostra Missões 209.

**Acceptance Scenarios**:

1. **Given** vendas no período com itens de livros carimbados e não carimbados, **When** o responsável abre o relatório por destinação com um intervalo de datas, **Then** vê o valor arrecadado por destinação e o total, e a soma das destinações é igual ao total vendido no período.
2. **Given** a tela do relatório aberta, **When** o responsável olha a seção "Posição atual", **Then** vê o total de unidades ainda carimbadas por destinação (todos os livros somados), refletindo transferências, vendas e perdas até o momento.
3. **Given** um livro com carimbo Loja 1 e carimbo Missões 210, **When** uma venda de 2 unidades é concluída, **Then** 1 unidade é alocada à Loja e 1 a Missões (carimbos na ordem, Loja primeiro), sem qualquer passo extra no PDV (o carrinho continua mostrando uma linha só do item).
4. **Given** uma venda concluída, **When** o responsável abre o detalhe da venda, **Then** cada item mostra de quais destinações as unidades saíram e com que valores.
5. **Given** uma venda que consumiu 1 unidade de Missões, **When** essa venda é cancelada/estornada dentro de 5 dias, **Then** a unidade volta exatamente para o carimbo de Missões e a venda some do relatório do período original (efeito retroativo).
6. **Given** o valor de um item vendido, **When** a alocação é gravada, **Then** o valor apontado por destinação é o valor efetivamente cobrado das unidades (proporcional à quantidade alocada), não o preço de tabela.

---

### User Story 3 - Gerenciar o cadastro de destinações (Priority: P3)

O responsável acessa um **cadastro de destinações** e pode criar, renomear, reordenar e desativar destinações. A ordem da lista define a ordem de baixa dos carimbos na venda. "Loja" é destinação de sistema: fixa no topo, não pode ser excluída, desativada nem reordenada.

**Why this priority**: sem ele a US1 não tem destinos para escolher, mas o essencial (criar com nome) é simples; a gestão completa (renomear, reordenar, desativar) amplia sem bloquear o valor inicial.

**Independent Test**: Criar "Missões" e "Espaço", trocar a ordem entre elas, desativar "Espaço" e confirmar que: a ordem de baixa segue o cadastro; destinação desativada não aparece para novas transferências, mas seus saldos carimbados continuam sendo consumidos e aparecendo no relatório.

**Acceptance Scenarios**:

1. **Given** o cadastro aberto, **When** o responsável cria a destinação "Missões", **Then** ela passa a estar disponível como destino de transferências.
2. **Given** duas destinações com nomes conflitantes (comparação insensível a caixa e acentos, espaços das pontas ignorados), **When** o responsável tenta criar/renomear para um nome já ativo, **Then** o sistema bloqueia com mensagem clara.
3. **Given** destinações "Missões" e "Espaço" nessa ordem, **When** o responsável inverte a ordem, **Then** a próxima venda com carimbos dos dois consome primeiro "Espaço" (após o carimbo Loja, se houver; o saldo livre fica por último).
4. **Given** uma destinação com saldo carimbado maior que zero ou já usada em alocação/transferência, **When** o responsável tenta excluí-la, **Then** o sistema bloqueia e oferece desativar; **When** ela nunca foi usada e não tem saldo, **Then** a exclusão é permitida.
5. **Given** uma destinação desativada com saldo carimbado, **When** vendas consomem esse saldo, **Then** a baixa e o relatório funcionam normalmente (desativar só esconde de novas transferências).
6. **Given** o cadastro, **When** o responsável tenta excluir, desativar ou reordenar "Loja", **Then** o sistema não permite (é o padrão do sistema e âncora da ordem de baixa).

---

### User Story 4 - Caixa livre e confirmação de venda no PDV (Priority: P3)

No PDV, quando não há nenhum item na venda, a área de itens exibe um estado claro de **"Caixa livre"** (em vez de uma lista vazia), indicando que o caixa está pronto para a próxima venda. Ao concluir o recebimento de uma venda, uma **confirmação animada** (com total e troco) sinaliza visivelmente que a venda terminou; o PDV volta sozinho ao estado de caixa livre, pronto para a próxima — sem que o operador precise de nenhum clique a mais.

**Why this priority**: hoje o fim de uma venda e o início da próxima não têm marcação visual — num balcão com fila, o operador precisa de certeza imediata de que a venda fechou. É polimento de UX independente do restante da feature (só interface, nenhuma regra nova).

**Independent Test**: Abrir o PDV sem itens e ver o estado "Caixa livre"; adicionar um item (estado some); concluir o pagamento e ver a confirmação animada com total/troco; em seguida o PDV está vazio novamente em "Caixa livre" — e bipar um livro durante a animação já inicia a próxima venda normalmente.

**Acceptance Scenarios**:

1. **Given** o PDV aberto sem nenhum item, **When** o operador olha a área de itens, **Then** vê o informe de "Caixa livre" (não uma tabela vazia).
2. **Given** o estado de caixa livre, **When** o operador bipa/adiciona um item, **Then** o informe some e a venda em montagem aparece normalmente.
3. **Given** uma venda com pagamento completo, **When** o operador conclui o recebimento, **Then** uma confirmação animada exibe total e troco, a venda é limpa e o PDV volta ao estado de caixa livre.
4. **Given** a confirmação animada em exibição, **When** o operador bipa um item para a próxima venda, **Then** a animação é dispensada imediatamente e o item entra na nova venda (a confirmação nunca bloqueia a operação).
5. **Given** a confirmação animada em exibição sem nenhuma ação do operador, **When** alguns segundos se passam, **Then** ela se dispensa sozinha, permanecendo o caixa livre.

---

### Edge Cases

- **Venda maior que os carimbos**: percorre os carimbos na ordem do cadastro (Loja primeiro) e termina no saldo livre; um mesmo item de venda pode gerar alocações em várias destinações.
- **Perda/acerto negativo de inventário**: ordem **inversa** à da venda — consome primeiro o saldo livre e só depois os carimbos (na ordem do cadastro), protegendo o compromisso com o doador até onde possível; acerto positivo entra como saldo livre (Loja).
- **Cancelamento de lançamento de entrada** cujas unidades já foram carimbadas: o estorno físico consome os saldos na mesma ordem das perdas (livre primeiro, depois carimbos) — o invariante "carimbos ≤ físico" nunca quebra e nenhum guard extra é necessário.
- **Estorno de venda**: devolve cada unidade ao carimbo de onde saiu (registrado na alocação); nunca "inventa" saldo livre para unidades carimbadas. Só é permitido até 5 dias após a venda (FR-011); depois disso, bloqueado com mensagem clara.
- **Carimbo nunca excede o físico**: carimbos só nascem por transferência, limitada ao saldo de origem; toda saída física baixa as duas camadas na mesma operação.
- **Transferir para destinação desativada**: bloqueado como destino; permitido como origem (drenar saldo remanescente).

## Requirements *(mandatory)*

### Functional Requirements

**Cadastro de destinações**

- **FR-001**: O sistema MUST oferecer um cadastro de destinações com criar, renomear, reordenar, ativar/desativar; a posição na lista define a ordem de baixa dos carimbos nas saídas de estoque.
- **FR-002**: "Loja" MUST existir como destinação de sistema (padrão): sempre primeira na ordem de baixa, não excluível, não desativável e não reordenável; pode ser renomeada.
- **FR-003**: Nomes de destinações ativas MUST ser únicos com comparação insensível a caixa e acentos, ignorando espaços das pontas (mesma regra do cadastro de formas de pagamento).
- **FR-004**: Destinação MUST poder ser excluída apenas se nunca foi usada (sem saldo carimbado, sem alocação em venda e sem transferência); caso contrário o sistema MUST bloquear e oferecer desativação.
- **FR-005**: Destinação desativada MUST sumir das opções de novas transferências, mas seus saldos carimbados MUST continuar sendo consumidos nas saídas e apurados nos relatórios.

**Destinar estoque (transferência de destinação)**

- **FR-006**: O sistema MUST permitir transferir quantidades de um livro entre o saldo livre e qualquer carimbo (inclusive Loja), ou entre carimbos, sem alterar o estoque físico, bloqueando quando a origem não tem saldo suficiente.
- **FR-007**: Toda transferência MUST ficar registrada (livro, origem, destino, quantidade, motivo opcional, data) e consultável no livro, e MUST contar como "uso" da destinação para fins do bloqueio de exclusão (FR-004).

**Baixa e alocação nas saídas**

- **FR-008**: Ao concluir uma venda, cada unidade vendida MUST ser baixada primeiro dos carimbos na ordem do cadastro (Loja sempre primeiro) e, esgotados os carimbos, do saldo livre (contabilizado como Loja) — sem qualquer interação adicional do operador no PDV.
- **FR-009**: O sistema MUST gravar, por item de venda, a alocação resultante (destinação, quantidade e valor efetivamente cobrado proporcional), permitindo que um item tenha alocações em múltiplas destinações.
- **FR-010**: O estorno/cancelamento de venda MUST devolver cada unidade à destinação registrada na alocação original; o efeito no relatório é retroativo (a venda cancelada some do período original).
- **FR-011**: O cancelamento de venda MUST ser bloqueado (com mensagem clara) quando a venda tiver mais de **5 dias corridos** — protege fechamentos e repasses já realizados.
- **FR-012**: Perdas, acertos negativos de inventário e estornos de lançamento de entrada MUST consumir os saldos na ordem **inversa** à da venda — saldo livre primeiro e só depois os carimbos (na ordem do cadastro), protegendo os compromissos com doadores; acertos positivos MUST entrar como saldo livre.
- **FR-013**: O detalhe da venda MUST exibir a distribuição das unidades de cada item por destinação; o carrinho do PDV MUST permanecer com uma linha por item (sem explodir linhas).

**Estados visuais do PDV**

- **FR-014**: Quando a venda não tem itens, a área de itens do PDV MUST exibir um informe de "Caixa livre" no lugar da lista vazia, removido ao adicionar o primeiro item.
- **FR-015**: Ao concluir o recebimento, o PDV MUST exibir uma confirmação animada com total e troco e voltar ao estado de caixa livre; a confirmação MUST se dispensar sozinha após alguns segundos e MUST ser dispensada imediatamente por qualquer interação que inicie a próxima venda (nunca bloqueia nem adiciona cliques ao fluxo).

**Apuração**

- **FR-016**: O sistema MUST oferecer um relatório por intervalo de datas com o valor arrecadado por destinação, calculado exclusivamente a partir das alocações gravadas nas vendas (não estimado a partir de saldos).
- **FR-017**: No relatório, a soma dos valores por destinação MUST ser igual ao total vendido do período (considerando o efeito retroativo dos estornos).
- **FR-018**: A tela do relatório por destinação MUST exibir também uma seção "Posição atual": total de unidades carimbadas por destinação (somando todos os livros), independente do intervalo de datas — sem drill-down por livro nesta feature.

### Key Entities

- **Destinação**: destino do valor das vendas (ex.: Loja, Missões, Espaço). Atributos: nome, ativo, posição na ordem de baixa, marcador de sistema (Loja).
- **Saldo carimbado**: quantidade de um livro reservada a uma destinação, **com prioridade de venda sobre o saldo livre**; a própria Loja pode ter carimbo (lotes doados para cobrir custos). O saldo livre (físico menos carimbos) pertence à Loja por definição. Carimbos nascem exclusivamente por transferência.
- **Transferência de destinação**: remanejamento de quantidades de um livro entre destinações (incluindo o saldo livre), sem efeito no estoque físico; registro auditável com motivo opcional. É o único mecanismo de criação de carimbos.
- **Alocação de venda**: registro, por item de venda, de quantas unidades saíram de qual destinação e com que valor; fonte única do relatório e do estorno.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar uma doação de 220 exemplares (entrada pelo lançamento normal + destinação 10 Loja / 210 Missões) leva menos de 3 minutos no total.
- **SC-002**: O fluxo do operador no PDV não ganha nenhum passo, campo ou clique adicional — 100% das vendas fecham exatamente como hoje.
- **SC-003**: O relatório por destinação de qualquer período fecha com diferença zero em relação ao total vendido do período.
- **SC-004**: Estornos (de venda dentro da janela de 5 dias e de lançamentos) restauram estoque e carimbos a estados consistentes com diferença zero (Σ carimbos ≤ físico sempre).
- **SC-005**: 100% das unidades vendidas de livros carimbados têm alocação registrada com destinação e valor, consultável no detalhe da venda.
- **SC-006**: Definir o destino de estoque (uma transferência) leva menos de 30 segundos a partir da busca do livro, sem lançar nota nem alterar o estoque físico.
- **SC-007**: O operador identifica de relance (sem ler texto pequeno) se o caixa está livre ou com venda em andamento, e a próxima venda pode começar imediatamente após a conclusão da anterior — zero cliques entre uma venda e outra.

## Assumptions

- **A entrada de doações usa o lançamento normal existente**, sem alteração: o custo é o que o responsável digitar (ex.: R$ 0,00 para doação — puxando o custo médio para baixo, decisão do responsável, não regra do sistema). Não há tipo de nota, doador nem rateio.
- O valor apontado por destinação é o **valor efetivamente cobrado** das unidades na venda (proporcional à quantidade alocada), não o preço de tabela.
- Escopo offline / mono-estação mantido: cadastro e apuração locais, sem sincronização externa.
- O sistema nasce apenas com a destinação "Loja" (padrão); as demais são criadas pelo responsável conforme a necessidade.
- Vendas anteriores à feature não têm alocação retroativa: o relatório aponta todo o período anterior como Loja (coerente com o modelo de resíduo).
- A janela de 5 dias do cancelamento de venda vale para qualquer venda (com ou sem carimbo), em dias corridos contados da data da venda.
