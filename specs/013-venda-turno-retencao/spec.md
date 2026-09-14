# Feature Specification: PDV — venda vinculada a turno, sync só-sobe e retenção de 45 dias

**Feature Branch**: `013-venda-turno-retencao`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Toda venda no PDV deve ser obrigatoriamente vinculada a um turno. Remover o histórico de vendas de longo prazo do PDV: não manter mais de 45 dias de vendas — o PDV foca nos turnos dele. Não descer mais vendas para o PDV: o ideal é apenas as vendas subirem (push-only). Não descer vendas sem um turno aberto. O histórico completo vive na nuvem/escritório (a nuvem manda, feature 012)."

## Clarifications

### Session 2026-08-01

- Q: Ao cancelar uma venda de um turno já fechado/conferido, qual turno registra o estorno? → A: **Não pode** — venda de turno fechado NÃO pode ser cancelada no PDV. O cancelamento vale somente para vendas do **turno aberto**; correção de venda de turno anterior é feita no escritório/nuvem. (Supera a janela de 5 dias no nível do PDV.)
- Q: A poda de 45 dias remove em qual granularidade? → A: **Por turno inteiro** (turno fechado + sincronizado + com data > 45 dias, levando junto todas as suas vendas).
- Q: O turno padrão do backfill de vendas históricas sem turno é único ou por PDV/loja? → A: **Um único turno padrão global** na nuvem.
- Decisão: A **numeração de vendas reinicia em 1 a cada turno** (Pedido Nº sequencial dentro do turno; identidade da venda = turno + número). (FR-016)
- Decisão: A **identidade do turno inclui o nome da máquina** (PDV) + o usuário que abriu; mesmo usuário em outra máquina/nuvem = outro turno (sem colisão no sync). (FR-015)
- Decisão: O PDV tem **um único turno aberto por vez**; quem logar continua no turno aberto, e só abre um novo após fechar o atual. (FR-017)
- Decisão: A poda de 45 dias é **só no PDV**; a **nuvem retém tudo** permanentemente. (FR-011a)
- Decisão: O **escritório/nuvem** deve poder ver todos os turnos (abertos/fechados) a qualquer momento; a abertura de turno sobe para a nuvem. (FR-018)
- Decisão: O PDV só poda turnos/vendas **já encerrados**; turno aberto (e suas vendas) fica até ser fechado, não importa a idade. (FR-008)
- Decisão: Um turno pode ser **fechado pela nuvem**; o fechamento **desce** e encerra o turno no PDV. Vendas são só-sobe, mas o estado do turno pode descer. (FR-019)
- Decisão: O **cabeçalho do PDV** mostra sempre o **PC + operador do turno aberto**; o cabeçalho do escritório mostra "escritório". (FR-021)
- Q: Quem pode fechar um turno pela nuvem? → A: **Qualquer usuário do escritório**. (FR-019)
- Q: Como tratar o "turno esquecido" aberto? → A: **Avisa, mas não fecha** — passando da virada do dia, o PDV alerta o operador a fechar/conferir, mas nunca auto-fecha. (FR-023)
- Q: Se a nuvem fecha o turno e o PDV ainda tem vendas não sincronizadas dele? → A: O PDV **cria um novo turno** e move as vendas pendentes para ele; o turno fechado permanece fechado; nenhuma venda é perdida. (FR-024)
- Decisão: Sem turno aberto, a **janela de venda bloqueia de forma incisiva** (não exibe a UI de venda; não é um aviso dispensável) e a **lista de vendas mostra só o turno aberto**. (FR-002/FR-022)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Venda exige turno aberto (Priority: P1)

O operador só consegue registrar uma venda (e um cancelamento) quando há um turno **aberto**. Toda venda nasce vinculada a exatamente esse turno. Sem turno aberto, o PDV orienta a abrir um turno antes de operar.

**Why this priority**: é a base de todo o resto — sem o vínculo obrigatório, "focar nos turnos" e a poda por turno não têm âncora. Também elimina vendas órfãs (sem turno) que hoje podem existir.

**Independent Test**: com o turno fechado, tentar registrar uma venda é bloqueado com orientação clara; ao abrir um turno, a mesma venda é registrada e aparece vinculada àquele turno. Entrega valor sozinha (disciplina operacional) mesmo sem as outras histórias.

