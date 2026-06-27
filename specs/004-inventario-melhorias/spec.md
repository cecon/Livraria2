# Feature Specification: Melhorias de inventário + identidade do livro (`id`) — pendências "Já resolvido", visualização de inventários realizados, remoção do "Importar base de dados"

**Feature Branch**: `004-inventario-melhorias`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User descriptions:
- "fiz um inventário parcial, após ficaram as informações de que preciso resolver com cadastros pendentes, isso é ruim, pq acaba que fui resolvendo ao longo do inventário, logo deveria ter uma opção já resolvido"
- "ao entrar no inventário deveria conseguir ver o inventário realizado com a contabilização de produtos faltantes, produtos sobrando e quantos bateram, a quantidade de livros inventariados e coisas assim, além de poder visualizar o inventário realizado, sem editar claro"
- "precisamos desativar o importar base de dados, minha sugestão é a de comentar e tirar do ui"
- "não uso a coluna codigo de barras da tabela livros, alias podemos remover essa coluna, usamos apenas a coluna codigo … falta uma coluna id na tabela livros numerica auto increment"

## Contexto

Esta feature reúne quatro frentes — uma **fundacional** (modelo de identidade do livro) e três de **inventário/UI**:

0. **Identidade do livro (`id`)** — hoje `livro.codigo TEXT PRIMARY KEY` faz papel duplo: é o **código de barras** (EAN/ISBN, vem do `cdbar` do legado) **e** a identidade/chave estrangeira de várias tabelas. A coluna `codigo_barras` (adicionada na 002) é **redundante e não usada** (importação sempre grava `None`; bipagem casa `codigo OR codigo_barras`). Decisão: **adicionar `id` numérico auto-increment como PK**, manter **`codigo` como coluna única** (o barcode, fonte de verdade da bipagem e do upsert do legado), **remover `codigo_barras`**, e **re-apontar as FKs reais para `livro(id)`**. É pré-requisito das demais frentes e exige migração sem perda de dados (ADR-0012).

1. **Pendências "Já resolvido"** — na bipagem, código sem livro vira **pendência**. Hoje há um único botão que apenas dispensa. Como o operador resolve itens **ao longo** do inventário, ao terminar a lista mostra itens já tratados. Falta a ação explícita **"Já resolvido"**, separada de **"Cadastrar livro"**.

2. **Visualizar inventários realizados** — só dá para ver a sessão aberta. Falta **listar/consultar inventários já realizados** (fechados/cancelados) e ver **agregados** (faltaram, sobraram, bateram, total inventariado), em modo **somente-leitura**.

3. **Remover "Importar base de dados"** — o card de migração do legado na tela Início sai da UI (código de backend preservado).

## Clarifications

### Session 2026-06-27

- Q: Modelo de identidade do livro? → A: **`id INTEGER` auto-increment vira a PK**; `codigo` (barcode EAN/ISBN) vira **UNIQUE NOT NULL** e segue como fonte de verdade da bipagem; **`codigo_barras` é removida**.
- Q: As FKs das tabelas filhas referenciam o quê? → A: **re-apontadas para `livro(id)`** (movimento_estoque, item_contagem, item_lancamento). `item_pedido` permanece **snapshot histórico** por `codigo` (não é FK). Upsert do legado continua casando por `codigo`.
- Q: Como garantir a migração sem perda de dados? → A: **rebuild** em transação única com **verificação de contagem de linhas (antes == depois)** e `PRAGMA foreign_key_check`; em divergência, **rollback**. Aplicada uma vez (registrada em `seaql_migrations`).
- Q: Na ação "Cadastrar livro" a partir de uma pendência, o código lido preenche qual campo? → A: o campo **`codigo`** (barcode, agora a chave única); o `id` é gerado automaticamente.
- Q: Escopo da remoção do "Importar base de dados"? → A: **Apenas esconder o acesso pela UI**; comando de backend e importador permanecem registrados e intactos.
- Q: Onde fica a visualização dos inventários realizados? → A: Na **própria tela/área de Inventário** (lista quando não há sessão aberta; abrir um item mostra o detalhe somente-leitura).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identidade interna do livro (`id`) e código único (Priority: P1, fundacional)

