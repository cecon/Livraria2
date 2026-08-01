# Feature Specification: PDV — venda vinculada a turno, sync só-sobe e retenção de 45 dias

**Feature Branch**: `013-venda-turno-retencao`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Toda venda no PDV deve ser obrigatoriamente vinculada a um turno. Remover o histórico de vendas de longo prazo do PDV: não manter mais de 45 dias de vendas — o PDV foca nos turnos dele. Não descer mais vendas para o PDV: o ideal é apenas as vendas subirem (push-only). Não descer vendas sem um turno aberto. O histórico completo vive na nuvem/escritório (a nuvem manda, feature 012)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Venda exige turno aberto (Priority: P1)

O operador só consegue registrar uma venda (e um cancelamento) quando há um turno **aberto**. Toda venda nasce vinculada a exatamente esse turno. Sem turno aberto, o PDV orienta a abrir um turno antes de operar.

**Why this priority**: é a base de todo o resto — sem o vínculo obrigatório, "focar nos turnos" e a poda por turno não têm âncora. Também elimina vendas órfãs (sem turno) que hoje podem existir.

**Independent Test**: com o turno fechado, tentar registrar uma venda é bloqueado com orientação clara; ao abrir um turno, a mesma venda é registrada e aparece vinculada àquele turno. Entrega valor sozinha (disciplina operacional) mesmo sem as outras histórias.

**Acceptance Scenarios**:

1. **Given** nenhum turno aberto, **When** o operador tenta registrar uma venda, **Then** o registro é bloqueado e o PDV pede para abrir um turno.
2. **Given** um turno aberto, **When** o operador registra uma venda, **Then** a venda é gravada vinculada àquele turno e entra no total do turno.
3. **Given** um turno aberto, **When** o operador cancela uma venda dentro da janela de 5 dias, **Then** o cancelamento é registrado como fato operacional do turno corrente.
4. **Given** nenhum turno aberto, **When** o operador tenta cancelar uma venda, **Then** o cancelamento é bloqueado até abrir um turno.

---

### User Story 2 - Vendas só sobem: o PDV não baixa mais vendas (Priority: P1)

A sincronização de vendas/cancelamentos passa a ser **unidirecional (só sobe)**: o PDV **envia** os fatos operacionais que produziu (vendas e cancelamentos do próprio aparelho) para a nuvem, mas **não baixa** vendas — nem as suas de volta, nem as de outros PDVs. O PDV nunca importa histórico de vendas.

**Why this priority**: é o que garante que o banco local não acumule vendas alheias/antigas e que o PDV "foque nos turnos dele". Simplifica o fluxo e reduz o risco de corromper dados vindos da nuvem.

**Independent Test**: registrar vendas em dois PDVs distintos; após a sincronização, cada PDV mantém apenas as vendas que ele mesmo produziu (nenhum baixou as do outro), e a nuvem tem as de ambos.

**Acceptance Scenarios**:

1. **Given** o PDV-A produziu vendas e o PDV-B produziu outras, **When** ambos sincronizam, **Then** o PDV-A não passa a conter as vendas do PDV-B (e vice-versa), e a nuvem contém as duas.
2. **Given** uma venda registrada localmente, **When** o PDV sincroniza, **Then** a venda sobe para a nuvem e é marcada como enviada, sem que o PDV baixe qualquer registro de venda em troca.
3. **Given** que a nuvem processou a venda e atualizou o estoque oficial, **When** o PDV sincroniza, **Then** o PDV recebe o **saldo publicado atualizado do livro** (para o saldo operacional) **sem** baixar o registro da venda.

---

### User Story 3 - Retenção de 45 dias: o PDV só guarda o recente (Priority: P2)

O PDV mantém localmente apenas as vendas/turnos dos **últimos 45 dias**. Vendas e turnos mais antigos, **desde que já confirmados na nuvem**, são removidos automaticamente do PDV. O histórico completo permanece na nuvem/escritório.

**Why this priority**: mantém o banco local pequeno e o desempenho estável ao longo do tempo, sem depender de intervenção manual. Depende do vínculo com turno (US1) e combina com o só-sobe (US2) para limitar o crescimento.

**Independent Test**: com dados de vendas/turnos de mais de 45 dias já sincronizados, a poda remove o que é antigo e mantém intactos os últimos 45 dias; nada não-sincronizado é removido.

**Acceptance Scenarios**:

1. **Given** turnos e vendas com mais de 45 dias, todos já sincronizados, **When** a poda executa, **Then** esses turnos e suas vendas são removidos do PDV e os últimos 45 dias permanecem.
2. **Given** uma venda com mais de 45 dias **ainda não sincronizada**, **When** a poda executa, **Then** essa venda é preservada (não é removida até estar confirmada na nuvem).
3. **Given** a poda executou, **When** o operador consulta o saldo operacional e os totais do turno corrente, **Then** os valores continuam corretos (a poda não altera livros nem o saldo publicado).

---

### User Story 4 - PDV focado nos turnos recentes (Priority: P3)

