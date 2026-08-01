# Feature Specification: PDV de responsabilidade reduzida — fase 2 ("a nuvem manda")

**Feature Branch**: `012-pdv-nuvem-manda`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: reduzir o PDV a **consumidor** de cadastros + **fonte apenas de fatos operacionais** (venda/cancelamento). A nuvem (escritório) passa a ser dona dos cadastros, do estoque oficial, da entrada de notas e do inventário.

## Contexto

Complementa a **fase 1** (`011-pdv-responsabilidade-reduzida`, ADR-0023): o estoque oficial já é
efeito da nuvem (baixa por venda pronta, estorno por cancelamento — migrações `0011`/`0012`/`0013`
em produção). Esta fase 2 **conclui** a redução: o PDV deixa de ser **editor de cadastros** e
**contador de estoque oficial**, e passa a só **consumir** o que a nuvem publica. O PDV continua
**offline-first** para o que é presencial no balcão: abrir turno, vender e cancelar.

## Clarifications

### Session 2026-07-31

- Q: A operação "destinar estoque" (alocar quantidade entre "livre" e carimbos de destinação) segue o estoque para a nuvem, ou permanece no PDV? → A: **Vai pra nuvem** — a alocação vira operação de retaguarda; o PDV apenas **lê** os saldos por destinação (livre/carimbos) publicados, sem oferecer a operação de alocação.
- Q: Construir entrada de notas + inventário na nuvem faz parte desta feature ou vira feature separada? → A: **Tudo nesta feature** — construir entrada + inventário na retaguarda E remover do PDV, junto com US1/US2/US5 (uma feature completa; o plano pode ordenar as tarefas, mas o escopo é único).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancelamento e venda viram fatos; a nuvem contabiliza (Priority: P1)

Hoje o PDV baixa/estorna estoque no próprio caixa (ledger local) e, no cancelamento, **não** avisa a
nuvem — o pedido cancelado nunca re-sincroniza, então a nuvem nunca estorna (bug de produção). Nesta
história o PDV para de contabilizar: **venda** e **cancelamento** viram **fatos** que sobem, e a
**nuvem** faz a baixa e o estorno oficiais.

**Why this priority**: corrige um **bug de produção** (cancelamento não estorna) e remove a trilha
dupla de estoque (coluna local `estoque` vs `saldo_publicado`), que é a raiz dos incidentes de saldo.

**Independent Test**: cancelar uma venda no PDV → no próximo sync a nuvem estorna → o saldo oficial
volta ao valor anterior e é republicado → o PDV mostra o "saldo op." corrigido. Vender → a nuvem
baixa; nenhum movimento oficial de estoque é gerado/empurrado pelo PDV.

**Acceptance Scenarios**:

1. **Given** uma venda concluída e sincronizada, **When** o operador cancela essa venda no PDV,
   **Then** o pedido é re-sincronizado com `cancelado=true` e a nuvem cria o estorno oficial, o saldo
   volta ao valor pré-venda e é republicado para o PDV.
2. **Given** uma venda em andamento, **When** o operador conclui a venda, **Then** o PDV registra o
   pedido/itens/pagamentos como fatos e **não** gera nem empurra `movimento_estoque` de
   `saida_venda`/`estorno`.
3. **Given** o PDV offline, **When** o operador vende ou cancela, **Then** a operação é registrada
   localmente e o "saldo operacional" reflete os fatos ainda não sincronizados; ao reconectar, a
   nuvem processa a contabilidade oficial.
4. **Given** um cancelamento já processado, **When** o mesmo fato é sincronizado novamente,
   **Then** o resultado é idempotente (um único estorno).

---

### User Story 2 - Cadastros somente-leitura no PDV (Priority: P1)

Os cadastros de **fornecedor**, **forma de pagamento** e **destinação** passam a ser editáveis
**apenas na nuvem** (escritório). O PDV **lê** esses dados (descem pelo sync) para operar — por
exemplo, escolher a forma de pagamento na venda — mas **não** oferece janelas de criação/edição/
exclusão.