O sistema passa a identificar cada livro por um **`id` numérico interno estável**, mantendo o **`codigo` (código de barras EAN/ISBN) como campo único** e fonte de verdade da bipagem. A coluna redundante `codigo_barras` é removida. As tabelas que referenciam o livro passam a apontar para o `id`. A mudança **não pode perder nenhum dado**.

**Why this priority**: É a fundação das demais frentes e limpa uma ambiguidade do modelo (código = identidade = barcode). Feita agora, com base nova, evita retrofit caro depois.

**Independent Test**: Rodar a migração sobre um banco com livros, movimentos, contagens e lançamentos; conferir que a contagem de linhas de cada tabela é idêntica antes/depois, que `PRAGMA foreign_key_check` não acusa violação, que `codigo_barras` não existe mais e que toda bipagem/extrato/relatório continua resolvendo o livro certo pelo `codigo`.

**Acceptance Scenarios**:

1. **Given** um banco com N livros (cada um com `codigo`/barcode), **When** aplico a migração, **Then** `livro` passa a ter `id` auto-increment como PK, `codigo` UNIQUE NOT NULL, sem `codigo_barras`, e nenhum livro é perdido (contagem igual).
2. **Given** movimentos/contagens/itens de lançamento referenciando livros por `codigo`, **When** aplico a migração, **Then** cada um passa a referenciar `livro(id)` com a mesma associação (join por `codigo`) e contagem de linhas preservada.
3. **Given** a migração concluída, **When** rodo `foreign_key_check`, **Then** não há nenhuma violação referencial.
4. **Given** a migração já aplicada, **When** o app reinicia, **Then** ela **não** roda de novo (registrada em `seaql_migrations`) e o estado permanece íntegro.
5. **Given** qualquer falha no meio da migração, **When** a transação aborta, **Then** o banco volta ao estado anterior, sem alteração parcial.
6. **Given** a bipagem e o upsert do legado, **When** uso o `codigo` (barcode), **Then** continuam funcionando como antes (busca casa só `codigo`).

---

### User Story 2 - Marcar pendência como "Já resolvido" (Priority: P1)

Ao revisar a lista de pendências durante ou após o inventário, o operador encontra itens **já tratados por fora** e clica em **"Já resolvido"** para tirá-los da lista ativa, sem refazer cadastro.

**Why this priority**: É a dor relatada diretamente; entrega uma lista de pendências que reflete só o que falta.

**Independent Test**: Com uma pendência na lista, clicar em "Já resolvido"; verificar que sai da lista ativa, sem criar livro nem alterar estoque/custo.

**Acceptance Scenarios**:

1. **Given** uma pendência ativa para o código "789X" lido 3 vezes, **When** clico em "Já resolvido", **Then** sai da lista ativa e o estoque permanece inalterado.
2. **Given** uma pendência cuja leitura não é um livro, **When** clico em "Já resolvido", **Then** é dispensada sem exigir cadastro.
3. **Given** uma pendência já resolvida, **When** a ação é aplicada de novo, **Then** não há efeito adicional nem erro.

---

### User Story 3 - Visualizar inventários realizados em modo só-leitura (Priority: P1)

Na área de inventário, o operador vê a **lista dos inventários realizados** e abre qualquer um para consultar **agregados** (faltaram, sobraram, bateram, total inventariado) e o detalhamento por livro (sistema × contado × diferença) — **somente leitura**.

**Why this priority**: Dá visibilidade e fecha o ciclo de auditoria; capacidade independente e pedida explicitamente.

**Independent Test**: Após fechar uma sessão com divergências, abrir a lista, selecionar a sessão e conferir agregados e detalhe — sem controle de edição.

**Acceptance Scenarios**:

