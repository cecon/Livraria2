# Feature Specification: Movimentação de Estoque & Inventário — Livraria 2 (Espaço do Livro)

**Feature Branch**: `002-estoque-movimentos-inventario`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "precisamos implementar a função de estoque e inventário de estoque, vamos antes fazer um brain storm para entender as melhores práticas?"

## Contexto do Brainstorm

Hoje o estoque é um único número mutável por livro (`Livro.estoque`): a venda decrementa, o cadastro
sobrescreve, e não existe trilha de **por que** o número mudou — nem entrada de mercadoria, nem ajuste,
nem contagem física. Esta feature introduz uma **razão de movimentos** como fonte da verdade do estoque:
toda alteração (venda, entrada, ajuste, contagem de inventário) vira um **movimento imutável**, e o saldo
de cada livro é a soma dos seus movimentos. Isso dá auditoria permanente e torna o inventário trivial.

Decisões fechadas no brainstorm:

- **Modelo**: razão de movimentos como fonte da verdade; o estoque exibido é reconciliável com a soma dos movimentos.
- **Entrada de mercadoria**: com custo (em centavos) e fornecedor, abrindo caminho para margem futura.
- **Inventário**: sessão de contagem por **bipagem** (leitor de código de barras = teclado), cada leitura soma +1; modo **parcial** (ex.: "hoje conto só a Gaveta A") ou **total**.
- **Código não encontrado na bipagem**: tenta achar por nome/título; se não achar, vai para lista de pendências de cadastro (não trava a contagem).

## Clarifications

### Session 2026-06-23

- Q: Como reconciliar o estoque dos livros já migrados (que têm `estoque` sem movimentos) com a invariante "soma dos movimentos = estoque"? → A: Gerar um movimento de `saldo_inicial` por livro ao adotar a feature; a partir daí tudo é movimento e a invariante vale desde o dia 1.
- Q: O código de barras usado na bipagem é o `codigo` interno ou um campo separado? → A: Campo `codigo_barras` (EAN/ISBN) opcional e separado do `codigo` interno; bipar busca por ele e, se não achar, por nome.
- Q: Na entrada de mercadoria (compra), o custo é unitário ou total, e como tratar a valorização? → A: A tela aceita um dos dois (total ↔ unitário derivam um do outro); o sistema mantém **custo médio ponderado** por livro, recalculado a cada entrada. Entrada (compra) é tela separada do inventário e tem fornecedor + custo.
- Q: Um ajuste/contagem pode deixar o estoque negativo? → A: Não. O ajuste cujo resultado seria < 0 é barrado; o estoque nunca fica negativo. A contagem sempre define o valor contado (≥ 0).
- Q: Qual "quantidade do sistema" o ajuste de inventário usa como referência? → A: O saldo no momento do **fechamento** da sessão; o ajuste leva o estoque a ficar exatamente igual ao contado (diferença = contado − saldo no fechamento).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar entrada de mercadoria (Priority: P1)

A pessoa responsável recebe livros (compra/reposição/doação) e precisa dar entrada no estoque informando
quanto chegou, o custo e de quem veio, de forma que o estoque suba **com histórico** — não por sobrescrita
silenciosa no cadastro.

**Why this priority**: É a forma correta e auditável de **aumentar** estoque, que hoje não existe. Sozinha
já entrega valor: a livraria passa a registrar reposições com custo e fornecedor, base para conferência e
margem futura.

**Independent Test**: Dar entrada de N unidades de um livro com custo e fornecedor; verificar que o estoque
do livro aumentou exatamente N e que existe um movimento de entrada com o custo e o fornecedor registrados.

**Acceptance Scenarios**:

1. **Given** um livro com estoque 4, **When** registro uma entrada de 10 unidades com custo unitário R$ 12,50 e fornecedor "Editora X", **Then** o estoque passa a 14 e fica gravado um movimento de entrada (+10, custo, fornecedor, data/hora).
2. **Given** o campo fornecedor, **When** começo a digitar um fornecedor já usado antes, **Then** o sistema sugere os fornecedores anteriores.
3. **Given** uma entrada em rascunho, **When** informo quantidade 0 ou negativa, **Then** o sistema impede a confirmação e explica o motivo.

---

### User Story 2 - Inventário por bipagem com reconciliação (Priority: P1)

A pessoa faz a contagem física do acervo (ou de uma parte, como uma gaveta/estante) bipando cada livro no
leitor de código de barras. O sistema acumula a contagem, compara com o estoque registrado e, ao fechar,
aplica o ajuste apenas onde houver divergência — gerando um relatório do que estava errado.