**Acceptance Scenarios**:

1. **Given** nenhum turno aberto, **When** o operador tenta registrar uma venda, **Then** o registro é bloqueado e o PDV pede para abrir um turno.
2. **Given** um turno aberto, **When** o operador registra uma venda, **Then** a venda é gravada vinculada àquele turno e entra no total do turno.
2a. **Given** nenhum turno aberto, **When** o operador abre a janela de venda, **Then** a interface de venda **não aparece** — surge um bloqueio incisivo chamando para abrir um turno (não um aviso discreto).
3. **Given** um turno aberto, **When** o operador cancela uma venda **daquele mesmo turno**, **Then** o cancelamento é registrado no turno aberto.
4. **Given** uma venda de um turno **já fechado**, **When** o operador tenta cancelá-la no PDV, **Then** o cancelamento é bloqueado (correção fica para o escritório).
5. **Given** nenhum turno aberto, **When** o operador tenta cancelar uma venda, **Then** o cancelamento é bloqueado até abrir um turno.

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
3. **Given** um turno aberto com vendas, **When** o operador abre a tela inicial, **Then** vê as vendas do turno no mesmo formato da lista do relatório, atualizando conforme novas vendas/cancelamentos.

---

### User Story 5 - Turno único por máquina e numeração de venda por turno (Priority: P2)

Cada turno pertence a uma **máquina (PDV) específica**: sua identidade inclui o **nome da máquina** onde foi aberto, além do **usuário que o abriu**. O mesmo usuário abrindo turno em outro PDV (ou na nuvem) gera um turno **distinto** — nunca colidem, inclusive ao sincronizar. O PDV mantém **um único turno aberto por vez**: quem logar continua no turno já aberto; para abrir um novo, fecha o atual primeiro. Dentro de cada turno, a **numeração de vendas reinicia em 1** (Pedido Nº 1, 2, 3…).

**Why this priority**: garante a unicidade do PDV no modelo só-sobe (dois PDVs nunca produzem o mesmo identificador de turno, evitando colisão no push) e dá ao operador a numeração limpa por turno que ele espera no balcão.

**Independent Test**: abrir turnos do mesmo usuário em duas máquinas diferentes gera dois turnos distintos na nuvem; as vendas de um turno saem numeradas 1, 2, 3…; ao abrir um novo turno, a numeração volta a 1.

**Acceptance Scenarios**:

1. **Given** o usuário X na máquina A, **When** abre um turno, **Then** a identidade do turno inclui o nome da máquina A (além do usuário X).
2. **Given** o mesmo usuário X abre um turno na máquina B (ou na nuvem), **When** ambos sincronizam, **Then** são dois turnos distintos na nuvem (não colidem).
3. **Given** um turno aberto e vazio, **When** a 1ª venda é registrada, **Then** ela recebe o Nº 1; a próxima, Nº 2; e assim por diante.
4. **Given** um novo turno é aberto, **When** a 1ª venda daquele turno é registrada, **Then** a numeração reinicia em 1 (independe dos turnos anteriores).
5. **Given** um turno aberto por X, **When** o usuário Y loga no mesmo PDV, **Then** Y opera no MESMO turno aberto (não abre outro); para abrir um turno em seu nome, Y precisa fechar o atual antes.

---

### User Story 6 - Escritório enxerga os turnos na nuvem (Priority: P3)

No escritório/nuvem, o gestor consegue ver **a qualquer momento** todos os turnos — **abertos e fechados** — de todos os PDVs, com máquina, usuário que abriu, status, período e totais. Assim dá para acompanhar a operação em tempo (quase) real e auditar o histórico.

**Why this priority**: dá visibilidade e controle central sem depender de olhar cada PDV; complementa o modelo "a nuvem manda". É valor de retaguarda, por isso P3 (não bloqueia a operação do balcão).

**Independent Test**: com turnos abertos em um ou mais PDVs, o escritório lista todos com o status correto (aberto/fechado) e seus dados; ao fechar um turno no PDV, o escritório reflete o fechamento após o sync.

**Acceptance Scenarios**:

1. **Given** um turno aberto num PDV, **When** o gestor abre a visão de turnos no escritório, **Then** o turno aparece como **aberto**, com máquina, usuário e totais.
2. **Given** um turno foi fechado no PDV e sincronizado, **When** o gestor consulta o escritório, **Then** o turno aparece como **fechado**, com o resultado do fechamento.
3. **Given** vários PDVs operando, **When** o gestor abre a visão de turnos, **Then** vê os turnos de todos os PDVs distinguíveis por máquina/usuário.
4. **Given** um turno aberto num PDV, **When** o gestor o fecha pela nuvem, **Then** após o sync o PDV reflete o fechamento (o turno deixa de estar aberto e o operador precisa abrir um novo para vender).
5. **Given** o gestor fecha um turno pela nuvem e o PDV ainda tinha vendas não sincronizadas dele, **When** o fechamento chega ao PDV, **Then** o PDV cria um novo turno com essas vendas pendentes (o turno fechado não muda; nenhuma venda se perde).

---

### Edge Cases

- **Turno esquecido aberto**: passando da virada do dia, o PDV **avisa** para fechar/conferir (FR-023), mas nunca auto-fecha. Enquanto aberto, o turno (e suas vendas) NUNCA é podado, mesmo com data > 45 dias; a poda só alcança turnos fechados e sincronizados.
- **Fechamento (nuvem) com vendas pendentes no PDV**: o turno fechado permanece fechado; o PDV cria um **novo turno** e move para ele as vendas ainda não sincronizadas (FR-024) — nenhuma venda se perde.
- **Cancelamento restrito ao turno aberto**: só se cancela venda do turno atualmente aberto; venda de turno fechado não é cancelável no PDV (correção no escritório). Como turnos abertos nunca são podados, nunca se perde uma venda cancelável.
- **Poda é só local**: a remoção de 45 dias acontece apenas no banco do PDV; a nuvem mantém tudo. Sincronizar depois da poda NÃO reimporta as vendas removidas (venda é push-only, não desce).
- **Relógio do dispositivo incorreto**: se a data local estiver adiantada, a poda pode ficar mais agressiva; deve haver salvaguarda para não remover nada não-sincronizado (a confirmação de sync é o gate real, não só a data).
- **Vendas legadas sem turno** (anteriores a esta feature): um **backfill único na nuvem** cria um **turno padrão já fechado e conferido** e vincula todas as vendas órfãs a ele; assim TODA venda — inclusive histórica — passa a respeitar FR-001, sem exceção. O PDV não executa esse backfill (não guarda histórico antigo; ele só sobe suas vendas e a nuvem atribui o turno padrão quando faltar).
- **Cancelamento de venda já sincronizada, sem baixar a venda**: o PDV precisa saber, **localmente**, que aquela venda já subiu (para compensar o saldo operacional ao cancelá-la), já que não baixa mais o registro/estado da venda da nuvem.
- **Poda no meio de um push pendente**: a poda e o envio não podem competir de forma a remover algo antes de confirmado; o gate de "já sincronizado" resolve isso.
- **Número de venda não é único global**: como reinicia por turno (FR-016), buscas/relatórios que hoje assumem número único MUST passar a usar (turno + número) ou o identificador de sincronização.
- **Máquina sem nome estável / renomeada**: se o identificador da máquina mudar, novos turnos passam a usar o novo nome; turnos antigos mantêm o nome de origem (sem reescrever histórico).
- **Turno aberto ainda não sincronizado**: no escritório o turno só aparece após a abertura subir; antes disso, é invisível na nuvem (aceitável — visibilidade é quase-tempo-real, não instantânea offline).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda venda registrada no PDV MUST estar vinculada a exatamente um turno.
- **FR-002**: O PDV MUST impedir o registro de venda quando não houver turno aberto. Sem turno aberto, a **janela de venda MUST NÃO exibir a interface de venda** — no lugar, um **bloqueio incisivo** (chamada clara e destacada para abrir um turno), **não** um aviso dispensável/discreto. Vender só fica disponível com um turno aberto.
- **FR-003**: O cancelamento de venda no PDV MUST ser permitido **apenas para vendas do turno aberto**. Venda de um turno já fechado MUST NOT ser cancelável no PDV (a correção é feita no escritório/nuvem). Isso supera a janela de 5 dias no nível do PDV.
- **FR-004**: A sincronização de **vendas e cancelamentos** MUST ser **unidirecional para cima** (push): o PDV envia os fatos que produziu e **MUST NOT** baixar registros de venda da nuvem (nem próprios nem de outros PDVs). (Isso se aplica às vendas; o **estado do turno** pode descer — ver FR-019.)
- **FR-005**: O PDV MUST continuar recebendo da nuvem o **saldo publicado** do livro (base do saldo operacional) sem baixar os registros de venda.
- **FR-006**: O saldo operacional MUST permanecer correto sem depender de baixar vendas da nuvem, inclusive no cancelamento de uma venda **já sincronizada** — o PDV MUST determinar localmente se uma venda já subiu (fato produzido pelo próprio aparelho), sem puxar o estado da venda de volta.
- **FR-007**: O PDV MUST reter localmente apenas vendas e turnos **encerrados** dos últimos 45 dias (o turno aberto e suas vendas ficam sempre, ver FR-008).
- **FR-008**: A poda MUST remover **somente** dados já confirmados na nuvem (sincronizados) **e já ENCERRADOS**. Turnos **abertos** (e suas vendas) MUST permanecer no PDV até serem fechados, **independentemente da idade** (nunca são podados enquanto abertos). Qualquer venda/turno pendente de envio MUST ser preservado até a confirmação.
- **FR-009**: A poda MUST ser automática e idempotente (sem ação do operador) e MUST remover o agregado completo do que sai da janela (a venda com seus itens, pagamentos e alocações; o turno quando totalmente fora da janela e sincronizado).
- **FR-010**: A poda MUST NUNCA remover uma venda ainda cancelável. Como só é cancelável a venda do turno aberto (FR-003) e turnos abertos nunca são podados, essa garantia é inerente.
- **FR-011**: A poda MUST NOT alterar o catálogo de livros, os saldos publicados nem qualquer dado que não seja histórico de venda/turno.
- **FR-011a**: A poda de 45 dias é **exclusivamente local (no PDV)**. A nuvem/escritório MUST reter **todas** as vendas e turnos permanentemente — nada é removido da nuvem por esta feature. A remoção local nunca dispara remoção na nuvem.
- **FR-012**: As telas do PDV (turno corrente, turnos, relatórios, busca de vendas) MUST operar sobre a janela de até 45 dias e MUST indicar que o histórico completo vive no escritório para consultas anteriores.
- **FR-013**: O sistema MUST garantir que nenhuma venda produzida no PDV se perca por causa da poda ou do modelo só-sobe (toda venda tem que ter subido antes de ser removível).
- **FR-014**: Toda venda histórica **sem turno** MUST ser vinculada a **um único turno padrão global**, criado na nuvem, já **fechado e conferido**, de modo que nenhuma venda fique órfã de turno. O backfill MUST ser **único e idempotente** e executado no lado da nuvem (não no PDV). Uma venda que chegue da nuvem/PDV sem turno MUST cair nesse turno padrão global.
- **FR-015**: A identidade de um turno MUST incluir o **nome da máquina (unidade PDV)** onde foi aberto, além do usuário e do momento de abertura. Turnos abertos em máquinas diferentes (ou na nuvem) pelo mesmo usuário MUST ser sempre distintos e MUST NOT colidir na sincronização.
- **FR-016**: A numeração de vendas (Pedido Nº) MUST **reiniciar em 1 a cada turno** e ser sequencial **dentro** do turno. A identidade global de uma venda passa a ser **(turno + número)**; o número isolado MUST NOT ser tratado como único entre turnos.
- **FR-017**: O PDV MUST permitir **no máximo um turno aberto por vez** (por máquina). Ao entrar/logar com um turno já aberto, qualquer operador MUST **continuar no mesmo turno aberto** — não abre um turno paralelo. Para abrir um novo turno (em seu nome), o operador MUST primeiro **fechar** o turno atual. O turno registra o operador que o **abriu**; cada venda registra o operador que a fez.
- **FR-018**: A nuvem/escritório MUST permitir visualizar, **a qualquer momento**, todos os turnos (**abertos e fechados**) de todos os PDVs, com máquina, usuário que abriu, status, período e totais. A abertura de turno MUST subir para a nuvem para que o turno apareça como aberto (não só no fechamento).
- **FR-019**: **Qualquer usuário do escritório** MUST poder **fechar um turno** pela nuvem; esse fechamento MUST **propagar para o PDV** (o turno aberto no PDV passa a fechado, liberando a abertura de um novo). Ou seja: as **vendas** são só-sobe (FR-004), mas o **estado do turno** (fechamento) pode **descer** da nuvem para o PDV.
- **FR-020**: Após um fechamento (local ou vindo da nuvem) e a confirmação de sync, o turno encerrado torna-se elegível à poda local pela regra de 45 dias (FR-007/FR-008).
- **FR-021**: O PDV MUST exibir **sempre**, no cabeçalho, o **nome da máquina (PC)** e o **operador do turno aberto**. Sem turno aberto, o cabeçalho MUST indicar claramente que não há turno aberto. (O cabeçalho do escritório exibe "escritório" como identidade.)
- **FR-022**: A **tela inicial** do PDV MUST mostrar **apenas** as vendas do **turno aberto** (nenhuma venda de outros turnos), no **mesmo formato da lista de vendas do relatório**, atualizando em tempo real conforme novas vendas/cancelamentos ocorrem no turno. Sem turno aberto, a lista fica vazia e orienta a abrir um turno.
- **FR-023**: O PDV MUST **alertar** o operador para fechar/conferir um turno que continua aberto **após a virada do dia**, mas MUST NOT fechá-lo automaticamente (o fechamento exige conferência de caixa e é sempre manual ou pela nuvem).
- **FR-024**: Se um turno for fechado (ex.: pela nuvem) enquanto o PDV ainda tem **vendas não sincronizadas** vinculadas a ele, o PDV MUST **criar um novo turno** e mover essas vendas pendentes para ele. O turno fechado MUST permanecer fechado; **nenhuma venda pode ser perdida** por causa do fechamento.