1. **Given** sessões fechadas, **When** entro na área de inventário, **Then** vejo a lista com modo, rótulo/local, datas de abertura/fechamento e status.
2. **Given** um inventário com 10 livros contados (6 bateram, 3 faltaram, 1 sobrou), **When** abro a visualização, **Then** vejo total=10, bateram=6, faltaram=3, sobraram=1 e a soma das diferenças.
3. **Given** a visualização, **When** procuro editar/reabrir/reaplicar, **Then** não há nenhuma ação que altere a sessão.
4. **Given** uma sessão cancelada, **When** a vejo na lista, **Then** aparece identificada como cancelada, sem ajustes aplicados.
5. **Given** um inventário sem divergências, **When** abro a visualização, **Then** todos os contados aparecem como "bateram" (faltaram=0, sobraram=0).

---

### User Story 4 - Ação distinta "Cadastrar livro" a partir da pendência (Priority: P2)

Quando a pendência é um livro a vender e ainda não cadastrado, o operador clica em **"Cadastrar livro"** e vai direto ao cadastro com o **código lido** já preenchido como **`codigo`** (barcode). A lista separa "Cadastrar livro" de "Já resolvido".

**Independent Test**: Numa pendência, clicar em "Cadastrar livro"; o cadastro abre com o `codigo` preenchido; concluído, a pendência some da lista ativa.

**Acceptance Scenarios**:

1. **Given** uma pendência para "9788535914849", **When** clico em "Cadastrar livro", **Then** o cadastro inicia com esse valor no campo `codigo`.
2. **Given** o cadastro iniciado a partir da pendência, **When** concluo com sucesso, **Then** a pendência é resolvida e some da lista ativa.
3. **Given** o cadastro iniciado a partir da pendência, **When** cancelo sem concluir, **Then** a pendência permanece ativa.

---

### User Story 5 - Reabrir pendência dispensada por engano (Priority: P3)

Se clicar em "Já resolvido" por engano, o operador recupera a pendência sem perder código e quantidade.

**Independent Test**: Marcar "Já resolvido", consultar resolvidas, reabrir e confirmar retorno à lista ativa com os mesmos dados.

**Acceptance Scenarios**:

1. **Given** uma pendência resolvida, **When** consulto as resolvidas, **Then** ela aparece com código e quantidade preservados.
2. **Given** uma pendência resolvida, **When** a reabro, **Then** volta à lista ativa com os mesmos dados.

---

### User Story 6 - Remover "Importar base de dados" do UI (Priority: P3)

A funcionalidade de importar/sincronizar o legado deixa de aparecer e de ser executável pela interface; o código de backend é preservado.

**Independent Test**: Percorrer a UI (inclusive Início) e confirmar que não há acesso à importação, e que os demais fluxos e dados seguem intactos.

**Acceptance Scenarios**:

1. **Given** o app em uso, **When** navego pela Início e demais telas, **Then** não há acesso para importar/sincronizar o legado.
2. **Given** a importação removida da UI, **When** uso vendas, estoque e inventário, **Then** tudo funciona e os dados permanecem intactos.

---

### Edge Cases

- **Linhas órfãs pré-existentes**: a base real tem linhas filhas apontando para um livro já removido (hoje 2, ambas do código `cmmb57324`, vindas de um livro cadastrado e excluído). A migração as **remove intencionalmente com log** (já violam integridade) e verifica que **nenhuma linha que referencia um livro existente** é perdida; uma perda de linha válida **aborta** (rollback).
- **Banco novo/vazio**: a migração copia 0 linhas e converge sem erro.
- **Pendência com várias leituras (qtd > 1)**: "Já resolvido" resolve a pendência inteira.
- **Sessão ainda aberta**: "Já resolvido" e "Cadastrar livro" disponíveis; nada altera a contagem nem o estoque.
- **"Cadastrar livro" interrompido**: a pendência continua ativa.
- **Inventário parcial vs total na visualização**: agregados refletem o escopo; no total, não-lidos tratados como 0 entram como "faltaram" se tinham estoque.
- **Sessão cancelada na visualização**: identificada como cancelada, sem agregados de ajuste.

## Requirements *(mandatory)*

### Modelo de identidade do livro (US1, fundacional)