**Why this priority**: É o "inventário de estoque" pedido. Corrige o estoque para refletir a realidade da
prateleira com trilha de ajuste, e o modo parcial permite contar aos poucos sem risco de zerar a loja.

**Independent Test**: Abrir uma sessão parcial "Gaveta A", bipar alguns livros, conferir a divergência
exibida (sistema vs. contado), fechar a sessão e verificar que só os livros contados foram ajustados, com
um movimento de contagem por divergência — e que livros fora da gaveta ficaram intactos.

**Acceptance Scenarios**:

1. **Given** uma sessão de inventário **parcial** rotulada "Gaveta A", **When** bipo o mesmo livro 3 vezes, **Then** a quantidade contada desse livro fica 3.
2. **Given** um livro com estoque 5 no sistema e contagem 4 na sessão, **When** reviso a sessão, **Then** vejo sistema=5, contado=4, divergência=-1.
3. **Given** a sessão parcial revisada, **When** fecho a sessão, **Then** cada livro divergente recebe um movimento de contagem com a diferença aplicada, e livros **não bipados** permanecem inalterados.
4. **Given** uma sessão **total**, **When** fecho a sessão, **Then** todo livro ativo **não bipado** é tratado como contagem 0 e ajustado, após confirmação explícita.
5. **Given** uma bipagem de um código que não existe no cadastro, **When** o sistema não acha por código nem por nome, **Then** o código entra na lista de pendências da sessão e a contagem continua sem travar.
6. **Given** uma sessão aberta, **When** a cancelo antes de fechar, **Then** nenhum estoque é alterado.

---

### User Story 3 - Ajuste avulso de estoque com motivo (Priority: P2)

Ao notar uma perda, quebra, doação ou erro pontual, a pessoa corrige o estoque de um livro específico,
sempre informando o motivo — sem precisar abrir uma contagem inteira.

**Why this priority**: Cobre as correções do dia a dia com rastreabilidade. Depende da razão de movimentos
(US1/US2), por isso P2.

**Independent Test**: Aplicar um ajuste de -2 num livro com motivo "quebra"; verificar estoque reduzido em
2 e movimento de ajuste com o motivo registrado.

**Acceptance Scenarios**:

1. **Given** um livro com estoque 7, **When** registro um ajuste de -2 com motivo "quebra", **Then** o estoque passa a 5 e fica gravado um movimento de ajuste (-2, motivo, data/hora).
2. **Given** um ajuste, **When** tento confirmar sem motivo, **Then** o sistema impede e exige o motivo.
3. **Given** um ajuste positivo de +3 com motivo "correção de contagem", **When** confirmo, **Then** o estoque aumenta 3 com movimento de ajuste.

---

### User Story 4 - Extrato de movimentação do livro (Priority: P2)

A pessoa consulta o histórico de um livro para entender como o estoque chegou ao número atual: entradas,
vendas, ajustes e contagens, em ordem cronológica.

**Why this priority**: Transforma a razão de movimentos em auditoria visível e confiança no número. Depende
de existirem movimentos, por isso P2.

**Independent Test**: Após uma entrada, uma venda e um ajuste no mesmo livro, abrir o extrato e verificar as
três linhas em ordem, com saldo resultante batendo com o estoque exibido.

**Acceptance Scenarios**:

1. **Given** um livro com entrada (+10), venda (-1) e ajuste (-2), **When** abro o extrato, **Then** vejo as três linhas em ordem cronológica com tipo, quantidade, origem, data e saldo resultante.
2. **Given** o extrato, **When** somo as quantidades de todos os movimentos, **Then** o total bate exatamente com o estoque exibido do livro.

---

### User Story 5 - Pendências de cadastro vindas do inventário (Priority: P3)

Códigos bipados durante o inventário que não correspondem a nenhum livro cadastrado ficam numa lista de
pendências para cadastro/entrada posterior, para que nada que apareceu na prateleira se perca.

**Why this priority**: Fecha o ciclo do inventário, mas é secundário ao fluxo principal de contagem.

**Independent Test**: Bipar um código inexistente durante uma sessão, fechar a sessão e confirmar que o
código (com a quantidade lida) aparece na lista de pendências de cadastro.

**Acceptance Scenarios**:

