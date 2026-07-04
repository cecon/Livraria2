# Feature Specification: Destinação de estoque para doações (contabilidade de fundos)

**Feature Branch**: `006-destinacao-doacoes`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "A livraria é filantrópica e recebe doações de livros com destino definido do valor das vendas (ex.: autor doa 220 cópias, 10 para cobrir custos e 210 para Missões; ou doação 'metade Missões, metade Construção do Espaço'). Precisamos rastrear para onde vai o valor de cada venda e apurar por período (ex.: R$ 1.500 Espaço, R$ 100 Missões). Cadastro de destinações com ordem de baixa; 'Custos' é o resíduo (não carimbado); entrada de doação com rateio por item; baixa automática na venda gravando a alocação; perdas de inventário protegem os carimbos; relatório por período calculado a partir das alocações gravadas."

## Visão geral

A livraria recebe doações de livros cujo valor de venda tem **destino definido pelo doador** (ex.: Missões, Construção do Espaço). O sistema passa a "carimbar" quantidades doadas com uma destinação e, a cada venda, registra de qual destinação cada unidade saiu — permitindo apurar por período quanto foi arrecadado para cada destino, batendo com o caixa.

Princípios centrais do modelo:

- **O estoque físico é um só**; a destinação é uma camada de carimbos por cima. **"Loja"** é a destinação padrão do sistema: tudo que não está carimbado (saldo livre) pertence a ela por definição — estoque atual e compras normais já são Loja, sem nenhuma migração de dados.
- **Carimbo tem prioridade de venda sobre o saldo livre**: a doação é um compromisso com o doador, então os exemplares carimbados vendem primeiro. Ordem de baixa na venda: carimbos na ordem do cadastro (**Loja sempre primeiro**) e, esgotados os carimbos, o saldo livre (contabilizado como Loja).
- **A própria Loja pode ser carimbada**: no exemplo dos 220 exemplares (10 para a Loja cobrir custos, 210 para Missões) com mais 1.000 livres em prateleira, vendem primeiro os 10 da Loja, depois os 210 de Missões, e então a vida segue no livre — que volta a contar como Loja.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dar entrada em doação com destinação (Priority: P1)

O responsável recebe uma doação de livros e lança uma **nota de doação** (novo tipo de nota, ao lado da nota de compra atual): informa opcionalmente o doador, escolhe a destinação padrão da nota (um destino, ou rateio percentual como 50% Missões / 50% Espaço) e bipa os itens. Cada item herda o padrão da nota, e quando necessário o responsável divide as quantidades do item entre destinações (ex.: 10 Loja, 210 Missões). Ao dar entrada, o estoque sobe (como hoje) e **toda a quantidade doada ganha carimbo** — inclusive a parte da Loja — o que dá à doação prioridade de venda sobre o saldo livre.

**Why this priority**: É a porta de entrada de todo o resto — sem registrar o destino na chegada dos livros, não há o que apurar. É o motivo direto do pedido.

**Independent Test**: Lançar uma nota de doação com um item de 220 unidades rateado 10 Loja / 210 Missões, dar entrada e conferir que o estoque físico subiu 220 e que os carimbos do livro são Loja 10 e Missões 210 (o saldo livre pré-existente não muda).

**Acceptance Scenarios**:

1. **Given** a tela de lançamentos, **When** o responsável cria uma nova nota, **Then** pode escolher o tipo **Compra** (fluxo atual, inalterado) ou **Doação**.
2. **Given** uma nota de doação com destinação padrão "Missões", **When** o responsável adiciona um item de 40 unidades sem mexer no rateio, **Then** o item entra com as 40 unidades carimbadas para Missões.
3. **Given** um item de 220 unidades numa nota de doação, **When** o responsável divide em 10 Loja e 210 Missões, **Then** o sistema aceita; **When** a soma do rateio difere de 220, **Then** o sistema impede a finalização apontando a diferença.
4. **Given** uma nota de doação com rateio padrão 50% Missões / 50% Espaço, **When** o responsável adiciona um item de 41 unidades, **Then** as quantidades são divididas automaticamente (sobra de arredondamento vai para a primeira destinação do rateio) e o responsável pode ajustar manualmente no item.
5. **Given** uma nota de doação finalizada, **When** o responsável a cancela e nenhuma unidade carimbada foi vendida ainda, **Then** o estoque e os carimbos são estornados juntos; **When** alguma unidade carimbada da nota já foi consumida, **Then** o cancelamento é bloqueado com mensagem clara.
6. **Given** uma doação finalizada, **When** o custo médio do livro é consultado, **Then** as unidades doadas entraram a custo zero (puxando o custo médio para baixo).