- **FR-040**: `livro` MUST passar a ter um **`id` numérico auto-increment** como **chave primária** (identidade interna estável).
- **FR-041**: `codigo` (código de barras EAN/ISBN) MUST ser **UNIQUE NOT NULL** e permanecer a **fonte de verdade** da bipagem e a **chave de upsert** do legado.
- **FR-042**: A coluna **`codigo_barras` MUST ser removida**; bipagem e busca MUST casar somente `codigo` (simplificação de `codigo OR codigo_barras`).
- **FR-043**: As tabelas filhas com FK real ao livro — **movimento_estoque, item_contagem, item_lancamento** — MUST referenciar **`livro(id)`**. **item_pedido** MUST permanecer **snapshot histórico** por `codigo` (não-FK).
- **FR-044**: A migração MUST ser **por comando**, aplicada **uma única vez** (registrada em `seaql_migrations`), em **transação única**, e MUST **preservar 100% das linhas que referenciam um livro existente**. As **únicas** linhas removidas MUST ser **órfãs pré-existentes** (FK apontando para livro inexistente — já violam integridade), e a remoção MUST ser **registrada em log** (tabela + quantidade). Verificação: para cada tabela filha, `count(novo) == count(linhas com livro existente)`; ao final, `PRAGMA foreign_key_check` MUST ficar limpo; qualquer perda de linha **válida** MUST abortar sem efeito (rollback).
- **FR-045**: O **upsert idempotente do legado** MUST continuar casando por `codigo` (Princípio IV preservado).
- **FR-046**: O cadastro/edição de livro MUST tratar `codigo` (barcode) como **campo único** do código, **sem** campo "código de barras" separado; o `id` é interno (não editável).

### Pendências — "Já resolvido" e "Cadastrar livro" (US2, US4, US5)

- **FR-001**: A lista de pendências MUST oferecer, por pendência, duas ações **distintas e rotuladas**: **"Cadastrar livro"** e **"Já resolvido"**.
- **FR-002**: **"Já resolvido"** MUST marcar a pendência como resolvida e removê-la da lista **ativa**, sem criar livro, sem dar entrada e sem alterar estoque/custo.
- **FR-003**: **"Cadastrar livro"** MUST conduzir o operador ao cadastro usando o **código lido** como **`codigo`** (barcode) inicial; ao concluir com sucesso, a pendência MUST ser resolvida e sair da lista ativa.
- **FR-004**: Se o cadastro não for concluído, a pendência MUST permanecer ativa.
- **FR-005**: Ambas as ações MUST estar disponíveis durante a sessão aberta e após o fechamento, enquanto a pendência existir.
- **FR-006**: Pendências resolvidas MUST permanecer **recuperáveis para auditoria** (consulta de resolvidas), com código e quantidade preservados.
- **FR-007**: O sistema MUST permitir **reabrir** uma pendência "Já resolvido", retornando-a à lista ativa com os mesmos dados.
- **FR-008**: "Já resolvido" MUST ser **idempotente**.

### Visualização de inventários realizados (US3)

- **FR-010**: O sistema MUST disponibilizar, na **própria tela/área de Inventário** (quando não há sessão aberta), uma **lista dos inventários realizados** (fechados e cancelados) com modo, rótulo/local, datas de abertura/fechamento e status.
- **FR-011**: Ao selecionar um inventário, MUST exibir, em **somente-leitura**, o detalhamento por livro: quantidade do sistema (no fechamento), contada e diferença.
- **FR-012**: MUST exibir **agregados**: **total inventariado**, **bateram** (dif=0), **faltaram** (contado < sistema), **sobraram** (contado > sistema) e **soma das diferenças**; vale a identidade bateram + faltaram + sobraram = total.
- **FR-013**: A visualização MUST ser **estritamente somente-leitura** (sem editar contagem, reabrir sessão ou reaplicar ajuste).
- **FR-014**: Agregados e detalhamento MUST ser reconstruídos dos **dados persistidos** da sessão, refletindo o estado no fechamento (coerente com FR-029 da 002).
- **FR-015**: A visualização MUST listar as **pendências vinculadas** à sessão (código lido e quantidade), para auditoria.

### Remoção do "Importar base de dados" (US6)