**Why this priority**: é o núcleo do "a nuvem manda" — elimina divergência de cadastro entre caixas e
garante uma fonte única de verdade; sem isso, um caixa ainda pode empurrar/alterar cadastro.

**Independent Test**: no PDV, as telas de edição desses cadastros não existem mais (ou estão em modo
leitura); alterar um cadastro na nuvem reflete no PDV no próximo sync; o PDV nunca origina alteração
de cadastro.

**Acceptance Scenarios**:

1. **Given** o PDV atualizado, **When** o operador procura editar forma de pagamento / fornecedor /
   destinação, **Then** não há ação de edição disponível (somente consulta/uso).
2. **Given** um cadastro alterado na nuvem, **When** o PDV sincroniza, **Then** o dado atualizado
   aparece no PDV.
3. **Given** uma venda em andamento, **When** o operador seleciona a forma de pagamento, **Then** a
   lista vem dos dados publicados pela nuvem (uso, não edição).

---

### User Story 3 - Entrada de notas apenas na nuvem (Priority: P2)

O **lançamento de notas de entrada** (compras/fornecedores que aumentam o estoque) deixa de existir no
PDV e passa a ser feito **na retaguarda (nuvem)**. A entrada afeta o **estoque oficial** na nuvem, que
republica o saldo para os PDVs.

**Why this priority**: centraliza a contabilidade de entrada junto com a de saída (já na nuvem);
depende de existir a tela de entrada na retaguarda.

**Independent Test**: registrar uma entrada de nota na retaguarda → o saldo oficial sobe → é
republicado → o PDV mostra o novo saldo. No PDV, não há mais tela de lançamento de entrada.

**Acceptance Scenarios**:

1. **Given** a retaguarda, **When** um admin lança uma nota de entrada, **Then** o estoque oficial do
   item aumenta e é republicado para os PDVs.
2. **Given** o PDV atualizado, **When** o operador procura lançar entrada, **Then** a função não
   existe mais no PDV.

---

### User Story 4 - Inventário apenas na nuvem (Priority: P2)

A **contagem de inventário** (ajuste do estoque à contagem física) deixa de existir no PDV e passa a
ser feita **na retaguarda (nuvem)**. O ajuste afeta o **estoque oficial**, que republica o saldo.

**Why this priority**: mesma lógica da entrada — o ajuste é contábil e pertence à nuvem; depende da
tela de inventário existir na retaguarda (e ela ser usável no balcão, ex.: no celular).

**Independent Test**: fazer um ajuste de inventário na retaguarda → o saldo oficial reflete o ajuste →
é republicado → o PDV mostra o novo saldo. No PDV, não há mais tela de inventário.

**Acceptance Scenarios**:

1. **Given** a retaguarda, **When** um admin registra a contagem/ajuste de um item, **Then** o
   estoque oficial passa a refletir a contagem e é republicado para os PDVs.
2. **Given** o PDV atualizado, **When** o operador procura fazer inventário, **Then** a função não
   existe mais no PDV.

---

### User Story 5 - Dashboard do PDV focado no turno (Priority: P3)

O dashboard atual do PDV é centrado em estoque (total de livros, total de estoque, estoque baixo) —
informação que agora vive na nuvem e perde sentido no caixa. Ele é substituído por uma visão
**operacional do turno aberto**: a **lista de vendas do turno**.

**Why this priority**: melhora de usabilidade coerente com o novo papel do PDV; não bloqueia as demais
histórias.

**Independent Test**: com um turno aberto e vendas registradas, a tela inicial do PDV mostra a lista
de vendas daquele turno (com o essencial: identificação, valor, hora, situação), sem os indicadores de
estoque antigos.

**Acceptance Scenarios**:

1. **Given** um turno aberto com vendas, **When** o operador abre a tela inicial, **Then** vê a lista
   das vendas do turno atual.
2. **Given** nenhum turno aberto, **When** o operador abre a tela inicial, **Then** vê um estado
   vazio orientando a abrir o turno.

---

