# Feature Specification: Escritório — cancelar/reabrir venda com estorno fiel e uso no celular

**Feature Branch**: `011-escritorio-cancelamento-responsivo`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "Escritório (nuvem): (1) cancelar e reabrir/clonar venda na lista de vendas, com paridade real do PDV — devolve o estoque por estorno, devolve os carimbos de destinação, respeita a janela de 5 dias e é idempotente (não estorna duas vezes); (2) layout responsivo para uso no celular — a retaguarda hoje é só desktop (sidebar fixa, grids de 3-4 colunas, tabelas largas) e precisa funcionar bem em tela pequena, incluindo a tela de venda/caixa."

## Clarifications

### Session 2026-07-24

- Q: Onde a lógica de cancelamento (estorno + carimbos + marcar cancelado) roda? → A: Numa **RPC transacional na nuvem** (Postgres `SECURITY DEFINER`) — tudo numa transação atômica e idempotente; o Escritório só chama e mostra o resultado.
- Q: Como o cancelamento feito na nuvem reconcilia com as transações que ocorrem no PDV (sync)? → A: A RPC grava nas **mesmas tabelas sincronizadas** que o PDV usa. `pedido.cancelado` converge por **LWW** (recurso mutável); o **estorno de estoque** e a **devolução de carimbo** são **eventos append-only** que descem no pull e recompõem o saldo. A **idempotência vale através do sync**: o estorno tem **identidade determinística por pedido** (mesmo `sync_uid` dos dois lados), então cancelar o mesmo pedido **concorrentemente** no PDV e no Escritório resulta em **um** estorno, nunca dois.
- Q: Como adaptar a retaguarda para o celular? → A: **Adaptar o layout existente** com breakpoints (base única): sidebar vira menu recolhível, grids de 4 colunas reflowam para 1–2, tabelas viram cards no mobile. **Sem telas mobile separadas** — reusa o design system (`@livraria/ui`), desktop e celular na mesma base.

### User Story 1 - Cancelar uma venda pelo Escritório, devolvendo estoque e carimbos (Priority: P1)

Um admin abre a lista de vendas no Escritório, encontra uma venda registrada por engano (ou devolvida
pelo cliente) e a cancela. O sistema **devolve o estoque** dos itens, **devolve os carimbos de
destinação** consumidos pela venda, marca a venda como cancelada (preservando o histórico para
auditoria) e recusa cancelamentos fora da **janela de 5 dias**.

**Why this priority**: É a paridade que falta e a de maior risco: hoje o Escritório **não cancela**, e
qualquer implementação errada corrompe **estoque real e fundos de doação**. É o coração desta feature.

**Independent Test**: Registrar uma venda, cancelá-la pelo Escritório e conferir que o estoque do livro
voltou ao valor anterior, que os carimbos de destinação voltaram, que a venda aparece como cancelada e
que o total do dia desconta essa venda.

**Acceptance Scenarios**:

1. **Given** uma venda de hoje com 2 unidades de um livro, **When** o admin a cancela no Escritório,
   **Then** o estoque do livro volta a subir 2 unidades e a venda fica marcada como **cancelada**
   (some dos totais do dia, mas continua visível no histórico).
2. **Given** uma venda que consumiu carimbos de uma destinação (doação), **When** ela é cancelada,
   **Then** os carimbos voltam para a destinação de origem.
3. **Given** uma venda com **mais de 5 dias**, **When** o admin tenta cancelar, **Then** o sistema
   recusa e explica que a janela de cancelamento expirou.
4. **Given** uma venda **já cancelada**, **When** a operação de cancelar é repetida (clique duplo,
   reenvio), **Then** o estoque e os carimbos **NÃO** são devolvidos de novo (idempotente).
5. **Given** o cancelamento feito no Escritório, **When** o PDV sincronizar, **Then** o PDV reflete a
   venda cancelada e o estoque devolvido — e vice-versa.

---

### User Story 2 - Usar o Escritório no celular (Priority: P1)

Uma pessoa do escritório (ou o dono, fora da loja) abre a retaguarda **no celular** e consegue
trabalhar: navegar pelo menu, consultar livros e vendas, receber mercadoria e **registrar uma venda no
caixa** — sem zoom, sem rolagem horizontal e com alvos de toque confortáveis.