- **FR-020**: O sistema MUST remover da interface todo acesso à importação/sincronização do legado (hoje na Início).
- **FR-021**: A remoção MUST se limitar ao **acesso pela UI** (card comentado/preservado); o **comando de backend e o importador MUST permanecer registrados e intactos**.
- **FR-022**: A remoção MUST NÃO afetar dados importados nem outros fluxos (vendas, estoque, inventário).

### Localização

- **FR-030**: Termos e fluxos MUST permanecer em pt-BR; valores monetários em centavos formatados pt-BR.

### Key Entities *(include if feature involves data)*

- **Livro** (existente, **remodelado**): ganha **`id` (PK numérica auto-increment)**; **`codigo`** (barcode EAN/ISBN) vira **UNIQUE NOT NULL**, fonte de verdade da bipagem e chave de upsert do legado; **perde `codigo_barras`**. Demais atributos mantidos (título, autor, preço, categoria, estoque, custo médio, etc.).
- **MovimentoEstoque / ItemContagem / ItemLancamento** (existentes): FK ao livro **re-apontada de `livro_codigo` para `livro_id`** (referenciando `livro(id)`).
- **ItemPedido** (existente): permanece **snapshot histórico** por `codigo`/título/preço (não vira FK por `id`).
- **PendenciaCadastro** (existente, da 002): refina o **ciclo de vida** — resolvível por "Cadastrar livro" ou "Já resolvido", e reabrível; resolvidas ficam registradas para auditoria.
- **SessaoInventario** (existente): exposta em **modo histórico/leitura**, listável e consultável após o fechamento.
- **ResumoInventario** (derivado, não armazenado): agregados de uma sessão (total, bateram, faltaram, sobraram, soma das diferenças) calculados das contagens.
- **Importação de legado** (existente): **acesso removido da UI**; comando e importador intactos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A migração preserva **100% das linhas que referenciam um livro existente**; as únicas linhas removidas são **órfãs pré-existentes** (na base atual: **2** — um `movimento_estoque` e um `item_contagem` do livro removido `cmmb57324`), registradas em log; `foreign_key_check` fica limpo após a migração.
- **SC-002**: Após a migração, `codigo_barras` **não existe** e 100% das bipagens/buscas resolvem o livro pelo `codigo`.
- **SC-003**: O operador limpa uma pendência já tratada com "Já resolvido" em **1 clique** e < **5 s**, sem abrir cadastro, com 0 livros criados e 0 alterações de estoque/custo.
- **SC-004**: 100% das pendências resolvidas permanecem recuperáveis; uma dispensada por engano é reaberta com os mesmos dados.
- **SC-005**: A partir da área de inventário, o operador vê agregados e detalhe de um inventário realizado em < **5 s**, sem nenhum controle de edição.
- **SC-006**: Agregados consistentes em 100% dos casos (bateram + faltaram + sobraram = total; soma das diferenças = ajustes do fechamento).
- **SC-007**: Após a remoção, **0 caminhos na UI** para importar o legado; demais fluxos intactos.

## Assumptions

- **`codigo` é o código de barras** (EAN/ISBN), vindo do `cdbar` do legado; segue como fonte de verdade e chave de upsert. O `id` é puramente interno.
- **`item_pedido` é snapshot**: linhas de venda preservam `codigo`/título/preço congelados; não são re-apontadas para `id` (não são FK hoje).
- **Pendências sem auto-detecção**: a baixa é sempre manual ("Já resolvido" ou "Cadastrar livro"); "Já resolvido" é resolução suave e reversível (reabrir), sem confirmação modal.
- **Visualização é leitura pura**: reconstrói o relatório do que foi persistido no fechamento; não recalcula nem reaplica.
- **Importação — remoção só de UI**: card comentado/preservado; backend intacto e religável.
- **Plataforma**: desktop offline, mono-usuário, pt-BR, dinheiro em centavos, Hexagonal, ≤300 linhas/arquivo, migrations idempotentes por comando (constituição); decisão de PK registrada em **ADR-0012**.

## Dependencies

- Estende **002-estoque-movimentos-inventario** (pendências, relatório de divergências, dados de sessão) e **003-fornecedores-lancamento-notas** (item_lancamento entra na migração de FK). A refatoração de identidade (US1) é **pré-requisito** das demais frentes desta feature.