### Edge Cases

- **Cancelamento offline seguido de reconexão**: o fato de cancelamento precisa subir mesmo tendo o
  pedido já sido sincronizado antes (o pedido deve voltar a ser "pendente" ao ser cancelado).
- **Venda de item cujo saldo publicado está desatualizado**: o PDV vende pelo saldo operacional; a
  nuvem é a autoridade e registra divergência se o saldo oficial ficar negativo (comportamento da
  fase 1).
- **Cadastro consumido pela venda que foi desativado na nuvem** (ex.: forma de pagamento inativada):
  o PDV deve lidar com formas inativas sem travar vendas já iniciadas.
- **PDV antigo (não atualizado) na mesma loja**: enquanto coexistir, pode ainda gerar movimento local;
  a nuvem deve permanecer idempotente e não duplicar contabilidade.
- **Histórico local de estoque no PDV**: os movimentos/coluna `estoque` antigos permanecem para
  auditoria local, mas deixam de ser a base do saldo exibido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O PDV MUST tratar **venda** e **cancelamento** como **fatos** sincronizáveis e MUST NOT
  gerar nem empurrar movimentos oficiais de estoque (`saida_venda`/`estorno`) por essas operações.
- **FR-002**: Ao **cancelar** uma venda, o PDV MUST marcar o pedido para **re-sincronização** (o
  cancelamento precisa subir mesmo que o pedido já tenha sido sincronizado antes), carregando
  `cancelado` e o momento do cancelamento.
- **FR-003**: A nuvem MUST continuar sendo a **única** fonte contábil do estoque oficial (baixa por
  venda pronta, estorno por cancelamento) e MUST republicar o saldo aos PDVs quando o estoque muda
  (comportamento já entregue na fase 1).
- **FR-004**: O PDV MUST exibir o **saldo operacional** derivado do saldo publicado e dos fatos locais
  ainda não sincronizados, funcionando **offline**.
- **FR-005**: O PDV MUST NOT oferecer criação/edição/exclusão de **fornecedor**, **forma de
  pagamento** e **destinação**; essas operações MUST existir apenas na nuvem (escritório).
- **FR-006**: O PDV MUST continuar **consumindo** (lendo) fornecedor, forma de pagamento e destinação
  publicados pela nuvem, o suficiente para operar a venda.
- **FR-007**: O **lançamento de nota de entrada** MUST existir apenas na nuvem; o PDV MUST NOT oferecer
  essa função. A entrada MUST afetar o estoque oficial e ser republicada.
- **FR-008**: O **inventário** (contagem/ajuste) MUST existir apenas na nuvem; o PDV MUST NOT oferecer
  essa função. O ajuste MUST afetar o estoque oficial e ser republicado.
- **FR-009**: A tela inicial do PDV MUST apresentar a **lista de vendas do turno aberto** em vez dos
  indicadores de estoque atuais.
- **FR-010**: Todas as operações que a nuvem processa (baixa, estorno, entrada, inventário) MUST ser
  **idempotentes** sob re-sincronização/reprocessamento.
- **FR-011**: A autoridade e o histórico de **entrada de nota** e **inventário** passam a viver na
  **nuvem**. A atualização do PDV MUST **dropar** (idempotente) as tabelas locais que perdem função no
  caixa — `lancamento_entrada`, `item_lancamento` (entrada) e `sessao_inventario`, `item_contagem`
  (inventário) — sem perda de histórico (mantido/sincronizado na nuvem), removendo antes
  `lancamento_entrada`/`item_lancamento` do sync. O ledger legado (`movimento_estoque` + coluna
  `estoque`) **permanece** (auditoria do ledger antigo), mas deixa de alimentar o saldo exibido, que
  passa a vir do saldo publicado.
- **FR-012**: A operação de **destinar estoque** (alocar quantidade entre "livre" e carimbos de
  destinação) MUST migrar para a **nuvem** junto com o estoque oficial; o PDV MUST apenas **ler** os
  saldos por destinação (livre/carimbos) publicados, sem oferecer a operação de alocação.