As telas do PDV (início/turno corrente, lista de turnos, relatórios e busca de vendas) operam sobre a janela de até 45 dias. Para qualquer venda mais antiga, o PDV direciona o usuário ao escritório/nuvem, que guarda o histórico completo.

**Why this priority**: alinha a experiência ao novo modelo (o PDV é operação do turno corrente; o histórico longo é do escritório). É refinamento de UX sobre as capacidades das histórias P1/P2.

**Independent Test**: as telas do PDV não oferecem nem retornam vendas com mais de 45 dias; a mensagem de "histórico completo no escritório" aparece quando cabível.

**Acceptance Scenarios**:

1. **Given** vendas de mais de 45 dias existiam, **When** o operador abre relatórios/busca no PDV, **Then** só aparecem resultados dentro da janela de 45 dias.
2. **Given** o operador procura uma venda antiga, **When** ela está fora da janela, **Then** o PDV indica que o histórico completo está no escritório.

---

### Edge Cases

- **Turno esquecido aberto por mais de 45 dias**: um turno ainda aberto (não fechado/não sincronizado) NUNCA é podado, mesmo com data > 45 dias; a poda só alcança turnos fechados e sincronizados.
- **Janela de cancelamento (5 dias) vs retenção (45 dias)**: como 45 > 5, toda venda cancelável (≤5 dias) está sempre presente localmente; a retenção nunca remove uma venda ainda dentro da janela de cancelamento.
- **Cancelar venda de turno já fechado, mas dentro dos 45/5 dias**: permitido enquanto a venda estiver retida e dentro da janela de 5 dias; o cancelamento é fato do turno corrente (aberto).
- **Relógio do dispositivo incorreto**: se a data local estiver adiantada, a poda pode ficar mais agressiva; deve haver salvaguarda para não remover nada não-sincronizado (a confirmação de sync é o gate real, não só a data).
- **Vendas legadas sem turno** (anteriores a esta feature): um **backfill único na nuvem** cria um **turno padrão já fechado e conferido** e vincula todas as vendas órfãs a ele; assim TODA venda — inclusive histórica — passa a respeitar FR-001, sem exceção. O PDV não executa esse backfill (não guarda histórico antigo; ele só sobe suas vendas e a nuvem atribui o turno padrão quando faltar).
- **Cancelamento de venda já sincronizada, sem baixar a venda**: o PDV precisa saber, **localmente**, que aquela venda já subiu (para compensar o saldo operacional ao cancelá-la), já que não baixa mais o registro/estado da venda da nuvem.
- **Poda no meio de um push pendente**: a poda e o envio não podem competir de forma a remover algo antes de confirmado; o gate de "já sincronizado" resolve isso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda venda registrada no PDV MUST estar vinculada a exatamente um turno.
- **FR-002**: O PDV MUST impedir o registro de venda quando não houver turno aberto, orientando o operador a abrir um turno.
- **FR-003**: O cancelamento de venda MUST exigir um turno aberto e ser registrado como fato operacional do turno corrente.
- **FR-004**: A sincronização de vendas e cancelamentos MUST ser **unidirecional para cima** (push): o PDV envia os fatos que produziu e **MUST NOT** baixar registros de venda da nuvem (nem próprios nem de outros PDVs).
- **FR-005**: O PDV MUST continuar recebendo da nuvem o **saldo publicado** do livro (base do saldo operacional) sem baixar os registros de venda.
- **FR-006**: O saldo operacional MUST permanecer correto sem depender de baixar vendas da nuvem, inclusive no cancelamento de uma venda **já sincronizada** — o PDV MUST determinar localmente se uma venda já subiu (fato produzido pelo próprio aparelho), sem puxar o estado da venda de volta.
- **FR-007**: O PDV MUST reter localmente apenas vendas e turnos dos últimos 45 dias.
- **FR-008**: A poda MUST remover **somente** dados já confirmados na nuvem (sincronizados); qualquer venda/turno pendente de envio MUST ser preservado até a confirmação.
- **FR-009**: A poda MUST ser automática e idempotente (sem ação do operador) e MUST remover o agregado completo do que sai da janela (a venda com seus itens, pagamentos e alocações; o turno quando totalmente fora da janela e sincronizado).
- **FR-010**: A retenção MUST ser sempre maior que a janela de cancelamento (nunca remover uma venda ainda cancelável).
- **FR-011**: A poda MUST NOT alterar o catálogo de livros, os saldos publicados nem qualquer dado que não seja histórico de venda/turno.
- **FR-012**: As telas do PDV (turno corrente, turnos, relatórios, busca de vendas) MUST operar sobre a janela de até 45 dias e MUST indicar que o histórico completo vive no escritório para consultas anteriores.
- **FR-013**: O sistema MUST garantir que nenhuma venda produzida no PDV se perca por causa da poda ou do modelo só-sobe (toda venda tem que ter subido antes de ser removível).
- **FR-014**: Toda venda histórica **sem turno** MUST ser vinculada a um **turno padrão criado na nuvem, já fechado e conferido**, de modo que nenhuma venda fique órfã de turno. O backfill MUST ser **único e idempotente** e executado no lado da nuvem (não no PDV). Uma venda que chegue da nuvem/PDV sem turno MUST cair nesse turno padrão.