1. **Given** uma sessão com 2 códigos desconhecidos bipados, **When** fecho a sessão, **Then** os 2 códigos com suas quantidades ficam disponíveis numa lista de pendências de cadastro.
2. **Given** uma pendência, **When** cadastro o livro e dou entrada a partir dela, **Then** a pendência é resolvida e some da lista.

---

### Edge Cases

- **Bipar o mesmo livro repetidamente**: cada leitura soma +1 à contagem do livro na sessão.
- **Contagem maior que o sistema**: a divergência é positiva e o ajuste de fechamento aumenta o estoque (sem custo associado — ajuste de contagem não é compra).
- **Fechar sessão total sem ter contado tudo**: o sistema avisa que livros não bipados serão zerados e exige confirmação explícita antes de aplicar.
- **Venda com estoque insuficiente**: segue a regra de venda existente (validação de disponibilidade); o movimento de saída reflete a baixa efetivamente aplicada.
- **Ajuste que deixaria estoque negativo**: barrado — o sistema rejeita e o estoque permanece ≥ 0 (regra de não-negativo preservada, coerente com a venda).
- **Sessão de inventário aberta e o app é fechado**: ao reabrir, a sessão em andamento pode ser retomada ou cancelada (não há aplicação parcial silenciosa).
- **Código bipado encontra mais de um livro por nome**: o operador escolhe qual livro receber a contagem.
- **Vendas históricas migradas do legado**: não geram movimentos retroativos (mantém o comportamento de importação sem baixa de estoque da feature 001).

## Requirements *(mandatory)*

### Functional Requirements

#### Fundação — razão de movimentos

- **FR-001**: O sistema MUST registrar toda alteração de estoque (entrada de mercadoria, saída por venda, ajuste avulso e contagem de inventário) como um **movimento imutável**, contendo no mínimo: livro, tipo, quantidade com sinal, data/hora, origem/motivo e referência (ex.: número do pedido ou identificador da sessão de inventário).
- **FR-002**: O saldo de estoque de cada livro MUST ser reconciliável com a soma dos seus movimentos; o estoque exibido MUST refletir essa soma (diferença zero).
- **FR-003**: A venda existente MUST passar a gerar um movimento de **saída** correspondente à baixa de estoque, preservando a baixa atômica e a regra de não-negativo já existentes.
- **FR-004**: O sistema MUST NÃO criar movimentos retroativos para vendas históricas migradas do legado (mantém a importação sem baixa de estoque definida na feature 001).
- **FR-006**: Ao adotar esta feature, o sistema MUST gerar, de forma idempotente, um movimento de **saldo inicial** (`saldo_inicial`) por livro com a quantidade de estoque atual, de modo que a invariante "soma dos movimentos = estoque exibido" seja verdadeira desde o início. Re-executar a adoção não pode duplicar o saldo inicial.
- **FR-005**: Movimentos MUST ser imutáveis após criados; correções acontecem por **novos** movimentos (ajuste), nunca por edição/exclusão do histórico.

#### Entrada de mercadoria (US1)

- **FR-010**: Usuários MUST poder registrar uma **entrada de mercadoria (compra)** — em tela própria, distinta do inventário — informando o livro, a quantidade (> 0), o **custo** (em centavos) e o **fornecedor**.
- **FR-010a**: Na entrada, o usuário MUST poder informar o **custo total** OU o **custo unitário** da linha: ao informar o total, o sistema MUST calcular o unitário (total ÷ qtd); ao informar o unitário, MUST calcular o total (unitário × qtd).
- **FR-011**: A entrada MUST aumentar o estoque do livro pela quantidade informada e gerar um movimento de entrada com custo unitário e fornecedor.
- **FR-012**: O sistema MUST sugerir fornecedores já utilizados anteriormente ao informar o fornecedor.
- **FR-013**: O custo registrado na entrada MUST ser histórico e MUST NÃO alterar o preço de venda do livro automaticamente.
- **FR-014**: O sistema MUST rejeitar entradas com quantidade ≤ 0 e explicar o motivo ao usuário.
- **FR-015**: O sistema MUST manter um **custo médio ponderado** por livro, recalculado a cada entrada como `(estoque_atual × custo_médio_atual + qtd_entrada × custo_unitário) ÷ (estoque_atual + qtd_entrada)`, em centavos. Ajustes e contagens de inventário MUST NÃO alterar o custo médio. O `saldo_inicial` dos livros migrados entra com custo médio desconhecido (0), que passa a refletir o real conforme entradas são registradas.

#### Inventário por contagem (US2)