### Key Entities

- **Pedido (venda)**: fato operacional (itens, pagamentos, turno). Estado mutável relevante:
  `cancelado`. O PDV o produz; a nuvem o contabiliza.
- **Cadastros de referência**: fornecedor, forma de pagamento, destinação — dados publicados pela
  nuvem e consumidos (somente-leitura) pelo PDV.
- **Estoque oficial**: saldo por produto, mantido e publicado pela nuvem (`saldo_publicado`); base do
  saldo operacional exibido no PDV.
- **Entrada de nota** e **Ajuste de inventário**: eventos que alteram o estoque oficial, originados na
  nuvem.
- **Turno**: janela operacional do caixa; agrupa as vendas exibidas na nova tela inicial.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos cancelamentos feitos no PDV resultam em estorno do estoque oficial na nuvem
  após a sincronização (hoje: 0%).
- **SC-002**: Após uma venda ou cancelamento, o "saldo op." exibido no PDV converge para o saldo
  oficial da nuvem no próximo ciclo de sincronização.
- **SC-003**: O PDV não origina nenhuma alteração de cadastro (fornecedor, forma de pagamento,
  destinação): 0 registros desses cadastros com origem no PDV após a atualização.
- **SC-004**: O PDV não empurra nenhum movimento oficial de estoque de venda/cancelamento: 0
  `saida_venda`/`estorno` recebidos pela nuvem com origem no PDV.
- **SC-005**: Entrada de nota e inventário podem ser concluídos na retaguarda e o saldo resultante
  chega ao PDV; nenhuma dessas funções permanece acessível no PDV.
- **SC-006**: Na tela inicial do PDV, o operador identifica as vendas do turno aberto sem nenhum
  indicador de estoque legado presente.

## Assumptions

- O PDV **permanece offline-first** para abrir turno, vender e cancelar; apenas a **contabilidade** e a
  **edição de cadastros** migram para a nuvem.
- **Entrada de notas** e **inventário** são **removidos por completo** do PDV (inclusive visualização),
  por serem operações de retaguarda; a contagem física de inventário passa a ser registrada na
  retaguarda (viável no balcão graças ao layout responsivo da feature 011-escritório).
- A retaguarda (escritório) já autentica admin e é a superfície natural para receber entrada de notas e
  inventário; **construir essas telas na nuvem faz parte do escopo desta feature** (escopo único — o
  plano pode ordenar as tarefas, mas a remoção do PDV e a construção na nuvem entregam juntas para não
  deixar buraco funcional).
- A **forma de pagamento** continua sendo lida pelo PDV porque é necessária para concluir a venda;
  fornecedor e destinação descem para consulta.
- O ledger legado `movimento_estoque`/`estoque` no PDV é **preservado** (auditoria do ledger antigo),
  mas deixa de alimentar o saldo exibido. Já as tabelas de **entrada** e **inventário**
  (`lancamento_entrada`/`item_lancamento`/`sessao_inventario`/`item_contagem`) são **dropadas** — a
  nuvem passa a ser a dona desses dados/histórico (nada de tabela morta no PDV).
- A **exibição de saldos por destinação no PDV** fica **deferida** (sem consumidor após remover a
  operação de alocação); publica-se se/quando surgir uma tela no PDV que os use. O PDV deixa de
  **operar** a alocação (FR-012); a leitura detalhada por destinação não é requisito do MVP.
- A coexistência temporária de PDVs antigos (não atualizados) é tolerada pela **idempotência** da nuvem
  (nenhuma contabilidade duplicada).

## Dependencies

- Fase 1 (`011-pdv-responsabilidade-reduzida`, ADR-0023) e as migrações `0011`/`0012`/`0013` já em
  produção (estoque oficial, republicação de saldo, incorporação tolerante à ordem de sync).
- Sincronização existente (feature 007) para publicar cadastros e saldo aos PDVs e receber os fatos.
- Retaguarda (feature 008 + 010) como superfície de edição de cadastros, entrada e inventário.