### Key Entities *(include if feature involves data)*

- **Turno de operação**: unidade de trabalho do PDV. Identificado por **máquina (PDV) + usuário + abertura** (por isso é único entre PDVs/nuvem — FR-015). Tem estado aberto/fechado e data. Toda venda pertence a um turno; é a âncora da obrigatoriedade e da retenção.
- **Venda (pedido)**: fato operacional produzido no PDV, vinculado a um turno, com **número sequencial dentro do turno** (reinicia em 1 — FR-016) e estado de envio (produzida → enviada → confirmada). Só sobe; nunca é baixada.
- **Cancelamento**: fato operacional que estorna uma venda **do turno aberto**; venda de turno fechado não é cancelável no PDV.
- **Turno padrão global (histórico)**: único turno na nuvem, já **fechado e conferido**, que ancora todas as vendas históricas sem turno (âncora do backfill — FR-014).
- **Janela de retenção (45 dias)**: limite de idade das vendas/turnos mantidos **localmente** (a nuvem retém tudo).
- **Saldo publicado do livro**: estoque oficial calculado pela nuvem e recebido pelo PDV; base do saldo operacional (o único dado de estoque que continua descendo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das vendas novas ficam vinculadas a um turno; zero vendas novas sem turno.
- **SC-002**: Com o turno fechado, o operador não consegue registrar nem cancelar venda (0 operações sem turno aberto).
- **SC-003**: Após a sincronização, um PDV não contém nenhuma venda que ele não produziu (0 vendas "baixadas").
- **SC-004**: Após a poda, o banco local do PDV não contém nenhuma venda/turno sincronizado com mais de 45 dias.
- **SC-005**: A poda nunca remove dado não sincronizado (0 perdas de venda por poda ou por só-sobe).
- **SC-006**: O tamanho do banco local do PDV estabiliza ao longo do tempo (proporcional a ~45 dias de operação), em vez de crescer indefinidamente.
- **SC-007**: O cancelamento de uma venda **do turno aberto** funciona 100%, inclusive quando a venda já foi sincronizada, com o saldo operacional voltando ao valor correto.
- **SC-008**: O saldo operacional exibido bate com o esperado em todos os fluxos (venda offline, venda sincronizada, cancelamento antes/depois do sync) sem baixar vendas.
- **SC-009**: Após o backfill, **zero vendas na nuvem ficam sem turno** — 100% das vendas históricas passam a apontar para o turno padrão (fechado e conferido).
- **SC-010**: As vendas de um turno são numeradas 1..N; ao abrir um novo turno, a 1ª venda volta a ser Nº 1 (0 casos de numeração contínua entre turnos).
- **SC-011**: Turnos de máquinas/PDVs diferentes (mesmo usuário) nunca colidem na nuvem (0 colisões de identidade de turno após o sync).
- **SC-012**: O escritório consegue listar 100% dos turnos (abertos e fechados) de todos os PDVs, com o status correto, a qualquer momento após o sync da abertura/fechamento.
- **SC-013**: Em cada PDV existe **no máximo um turno aberto** em qualquer instante (0 casos de dois turnos abertos simultâneos).
- **SC-014**: O cabeçalho do PDV mostra sempre o PC e o operador do turno aberto (ou avisa que não há turno) — verificável em 100% das telas operacionais.
- **SC-015**: Um turno fechado pela nuvem aparece como fechado no PDV após o sync (propagação de fechamento em 100% dos casos).
- **SC-016**: Fechamento de turno com vendas pendentes no PDV resulta em 0 vendas perdidas (as pendentes migram para um novo turno).
- **SC-017**: Turno aberto após a virada do dia gera alerta ao operador em 100% dos casos, sem auto-fechamento.

## Assumptions

- **Granularidade da poda = turno** (decidido): a unidade de remoção é o turno fechado e totalmente sincronizado com data > 45 dias, levando junto todas as suas vendas/itens/pagamentos/alocações.
- **Um único turno aberto por PDV**, compartilhado por qualquer operador que logar até ser fechado (FR-017).
- **Nome da máquina = identificador estável do dispositivo** (ex.: hostname do PDV), assumido único por unidade; compõe a identidade do turno (FR-015).
- **Numeração por turno**: o Pedido Nº reinicia em 1 a cada turno; a identidade global da venda é (turno + número) (FR-016). O domínio já tem a primitiva de "próximo número do turno".
- **"Sincronizado" = confirmado na nuvem** (marcador de envio preenchido no pedido e em suas filhas). O gate real da poda é a confirmação de sync, não apenas a data.
- **Idade medida pela data da venda/turno** (data local ISO). Uma salvaguarda evita poda agressiva por relógio adiantado (nunca remove não-sincronizado).
- **Catálogo e ledger não são histórico de venda**: livros, movimentos de estoque e saldo publicado NÃO são podados; a retenção é só do histórico de vendas/turnos.
- **45 dias é fixo** nesta versão (não configurável).
- **Cancelamento restrito ao turno aberto**: só se cancela venda do turno atualmente aberto (isso supera a janela de 5 dias no nível do PDV); a correção de venda de turno já fechado é feita no escritório/nuvem.
- **Sinal local de "já subiu"**: como a venda não desce mais, o PDV usa seu próprio estado de envio (fato produzido localmente) para saber se uma venda já foi incorporada na nuvem — necessário para o saldo operacional no cancelamento (reconciliar com o fix atual, que hoje depende do `estoque_status` voltar no pull; ver Dependências).
- **Vendas legadas sem turno** são vinculadas a um **turno padrão na nuvem** (já fechado e conferido) por um backfill único do lado da nuvem — assim TODA venda, inclusive histórica, tem turno (FR-014). O PDV não faz esse backfill (só sobe suas vendas; a nuvem atribui o turno padrão quando faltar).
- A **nuvem/escritório** mantém o histórico completo e é a fonte de verdade (features 007/008/011/012).

## Dependencies

- **Feature 009** (turno de operação): base do vínculo obrigatório e da abertura/fechamento de turno.
- **Feature 007** (sincronização com a nuvem): ORDEM_DEPENDENCIA e marcação de envio; aqui o recurso de venda passa a **push-only**.
- **Features 011/012** ("a nuvem manda" / PDV consumidor): estoque oficial e cadastros na nuvem; o saldo publicado desce, os fatos de venda sobem.
- **Fix de saldo operacional (v26.8.3)**: hoje o `+cancelamento` depende do `estoque_status='incorporada'` voltar no **pull do pedido**. Como esta feature elimina o pull de vendas, o plano MUST substituir esse sinal por um marcador **local** de "venda já enviada/incorporada" (memória `saldo-operacional-estoque-status`). Este é o principal ponto de reconciliação técnica.
- **Feature 010** (usuários/perfis): operador do turno.