- **FR-020**: Usuários MUST poder abrir uma **sessão de inventário** escolhendo o modo **parcial** ou **total**, e informar um rótulo/local para sessões parciais (ex.: "Gaveta A").
- **FR-021**: Durante a sessão, cada leitura de código de barras MUST incrementar em 1 a quantidade contada do livro correspondente; o usuário MUST poder também ajustar a quantidade contada manualmente.
- **FR-022**: O sistema MUST localizar o livro pelo valor lido casando contra `codigo_barras` **OU** `codigo` (PK interna). Isto garante que os livros migrados — que carregam o EAN-13 no `codigo` e podem ter `codigo_barras` nulo — sejam encontrados na bipagem sem backfill prévio. Não encontrando por nenhum dos dois, o sistema MUST permitir buscar e selecionar o livro por nome/título.
- **FR-022a**: O livro MUST ter um campo `codigo_barras` (EAN/ISBN) **opcional**, distinto do `codigo` interno, editável no cadastro e usado como chave de busca na bipagem do inventário.
- **FR-023**: Códigos lidos que não correspondem a nenhum livro cadastrado MUST ser acumulados numa lista de **pendências** da sessão, sem interromper a contagem.
- **FR-024**: Ao revisar a sessão, o sistema MUST exibir, por livro contado, a quantidade do sistema (saldo atual), a quantidade contada e a divergência.
- **FR-025**: Ao fechar uma sessão **parcial**, o sistema MUST aplicar ajuste **apenas** aos livros contados na sessão; livros não contados MUST permanecer inalterados.
- **FR-026**: Ao fechar uma sessão **total**, o sistema MUST tratar como contagem 0 qualquer livro ativo não lido e ajustar o estoque conforme, **somente após confirmação explícita** do usuário.
- **FR-027**: O fechamento de sessão MUST gerar um movimento de **contagem** por livro divergente, vinculado à sessão, aplicando a diferença `contado − saldo no fechamento`, de modo que o estoque resultante fique exatamente igual ao valor contado. A quantidade do sistema usada como referência MUST ser a do **momento do fechamento** (não a da abertura).
- **FR-028**: O sistema MUST permitir **cancelar** uma sessão antes do fechamento, sem alterar nenhum estoque.
- **FR-029**: O sistema MUST disponibilizar um **relatório de divergências** da sessão (livro, quantidade do sistema, contada, diferença), tanto no fechamento quanto **posteriormente** para sessões já fechadas. As divergências MUST ser recuperáveis a partir dos movimentos `contagem` vinculados ao identificador da sessão (`referencia`), preservando a auditoria após o fechamento.
- **FR-030**: O sistema MUST tratar a contagem de forma idempotente no fechamento — fechar a mesma sessão não pode aplicar o ajuste duas vezes.

#### Ajuste avulso (US3)

- **FR-040**: Usuários MUST poder registrar um **ajuste** de estoque de um livro (positivo ou negativo) informando um **motivo** obrigatório (ex.: perda, quebra, doação, correção).
- **FR-041**: O ajuste MUST gerar um movimento de ajuste com a quantidade (com sinal) e o motivo.
- **FR-042**: O sistema MUST rejeitar ajustes sem motivo informado.
- **FR-043**: O sistema MUST rejeitar qualquer ajuste cujo resultado deixaria o estoque do livro **negativo** (resultado MUST ser ≥ 0); o estoque nunca fica negativo.

#### Extrato e pendências (US4, US5)

- **FR-050**: Usuários MUST poder consultar o **extrato de movimentação** de um livro em ordem cronológica, com tipo, quantidade, origem/motivo, data e saldo resultante.
- **FR-051**: O sistema MUST manter a lista de **pendências de cadastro** (códigos desconhecidos coletados em inventários, com quantidade) para cadastro/entrada posterior.
- **FR-052**: O sistema MUST permitir resolver uma pendência ao cadastrar o livro correspondente, removendo-a da lista.

#### Localização e moeda

- **FR-060**: Todos os valores monetários (custo de entrada) MUST ser tratados em **centavos (inteiro)** e exibidos em formato pt-BR (ex.: `R$ 12,50`).
- **FR-061**: Termos e fluxos do domínio MUST permanecer em pt-BR e coerentes com o vocabulário atual (estoque, pedido, fornecedor, gaveta/estante).

### Key Entities *(include if feature involves data)*