---

### User Story 2 - Apurar valores por destinação no período (Priority: P2)

Ao final de um período de vendas, o responsável consulta um relatório que mostra **quanto foi arrecadado para cada destinação** (ex.: R$ 1.500,00 Espaço, R$ 100,00 Missões, R$ 830,00 Loja), calculado a partir das alocações gravadas em cada venda — não uma estimativa. A soma das destinações bate com o total vendido do período.

**Why this priority**: É o valor de negócio final — o repasse correto dos valores aos destinos prometidos aos doadores. Depende da US1 existir, mas é o que fecha o ciclo.

**Independent Test**: Com um livro que tem carimbo Loja 1 e Missões 210, vender 2 unidades por R$ 50,00 cada e conferir no relatório do dia: R$ 50,00 em Loja e R$ 50,00 em Missões; no detalhe da venda, o item exibe a distribuição (1 un. Loja, 1 un. Missões).

**Acceptance Scenarios**:

1. **Given** vendas no período com itens de livros carimbados e não carimbados, **When** o responsável abre o relatório por destinação com um intervalo de datas, **Then** vê o valor arrecadado por destinação e o total, e a soma das destinações é igual ao total vendido no período.
2. **Given** um livro com carimbo Loja 1 e carimbo Missões 210, **When** uma venda de 2 unidades é concluída, **Then** 1 unidade é alocada à Loja e 1 a Missões (carimbos na ordem, Loja primeiro), sem qualquer passo extra no PDV (o carrinho continua mostrando uma linha só do item).
3. **Given** uma venda concluída, **When** o responsável abre o detalhe da venda, **Then** cada item mostra de quais destinações as unidades saíram e com que valores.
4. **Given** uma venda que consumiu 1 unidade de Missões, **When** essa venda é cancelada/estornada, **Then** a unidade volta exatamente para o carimbo de Missões (e o relatório do período reflete o estorno).
5. **Given** o valor de um item vendido, **When** a alocação é gravada, **Then** o valor apontado por destinação é o valor efetivamente cobrado das unidades (proporcional à quantidade alocada), não o preço de tabela.

---

### User Story 3 - Gerenciar o cadastro de destinações (Priority: P3)

O responsável acessa um **cadastro de destinações** e pode criar, renomear, reordenar e desativar destinações. A ordem da lista define a ordem de baixa dos carimbos na venda. "Loja" é destinação de sistema: fixa no topo, não pode ser excluída, desativada nem reordenada.

**Why this priority**: Sem ele a US1 não tem destinos para escolher, mas o essencial (criar com nome) é simples; a gestão completa (renomear, reordenar, desativar) amplia sem bloquear o valor inicial.

**Independent Test**: Criar "Missões" e "Espaço", trocar a ordem entre elas, desativar "Espaço" e confirmar que: a ordem de baixa segue o cadastro; destinação desativada não aparece para novas doações, mas seus saldos carimbados continuam sendo consumidos e aparecendo no relatório.

**Acceptance Scenarios**:

1. **Given** o cadastro aberto, **When** o responsável cria a destinação "Missões", **Then** ela passa a estar disponível como destino em notas de doação.
2. **Given** duas destinações com nomes conflitantes (comparação insensível a caixa e acentos, espaços das pontas ignorados), **When** o responsável tenta criar/renomear para um nome já ativo, **Then** o sistema bloqueia com mensagem clara.
3. **Given** destinações "Missões" e "Espaço" nessa ordem, **When** o responsável inverte a ordem, **Then** a próxima venda com carimbos dos dois consome primeiro "Espaço" (após o carimbo Loja, se houver; o saldo livre fica por último).
4. **Given** uma destinação com saldo carimbado maior que zero ou já usada em alguma alocação, **When** o responsável tenta excluí-la, **Then** o sistema bloqueia e oferece desativar; **When** ela nunca foi usada e não tem saldo, **Then** a exclusão é permitida.
5. **Given** uma destinação desativada com saldo carimbado, **When** vendas consomem esse saldo, **Then** a baixa e o relatório funcionam normalmente (desativar só esconde de novas doações).
6. **Given** o cadastro, **When** o responsável tenta excluir, desativar ou reordenar "Loja", **Then** o sistema não permite (é o padrão do sistema e âncora da ordem de baixa).

---

### User Story 4 - Definir destino de estoque já existente (Priority: P2)

Nem toda destinação chega junto com livros novos: às vezes o livro **já está no estoque** e o responsável só precisa definir (ou corrigir) o destino de parte dele — ex.: o doador avisa depois que 50 exemplares já em prateleira devem ir para Missões, ou um lote entrou por engano sem destinação. O responsável abre o livro, vê os saldos por destinação (livre + carimbos) e **transfere quantidades** entre eles ("mover 50 de Livre para Missões"), sem mexer no estoque físico e sem lançar nota.

**Why this priority**: cobre o caso real de destinação a posteriori e é também o mecanismo de correção de erros (mover de volta para Livre, ou entre destinações) — sem ele, qualquer engano exigiria cancelar e relançar notas.

**Independent Test**: Com um livro de estoque 80 todo livre, transferir 50 para Missões e conferir: estoque físico continua 80, livre 30, Missões 50; transferir 10 de Missões de volta para Livre e conferir 40/40; tentar transferir 100 de Livre (só há 30) é bloqueado.

**Acceptance Scenarios**:

1. **Given** um livro com 80 unidades livres, **When** o responsável transfere 50 de Livre para Missões, **Then** o estoque físico permanece 80, o saldo livre cai para 30 e o carimbo de Missões passa a 50.
2. **Given** um carimbo de Missões com 50 unidades, **When** o responsável transfere 10 de Missões para Espaço (ou de volta para Livre), **Then** os saldos refletem a mudança e o físico não se altera.
3. **Given** um saldo de origem insuficiente (livre 30), **When** o responsável tenta transferir 100, **Then** o sistema bloqueia com mensagem clara indicando o disponível.
4. **Given** qualquer transferência concluída, **When** o responsável consulta o histórico do livro, **Then** vê o registro da transferência (de → para, quantidade, motivo opcional, data).
5. **Given** uma destinação desativada, **When** o responsável abre a transferência, **Then** ela não aparece como destino de novas transferências (mas aparece como origem, se tiver saldo).

---

### User Story 5 - Caixa livre e confirmação de venda no PDV (Priority: P3)

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
- **Estorno de venda**: devolve cada unidade ao carimbo de onde saiu (registrado na alocação); nunca "inventa" saldo livre para unidades carimbadas.
- **Cancelamento de nota de doação**: só permitido enquanto os carimbos criados pela nota estão íntegros (nenhuma unidade consumida); caso contrário, bloqueado com mensagem clara.
- **Rateio percentual com sobra de arredondamento**: unidades restantes vão para a primeira destinação do rateio; o responsável pode ajustar manualmente por item antes de finalizar.
- **Carimbo nunca excede o físico**: toda saída baixa as duas camadas (física e carimbo) na mesma operação, e carimbos só nascem limitados ao disponível (doação cria junto com a entrada física; transferência exige saldo de origem) — o total carimbado de um livro nunca ultrapassa seu estoque físico.
- **Doação toda para a Loja** (sem destinação especial): a nota é aceita com destinação padrão "Loja" — entra a custo zero e gera carimbo Loja, dando aos exemplares doados prioridade de venda sobre o saldo livre.
- **Lote que entrou sem destinação** (ex.: como compra, ou doação lançada sem rateio): o destino se corrige com uma transferência de Livre → destinação (US4), sem cancelar a nota; se o **custo** também estiver errado (era doação e entrou com custo), aí sim cancela-se e relança-se a nota.