### Key Entities *(include if feature involves data)*

- **Turno de operação**: unidade de trabalho do PDV (abertura/fechamento, data, operador). Toda venda pertence a um turno. É a âncora da retenção e da obrigatoriedade.
- **Venda (pedido)**: fato operacional produzido no PDV, vinculado a um turno, com estado de envio (produzida localmente → enviada à nuvem → confirmada). Só sobe; nunca é baixada.
- **Cancelamento**: fato operacional que estorna uma venda dentro da janela de 5 dias; pertence ao turno aberto no momento do cancelamento.
- **Turno padrão (histórico)**: turno criado uma única vez na nuvem, já **fechado e conferido**, que recebe todas as vendas históricas sem turno (âncora do backfill — FR-014).
- **Janela de retenção (45 dias)**: limite de idade das vendas/turnos mantidos localmente.
- **Saldo publicado do livro**: estoque oficial calculado pela nuvem e recebido pelo PDV; base do saldo operacional (o único dado de estoque que continua descendo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das vendas novas ficam vinculadas a um turno; zero vendas novas sem turno.
- **SC-002**: Com o turno fechado, o operador não consegue registrar nem cancelar venda (0 operações sem turno aberto).
- **SC-003**: Após a sincronização, um PDV não contém nenhuma venda que ele não produziu (0 vendas "baixadas").
- **SC-004**: Após a poda, o banco local do PDV não contém nenhuma venda/turno sincronizado com mais de 45 dias.
- **SC-005**: A poda nunca remove dado não sincronizado (0 perdas de venda por poda ou por só-sobe).
- **SC-006**: O tamanho do banco local do PDV estabiliza ao longo do tempo (proporcional a ~45 dias de operação), em vez de crescer indefinidamente.
- **SC-007**: O cancelamento dentro de 5 dias continua funcionando 100%, inclusive para venda já sincronizada, com o saldo operacional voltando ao valor correto.
- **SC-008**: O saldo operacional exibido bate com o esperado em todos os fluxos (venda offline, venda sincronizada, cancelamento antes/depois do sync) sem baixar vendas.
- **SC-009**: Após o backfill, **zero vendas na nuvem ficam sem turno** — 100% das vendas históricas passam a apontar para o turno padrão (fechado e conferido).

## Assumptions

- **Granularidade da poda = turno**: a unidade de remoção é o turno fechado e totalmente sincronizado com data > 45 dias, levando junto todas as suas vendas/itens/pagamentos/alocações. (Refinável em `/speckit-clarify`.)
- **"Sincronizado" = confirmado na nuvem** (marcador de envio preenchido no pedido e em suas filhas). O gate real da poda é a confirmação de sync, não apenas a data.
- **Idade medida pela data da venda/turno** (data local ISO). Uma salvaguarda evita poda agressiva por relógio adiantado (nunca remove não-sincronizado).
- **Catálogo e ledger não são histórico de venda**: livros, movimentos de estoque e saldo publicado NÃO são podados; a retenção é só do histórico de vendas/turnos.
- **45 dias é fixo** nesta versão (não configurável).
- **Cancelamento é fato do turno corrente** e pode alvejar vendas retidas dentro da janela de 5 dias.
- **Sinal local de "já subiu"**: como a venda não desce mais, o PDV usa seu próprio estado de envio (fato produzido localmente) para saber se uma venda já foi incorporada na nuvem — necessário para o saldo operacional no cancelamento (reconciliar com o fix atual, que hoje depende do `estoque_status` voltar no pull; ver Dependências).
- **Vendas legadas sem turno** são vinculadas a um **turno padrão na nuvem** (já fechado e conferido) por um backfill único do lado da nuvem — assim TODA venda, inclusive histórica, tem turno (FR-014). O PDV não faz esse backfill (só sobe suas vendas; a nuvem atribui o turno padrão quando faltar).
- A **nuvem/escritório** mantém o histórico completo e é a fonte de verdade (features 007/008/011/012).

## Dependencies

- **Feature 009** (turno de operação): base do vínculo obrigatório e da abertura/fechamento de turno.
- **Feature 007** (sincronização com a nuvem): ORDEM_DEPENDENCIA e marcação de envio; aqui o recurso de venda passa a **push-only**.
- **Features 011/012** ("a nuvem manda" / PDV consumidor): estoque oficial e cadastros na nuvem; o saldo publicado desce, os fatos de venda sobem.
- **Fix de saldo operacional (v26.8.3)**: hoje o `+cancelamento` depende do `estoque_status='incorporada'` voltar no **pull do pedido**. Como esta feature elimina o pull de vendas, o plano MUST substituir esse sinal por um marcador **local** de "venda já enviada/incorporada" (memória `saldo-operacional-estoque-status`). Este é o principal ponto de reconciliação técnica.
- **Feature 010** (usuários/perfis): operador do turno.