- **MovimentoEstoque**: registro imutável de uma alteração de estoque. Atributos: livro, tipo (`saldo_inicial` | `entrada` | `saida_venda` | `ajuste` | `contagem`), quantidade com sinal, data/hora, origem/motivo, referência (nº do pedido ou id da sessão), e — para entradas — **custo unitário** (centavos) e fornecedor. É a fonte da verdade do estoque. O movimento `saldo_inicial` é gerado uma única vez por livro na adoção da feature.
- **Livro — custo médio**: cada livro mantém um **custo médio ponderado** (centavos), recalculado a cada entrada de mercadoria (compra); ajustes e contagens não o alteram.
- **SessaoInventario**: uma contagem física. Atributos: identificador, modo (`parcial` | `total`), rótulo/local (para parcial), status (`aberta` | `fechada` | `cancelada`), data de abertura e de fechamento. Agrega itens contados e pendências.
- **ItemContagem**: a contagem de um livro dentro de uma sessão. Atributos: livro, quantidade contada, quantidade do sistema (capturada no fechamento) e diferença resultante.
- **PendenciaCadastro**: código de barras lido numa sessão que não corresponde a livro cadastrado, com a quantidade lida, aguardando cadastro/entrada.
- **Fornecedor**: origem de uma entrada de mercadoria. Nesta versão é texto identificável com sugestão dos já usados (sem cadastro formal próprio).
- **Livro** (existente, estendido): além dos campos atuais, passa a ter um **`codigo_barras`** (EAN/ISBN) opcional e distinto do `codigo` interno, usado como chave na bipagem do inventário, e o estoque exibido reconciliável com os movimentos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das alterações de estoque (venda, entrada, ajuste, inventário) possuem movimento rastreável — para qualquer livro, a soma dos movimentos é igual ao estoque exibido (diferença zero).
- **SC-002**: A entrada de mercadoria de um livro (quantidade + custo + fornecedor) é concluída em menos de 30 segundos.
- **SC-003**: Durante a contagem por bipagem, cada leitura é refletida na quantidade contada em menos de 1 segundo, permitindo bipar em ritmo contínuo sem espera perceptível.
- **SC-004**: Ao fechar uma sessão parcial, 0 livros fora do escopo contado têm o estoque alterado.
- **SC-005**: O extrato de qualquer livro mostra o histórico completo e o saldo final bate com o estoque exibido em 100% dos casos.
- **SC-006**: 100% das divergências apuradas numa sessão de inventário ficam registradas como movimento de contagem e disponíveis no relatório de divergências.
- **SC-007**: 100% dos códigos desconhecidos bipados em inventário ficam recuperáveis na lista de pendências de cadastro (nenhum é perdido).

## Assumptions

- **Código de barras**: confirmado (ver Clarifications) — campo `codigo_barras` (EAN/ISBN) **opcional e separado** do `codigo` interno, com fallback de busca por nome. Há **dois sentidos** convivendo: a constituição/feature 001 tratam `livro.codigo` como EAN-13 (chave de upsert do import legado), enquanto esta feature adiciona `codigo_barras` para livros cujo `codigo` interno **não** seja o EAN. Por isso a bipagem casa contra os dois campos (FR-022): livros migrados (EAN no `codigo`) funcionam sem backfill; o `codigo_barras` cobre os casos em que o código interno difere do EAN impresso.
- **Fornecedor**: tratado como texto identificável com sugestão dos valores já usados; não há cadastro formal de fornecedores (com CNPJ, contato etc.) nesta versão — pode virar feature futura.
- **Custo de entrada**: é informação histórica de compra; não recalcula nem altera o preço de venda automaticamente (margem/precificação fica fora do escopo desta feature).
- **Mono-usuário / sessão única**: assume-se uma sessão de inventário ativa por vez (coerente com o app desktop mono-estação).
- **Vendas históricas**: a migração do legado permanece sem gerar baixa nem movimentos retroativos (mantém FR-069 da feature 001); a razão de movimentos vale a partir da adoção desta feature.
- **Estoque como cache reconciliável**: o estoque exibido por livro é mantido em sincronia com a soma dos movimentos; em caso de divergência técnica, os movimentos são a fonte da verdade.
- **Plataforma e localização**: app desktop offline, pt-BR, dinheiro em centavos, arquitetura Hexagonal e limite de 300 linhas por arquivo conforme a constituição do projeto.

## Dependencies

- Baseia-se na feature **001-sistema-estoque-vendas** (entidade Livro, fluxo de venda com baixa de estoque, dashboard de estoque) — esta feature estende esse núcleo com a razão de movimentos, entrada, ajuste e inventário.