## Requirements *(mandatory)*

### Functional Requirements

**Cadastro de destinações**

- **FR-001**: O sistema MUST oferecer um cadastro de destinações com criar, renomear, reordenar, ativar/desativar; a posição na lista define a ordem de baixa nas saídas de estoque.
- **FR-002**: "Loja" MUST existir como destinação de sistema (padrão): sempre primeira na ordem de baixa, não excluível, não desativável e não reordenável; pode ser renomeada.
- **FR-003**: Nomes de destinações ativas MUST ser únicos com comparação insensível a caixa e acentos, ignorando espaços das pontas (mesma regra do cadastro de formas de pagamento).
- **FR-004**: Destinação MUST poder ser excluída apenas se nunca foi usada (sem saldo carimbado e sem alocação em venda); caso contrário o sistema MUST bloquear e oferecer desativação.
- **FR-005**: Destinação desativada MUST sumir das opções de novas doações, mas seus saldos carimbados MUST continuar sendo consumidos nas saídas e apurados nos relatórios.

**Entrada por doação**

- **FR-006**: A tela de lançamentos MUST permitir criar nota do tipo **Doação**, além do tipo **Compra** atual (que permanece inalterado).
- **FR-007**: A nota de doação MUST aceitar um doador opcional (texto livre) e uma destinação padrão: um único destino ou um rateio percentual entre destinos ativos.
- **FR-008**: Cada item da nota de doação MUST herdar a destinação padrão e MUST permitir rateio manual por quantidades exatas entre destinações; a soma do rateio MUST ser igual à quantidade do item para finalizar.
- **FR-009**: Ao finalizar a nota de doação, o sistema MUST registrar a entrada no razão de movimentos de estoque a **custo zero** e gravar os saldos carimbados por livro × destinação para **toda** a quantidade rateada — inclusive a parte destinada à Loja (o carimbo é o que dá prioridade de venda à doação).
- **FR-010**: O cancelamento de nota de doação MUST estornar juntos o estoque e os carimbos, e MUST ser bloqueado (com mensagem clara) se qualquer unidade carimbada criada pela nota já tiver sido consumida.

**Baixa e alocação nas saídas**

- **FR-011**: Ao concluir uma venda, cada unidade vendida MUST ser baixada primeiro dos carimbos na ordem do cadastro (Loja sempre primeiro) e, esgotados os carimbos, do saldo livre (contabilizado como Loja) — sem qualquer interação adicional do operador no PDV.
- **FR-012**: O sistema MUST gravar, por item de venda, a alocação resultante (destinação, quantidade e valor efetivamente cobrado proporcional), permitindo que um item tenha alocações em múltiplas destinações.
- **FR-013**: O estorno/cancelamento de venda MUST devolver cada unidade à destinação registrada na alocação original.
- **FR-014**: Perdas e acertos negativos de inventário MUST consumir os saldos na ordem **inversa** à da venda — saldo livre primeiro e só depois os carimbos (na ordem do cadastro), protegendo os compromissos com doadores; acertos positivos MUST entrar como saldo livre.
- **FR-015**: O detalhe da venda MUST exibir a distribuição das unidades de cada item por destinação; o carrinho do PDV MUST permanecer com uma linha por item (sem explodir linhas).

**Destinação de estoque existente**

- **FR-015a**: O sistema MUST permitir transferir quantidades de um livro entre o saldo livre e qualquer carimbo (inclusive Loja), ou entre carimbos, sem alterar o estoque físico, bloqueando quando a origem não tem saldo suficiente.
- **FR-015b**: Toda transferência MUST ficar registrada (livro, origem, destino, quantidade, motivo opcional, data) e consultável, e MUST contar como "uso" da destinação para fins do bloqueio de exclusão (FR-004).