**Why this priority**: Hoje a retaguarda é desenhada só para desktop (menu lateral fixo, grades de 3–4
colunas, tabelas largas). No celular fica inutilizável — e é justamente onde o suporte e o
acompanhamento do dia a dia acontecem.

**Independent Test**: Abrir cada tela principal num aparelho (ou viewport) de celular e completar as
tarefas centrais sem rolagem horizontal e sem precisar dar zoom.

**Acceptance Scenarios**:

1. **Given** um celular em modo retrato, **When** a pessoa abre qualquer tela do Escritório, **Then**
   **não há rolagem horizontal** e todo o conteúdo cabe na largura da tela.
2. **Given** um celular, **When** a pessoa abre o menu, **Then** o menu lateral não ocupa a tela toda de
   forma fixa — ele se recolhe e pode ser aberto/fechado.
3. **Given** um celular, **When** a pessoa abre a **tela de venda/caixa**, **Then** consegue buscar o
   livro, ver o carrinho, informar o pagamento e concluir a venda confortavelmente.
4. **Given** listas e tabelas largas (livros, vendas, lançamentos), **When** vistas no celular,
   **Then** a informação essencial permanece legível (sem cortar dados importantes).
5. **Given** qualquer botão/campo, **When** usado no celular, **Then** o alvo de toque é grande o
   suficiente para ser acionado com o dedo sem erro.

---

### User Story 3 - Reabrir (clonar) uma venda para corrigir (Priority: P2)

O admin encontra uma venda com item ou pagamento errado e escolhe **reabrir**: o sistema **cancela** a
venda original (devolvendo estoque e carimbos) e **reabre uma cópia dela no caixa** do Escritório, já
com os itens carregados, para o admin corrigir e concluir de novo.

**Why this priority**: É o fluxo de correção que o PDV já tem. Depende do cancelamento (US1) estar
correto, por isso vem depois — mas é o que torna a correção prática no dia a dia.

**Independent Test**: Reabrir uma venda, conferir que a original ficou cancelada (estoque devolvido) e
que o caixa abriu com os mesmos itens prontos para edição; concluir a nova venda e conferir os totais.

**Acceptance Scenarios**:

1. **Given** uma venda dentro da janela, **When** o admin escolhe **reabrir**, **Then** a venda original
   é cancelada (estoque e carimbos devolvidos) e o caixa abre com os **mesmos itens** carregados.
2. **Given** a reabertura, **When** o admin conclui a nova venda, **Then** existe **uma** venda válida
   (a nova) e a antiga permanece cancelada no histórico.
3. **Given** o admin desiste após reabrir, **When** ele sai sem concluir, **Then** a venda original
   segue cancelada (o estoque já voltou) e nenhuma venda nova é criada.

---

### Edge Cases

- **Janela expirada**: venda com mais de 5 dias não pode ser cancelada nem reaberta — mensagem clara.
- **Duplo clique / reenvio**: cancelar duas vezes não devolve estoque nem carimbos em dobro.
- **Venda já cancelada**: a ação de cancelar fica indisponível (ou é no-op explícito).
- **Cancelamento concorrente** (PDV e Escritório ao mesmo tempo): o resultado final é **um** estorno,
  não dois.
- **Turno encerrado**: cancelar uma venda de um turno já fechado deve deixar claro o efeito no
  fechamento (o valor esperado do caixa muda).
- **Celular em paisagem** e **tablet**: o layout continua utilizável (não quebra entre os tamanhos).
- **Reabrir sem estoque suficiente**: se o estoque mudou desde a venda, a nova conclusão respeita as
  regras normais de baixa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que um admin **cancele** uma venda a partir da lista de vendas do
  Escritório.
- **FR-002**: O cancelamento DEVE **devolver ao estoque** as quantidades baixadas pela venda, por
  **estorno** (novo lançamento), sem apagar o histórico.
- **FR-003**: O cancelamento DEVE **devolver os carimbos de destinação** consumidos pela venda.
- **FR-004**: O cancelamento DEVE respeitar a **janela de 5 dias** corridos; fora dela, é recusado com
  mensagem clara.
- **FR-005**: O cancelamento DEVE ser **idempotente**, inclusive **através da sincronização**: repetir
  a operação — ou cancelar o mesmo pedido concorrentemente no PDV e no Escritório (offline) — devolve
  estoque e carimbos **uma única vez** (estorno com identidade determinística por pedido).