**Estados visuais do PDV**

- **FR-015c**: Quando a venda não tem itens, a área de itens do PDV MUST exibir um informe de "Caixa livre" no lugar da lista vazia, removido ao adicionar o primeiro item.
- **FR-015d**: Ao concluir o recebimento, o PDV MUST exibir uma confirmação animada com total e troco e voltar ao estado de caixa livre; a confirmação MUST se dispensar sozinha após alguns segundos e MUST ser dispensada imediatamente por qualquer interação que inicie a próxima venda (nunca bloqueia nem adiciona cliques ao fluxo).

**Apuração**

- **FR-016**: O sistema MUST oferecer um relatório por intervalo de datas com o valor arrecadado por destinação, calculado exclusivamente a partir das alocações gravadas nas vendas (não estimado a partir de saldos).
- **FR-017**: No relatório, a soma dos valores por destinação MUST ser igual ao total vendido do período (considerando estornos).

### Key Entities

- **Destinação**: destino do valor das vendas (ex.: Loja, Missões, Espaço). Atributos: nome, ativo, posição na ordem de baixa, marcador de sistema (Loja).
- **Nota de doação**: lançamento de entrada sem custo, com doador opcional e destinação padrão (destino único ou rateio percentual); contém itens com rateio por destinação.
- **Rateio de item**: divisão da quantidade de um item da nota entre destinações (quantidades exatas cuja soma é a quantidade do item).
- **Saldo carimbado**: quantidade de um livro reservada a uma destinação, **com prioridade de venda sobre o saldo livre**; a própria Loja pode ter carimbo (lotes doados para cobrir custos). O saldo livre (físico menos carimbos) pertence à Loja por definição.
- **Alocação de venda**: registro, por item de venda, de quantas unidades saíram de qual destinação e com que valor; fonte única do relatório e do estorno.
- **Transferência de destinação**: remanejamento de quantidades de um livro entre destinações (incluindo o saldo livre), sem efeito no estoque físico; registro auditável com motivo opcional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O responsável lança uma doação de 220 exemplares com rateio (10 Loja / 210 Missões) em menos de 2 minutos, sem sair da tela de lançamentos.
- **SC-002**: O fluxo do operador no PDV não ganha nenhum passo, campo ou clique adicional — 100% das vendas fecham exatamente como hoje.
- **SC-003**: O relatório por destinação de qualquer período fecha com diferença zero em relação ao total vendido do período.
- **SC-004**: Estornos (de venda e de nota de doação íntegra) restauram estoque e carimbos ao estado anterior com diferença zero.
- **SC-005**: 100% das unidades vendidas de livros carimbados têm alocação registrada com destinação e valor, consultável no detalhe da venda.
- **SC-006**: Definir o destino de estoque já existente (uma transferência) leva menos de 30 segundos a partir da busca do livro, sem lançar nota nem alterar o estoque físico.
- **SC-007**: O operador identifica de relance (sem ler texto pequeno) se o caixa está livre ou com venda em andamento, e a próxima venda pode começar imediatamente após a conclusão da anterior — zero cliques entre uma venda e outra.

## Assumptions

- O valor apontado por destinação é o **valor efetivamente cobrado** das unidades na venda (proporcional à quantidade alocada), não o preço de tabela.
- Doações entram a **custo zero** no razão, puxando o custo médio ponderado do livro para baixo — comportamento aceito e desejado (o custo real de aquisição foi zero).
- A sobra de arredondamento do rateio percentual vai para a **primeira destinação do rateio**, com ajuste manual possível por item.
- O doador é texto livre (sem cadastro de doadores nesta feature); notas de doação não têm número fiscal obrigatório.
- Escopo offline / mono-estação mantido: cadastro e apuração locais, sem sincronização externa.
- O sistema nasce apenas com a destinação "Loja" (padrão); as demais são criadas pelo responsável conforme a necessidade.
- Vendas anteriores à feature não têm alocação retroativa: o relatório aponta todo o período anterior como Loja (coerente com o modelo de resíduo).