- **FR-006**: A venda cancelada DEVE permanecer visível no histórico, **marcada como cancelada**, e
  **não** DEVE contar nos totais de venda do período.
- **FR-007**: O sistema DEVE permitir **reabrir** uma venda: cancela a original e abre uma cópia no
  caixa com os mesmos itens, para edição.
- **FR-008**: O resultado do cancelamento/reabertura DEVE **sincronizar** entre Escritório e PDV.
- **FR-009**: Apenas usuários com acesso ao Escritório (perfil admin) DEVEM poder cancelar/reabrir.
- **FR-010**: O Escritório DEVE ser utilizável em **tela de celular** (retrato), sem rolagem horizontal
  e sem necessidade de zoom, em todas as telas principais.
- **FR-011**: A navegação principal DEVE se adaptar ao celular (menu recolhível em vez de barra lateral
  fixa ocupando a tela).
- **FR-012**: A **tela de venda/caixa** DEVE permitir concluir uma venda inteira no celular (busca,
  carrinho, pagamento, conclusão).
- **FR-013**: Listas e tabelas largas DEVEM preservar a informação essencial no celular, sem cortar
  dados relevantes.
- **FR-014**: Alvos de toque (botões, campos, ações de linha) DEVEM ter **pelo menos ~40px** de altura,
  confortáveis para uso com o dedo.
- **FR-015**: O sistema DEVE continuar funcionando bem em **desktop** — a adaptação ao celular não pode
  degradar a experiência atual.
- **FR-016**: A adaptação ao celular DEVE ser feita numa **base única e responsiva** (breakpoints), sem
  telas/rotas duplicadas só para mobile — desktop e celular compartilham os mesmos componentes.

### Key Entities *(include if data involved)*

- **Venda**: registro de venda com itens, pagamentos, turno e estado **cancelada/ativa**. Cancelar não
  remove o registro (auditoria).
- **Movimento de estoque**: lançamento que altera o saldo do livro; o cancelamento gera movimentos de
  **estorno** (devolução), nunca apaga os originais.
- **Carimbo de destinação**: reserva de unidades para uma destinação (doação) consumida pela venda; o
  cancelamento devolve os carimbos à destinação de origem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após cancelar uma venda, o estoque do livro volta **exatamente** ao valor anterior à
  venda (diferença zero).
- **SC-002**: Após cancelar uma venda que consumiu carimbos, o saldo da destinação volta **exatamente**
  ao valor anterior.
- **SC-003**: **100%** das tentativas de cancelar venda com mais de 5 dias são recusadas.
- **SC-004**: Repetir o cancelamento **N** vezes produz o **mesmo** resultado de uma vez (zero estorno
  duplicado).
- **SC-005**: Vendas canceladas somem dos totais do período, mas **100%** delas continuam visíveis no
  histórico.
- **SC-006**: Em tela de celular, **100%** das telas principais são usadas **sem rolagem horizontal**.
- **SC-007**: Uma venda completa (buscar → carrinho → pagamento → concluir) é concluída no celular em
  **menos de 2 minutos**.
- **SC-008**: A experiência de desktop permanece sem regressão (as mesmas tarefas continuam possíveis e
  no mesmo número de passos).

## Assumptions

- **Reusa a regra de cancelamento do domínio** (janela de 5 dias) já existente e compartilhada com o
  PDV — a regra não é reimplementada.
- **O estorno segue o modelo do PDV**: devolve carimbos, gera movimentos de estorno e marca a venda
  como cancelada, nesta ordem, de forma idempotente.
- **Perfil**: só admin acessa o Escritório, logo cancelar/reabrir é implicitamente restrito a admin.
- **Alvo de celular**: telas a partir de ~360 px de largura em retrato; tablets e paisagem continuam
  funcionando por consequência.
- **Sem app nativo**: a adaptação é do layout web da retaguarda (mesma aplicação), não um app novo.
- **Reabrir = cancelar + clonar** (mesmo comportamento do PDV), não uma "edição" da venda original.
- **Fora de escopo**: edição parcial de uma venda concluída (remover só um item) — a correção é por
  reabrir e refazer.

## Dependencies

- **Feature 009** (venda/turno no Escritório) — a lista de vendas e o caixa existem e são a base.
- **Regra de domínio de cancelamento** (janela de 5 dias) e o modelo de estorno/carimbos já usados pelo
  PDV, que devem permanecer **fonte única** da regra.
