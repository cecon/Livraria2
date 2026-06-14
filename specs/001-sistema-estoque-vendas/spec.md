# Feature Specification: Sistema de Estoque & Vendas — Livraria 2 (Espaço do Livro)

**Feature Branch**: `001-sistema-estoque-vendas`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "esse projeto tem um template para seguir (zip de design handoff), o projeto é de uma livraria; precisamos de ADRs (SQLite, ORM, migrations sempre geradas via comando e idempotentes), SOLID/Hexagonal, KISS, DRY, máximo 300 linhas por arquivo (exceto comentários, .md e quebras de linha) — rígido para todo arquivo de arquitetura/lógica (ts, js, tsx, rs, css, scss e afins); hooks para proteger essas filosofias e skills para não repetir os mesmos erros."

> **Fonte de design**: o protótipo de alta fidelidade em `docs/design-handoff/` (8 telas, modelo de
> dados, regras de negócio e design tokens) é a referência canônica de aparência e comportamento.
> Esta spec descreve **o que** o sistema entrega e **por quê**; decisões de **como** (stack, ORM,
> camadas) são registradas como ADRs no planejamento (`/speckit-plan`).

## Clarifications

### Session 2026-06-14

- Q: Qual o escopo de migração de dados do sistema legado? → A: Importar o acervo **e** os pedidos
  anteriores do banco **Access legado** em `../Livraria/livraria.mdb` (irmão de `Livraria2/`). O número
  de pedido continua a sequência histórica. *(Inventário do legado: tabela `cadastro` = 503 livros;
  `venda` = 5.109 linhas de vendas históricas — tabela desnormalizada, cada linha é um item e há uma
  linha-resumo "Total do Pedido No. :" por pedido; `usuario` = 5 usuários; `carrinho` = estado transitório,
  descartável.)*
- Q: Incluir preço promocional no produto novo (v1)? → A: **Não** incluir na v1. O legado tem campos de
  promoção (`cdpromocao`/`cdvalorpromo`), mas **0 livros os utilizam** e o redesign já os omitiu; aplica-se
  KISS. A migração ignora os campos de promoção e o PDV usa apenas o preço normal.
- Q: Como importar as ~5.109 vendas históricas, dado que o legado não tem o pagamento dividido confiável?
  → A: **Reconstrução normalizada** (best-effort): cada pedido antigo é mapeado para o modelo novo
  (pedido + itens + valores por forma de pagamento). Como as colunas de valor por forma do legado estão
  majoritariamente zeradas, o split por forma é **derivado** do método registrado por item (`vdmetodo`),
  alocando o total de cada item à forma correspondente; divergências de centavos por dados sujos são
  toleradas e registradas em um relatório de migração.
- Q: A importação é única ou recorrente? → A: **Recorrente e idempotente durante a transição.** Enquanto
  o sistema Access continuar em uso em paralelo, a importação pode ser **re-executada a qualquer momento**
  como um **upsert** (insere o que é novo, atualiza o que mudou no legado), por chave estável (código de
  barras para livros; número do pedido para vendas), **sem duplicar** registros já importados. Assim o
  novo sistema reflete o que foi feito no antigo até o corte definitivo (go-live).

## User Scenarios & Testing *(mandatory)*

O sistema é **gerencial** para uma livraria de igreja (Espaço do Livro — PIB Penha), rodando como
aplicativo **desktop de balcão**, operado por voluntários. **Não há TEF nem emissão de nota fiscal**:
as formas de pagamento apenas registram como a venda foi recebida. O fluxo é **orientado a leitor de
código de barras / teclado**.

### User Story 1 - Registrar uma venda no PDV (Priority: P1)

O voluntário do caixa registra uma venda: escaneia (ou busca) os livros, ajusta quantidades, informa
como o cliente pagou (uma ou mais formas) e conclui o pedido. O estoque dos itens é baixado e o pedido
fica registrado para os relatórios do dia.

**Why this priority**: É a função que gera receita e o motivo principal do sistema existir. Sem ela,
nada mais tem valor operacional.

**Independent Test**: Com ao menos um livro cadastrado, escanear o código, ajustar quantidade, preencher
um pagamento que cubra o total e concluir — verificando que o pedido foi gravado, o estoque baixou pela
quantidade vendida e o próximo número de pedido incrementou.

**Acceptance Scenarios**:

1. **Given** o PDV aberto com foco no campo de código de barras, **When** o operador escaneia um código
   existente e pressiona Enter, **Then** o livro é adicionado à lista com quantidade 1, preço e total.
2. **Given** um item já na lista, **When** o mesmo código é escaneado novamente, **Then** a quantidade
   daquele item é somada (não cria linha duplicada).
3. **Given** itens na lista somando um total, **When** o operador clica "Receber R$ {restante}" em uma
   forma de pagamento, **Then** o campo é preenchido com o valor restante e o "Pago"/"Troco/Restante"
   são recalculados ao vivo.
4. **Given** o pago é maior ou igual ao total, **When** o operador clica "Receber", **Then** o pedido e
   seus itens são gravados, o estoque de cada item é decrementado, exibe-se um toast de sucesso, a tela
   é limpa, o número do pedido incrementa e o foco volta ao código de barras.
5. **Given** a lista de itens vazia, **When** o operador tenta "Receber", **Then** o sistema bloqueia e
   informa que não há itens.
6. **Given** o pago menor que o total, **When** o operador tenta "Receber", **Then** o sistema bloqueia e
   informa quanto falta (ex.: "falta R$ 12,50").
7. **Given** uma linha de item, **When** o operador usa o stepper de quantidade, **Then** a quantidade
   nunca fica abaixo de 1 e os totais recalculam.

---

### User Story 2 - Manter o cadastro de livros (Priority: P1)

O responsável inclui, altera ou exclui livros do acervo a partir do código de barras: se o código já
existe, abre em modo edição com o formulário preenchido; se não existe, abre em modo novo com o código
já preenchido.

**Why this priority**: O PDV e a pesquisa dependem de um acervo cadastrado. É dado fundacional.

**Independent Test**: Digitar um código novo, preencher título/autor/preço/estoque/categoria/descrição,
salvar e confirmar que o livro passa a ser encontrável; reabrir o mesmo código e confirmar modo edição.

**Acceptance Scenarios**:

1. **Given** o campo de código com foco, **When** informo um código inexistente e confirmo, **Then** o
   formulário abre em modo "novo" com o código preenchido e os demais campos em branco.
2. **Given** um código já cadastrado, **When** informo e confirmo, **Then** o formulário abre em modo
   "edição" com os dados atuais carregados.
3. **Given** o formulário preenchido, **When** salvo, **Then** o livro é persistido e aparece em
   "Cadastrados recentemente".
4. **Given** um livro em modo edição, **When** clico "Excluir" e confirmo, **Then** o livro é **inativado**
   (some do PDV e da pesquisa), mas **preservado** para o histórico de vendas e relatórios (soft-delete).
5. **Given** a categoria, **When** seleciono, **Then** as opções são exatamente "id — nome" do enum fixo
   (0 = Não Categorizado … 6 = Ficção).

---

### User Story 3 - Pesquisar o acervo e ver detalhes (Priority: P2)

Um voluntário consulta o acervo por código de barras ou por título/autor para tirar dúvidas de preço,
estoque ou descrição.

**Why this priority**: Suporte direto ao atendimento, mas o sistema entrega valor mesmo antes dela
(venda + cadastro). Útil e frequente, porém não bloqueante.

**Independent Test**: Buscar "biblia" (sem acento) e confirmar que retorna títulos com "Bíblia"; abrir
um resultado e ver capa, preço, estoque, categoria, código e descrição, com botão de copiar o código.

**Acceptance Scenarios**:

1. **Given** uma busca por título/autor, **When** digito um termo sem acentos/caixa, **Then** os
   resultados ignoram acentuação e maiúsculas (ex.: "biblia" encontra "Bíblia").
2. **Given** uma busca, **When** retorna 0 resultados, **Then** exibe-se um aviso de "nada encontrado".
3. **Given** uma busca, **When** retorna exatamente 1 resultado, **Then** abrem-se os detalhes
   diretamente.
4. **Given** a tela de detalhes, **When** clico "Copiar" no código de barras, **Then** o código vai para
   a área de transferência e um toast confirma.

---

### User Story 4 - Visão do dia no Início (Dashboard) (Priority: P2)

Ao abrir o sistema, o operador vê um resumo do dia (vendas, itens vendidos, ticket médio, estoque baixo)
e atalhos para as principais ações.

**Why this priority**: Melhora a ergonomia e dá visibilidade, mas é derivado dos dados de venda/estoque.

**Independent Test**: Após registrar vendas no dia, abrir o Início e conferir que os números (vendas de
hoje, itens vendidos, ticket médio) refletem os pedidos do dia e que "Estoque baixo" lista itens com
estoque ≤ 3 e esgotados.

**Acceptance Scenarios**:

1. **Given** pedidos registrados hoje, **When** abro o Início, **Then** "Vendas de hoje" é a soma dos
   pagamentos do dia e "Itens vendidos" e "Ticket médio" são consistentes com esses pedidos.
2. **Given** livros com estoque baixo, **When** abro o Início, **Then** a lista "Estoque baixo" mostra os
   esgotados primeiro, cada um com o selo de estoque correspondente.

---

### User Story 5 - Emitir relatórios e zerar o caixa (Priority: P2)

Após autenticar, o responsável escolhe e emite relatórios de venda (dia inteiro, turma da manhã, turma da
tarde), relatório de estoque, ou zera o caixa do turno.

**Why this priority**: Fechamento e prestação de contas. Importante no fim do expediente, mas posterior ao
registro das vendas.

**Independent Test**: Selecionar "Relatório dia Inteiro", informar a data e autenticar, e conferir que o
relatório lista itens por pedido, os valores por forma de pagamento e um "Resumo das Vendas" cujo subtotal
(Dinheiro + Cartão + PIX) bate com os pedidos do período.

**Acceptance Scenarios**:

1. **Given** a tela de relatórios, **When** seleciono um tipo, informo data e credenciais e envio, **Then**
   o relatório correspondente é exibido.
2. **Given** um relatório de vendas, **When** é exibido, **Then** os valores por forma de pagamento somados
   reconciliam com os totais dos pedidos do período.
3. **Given** um relatório de estoque, **When** é exibido, **Then** os itens vêm ordenados por estoque
   crescente e o cabeçalho mostra a contagem de títulos e o valor total em estoque.
4. **Given** a opção "Relatório Zerado", **When** confirmo, **Then** os totais do turno são reiniciados e
   exibe-se a confirmação.
5. **Given** qualquer relatório emitido, **When** está na tela, **Then** há ações de "Voltar" e "Imprimir".

---

### User Story 6 - Guardrails de arquitetura para a manutenção (Priority: P2)

A pessoa que mantém o código precisa que as filosofias de engenharia do projeto sejam **aplicadas
automaticamente**, para que o sistema continue simples, evoluível e consistente ao longo do tempo —
sem depender de disciplina manual em cada alteração.

**Why this priority**: É o que protege o investimento no produto. Não entrega função ao usuário final,
mas evita a erosão de qualidade que inviabiliza as demais histórias no médio prazo. O usuário pediu
explicitamente ADRs, hooks e skills.

**Independent Test**: Tentar introduzir um arquivo de lógica (ex.: `.ts`/`.rs`) que ultrapasse o limite
de linhas ou que viole as decisões registradas e confirmar que um guardrail automático bloqueia/avisa
antes de a alteração ser concluída; confirmar que existem ADRs versionados e uma skill que registra o
erro evitado.

**Acceptance Scenarios**:

1. **Given** as decisões de arquitetura, **When** o projeto é inicializado/planejado, **Then** existe um
   conjunto de **ADRs** versionados cobrindo, no mínimo: persistência em SQLite; escolha de ORM/camada de
   dados; estratégia de migrations (geradas via comando, idempotentes); arquitetura Hexagonal + SOLID;
   limite de 300 linhas por arquivo de arquitetura/lógica; e a adoção de hooks + skills como guardrails.
2. **Given** um arquivo de arquitetura/lógica (`.ts`, `.tsx`, `.js`, `.jsx`, `.rs`, `.css`, `.scss` e
   afins), **When** ele excede 300 linhas contando apenas linhas significativas (exclui comentários,
   linhas em branco e arquivos `.md`), **Then** um guardrail automático sinaliza a violação.
3. **Given** uma migration, **When** é (re)aplicada sobre um banco já migrado, **Then** o resultado é
   idempotente: não falha e não duplica efeitos.
4. **Given** um erro/decisão recorrente identificado durante o desenvolvimento, **When** ele é resolvido,
   **Then** o aprendizado é capturado em uma **skill** para que o mesmo erro não se repita.

---

### Edge Cases

- **Código não encontrado no PDV/Cadastro/Pesquisa**: o sistema avisa de forma clara e mantém o foco no
  campo de código (sem travar o fluxo do leitor de código de barras).
- **Venda que zera o estoque**: ao receber, se a quantidade vendida atinge ou ultrapassa o disponível, o
  estoque resultante não fica negativo e o item passa a refletir o selo "Esgotado". *(Política de venda
  acima do estoque registrada em Assumptions.)*
- **Pagamento dividido em várias formas**: o "Pago" é a soma de todas as formas; sobra vira "Troco" (verde)
  e falta vira "Restante" (amber).
- **Troco em formas não-monetárias**: pagamento em Ministério/Vale Presente acima do total — tratamento de
  troco documentado em Assumptions.
- **Entrada decimal com vírgula**: valores aceitam vírgula como separador decimal (pt-BR).
- **Snapshot de venda**: alterar preço/título de um livro depois não muda pedidos já gravados (o item
  guarda título e preço do momento da venda).
- **Turno no limite do horário**: vendas próximas da virada manhã→tarde são classificadas pelo horário de
  conclusão (corte ~13h).
- **Reaplicar migration / banco novo vs. existente**: a inicialização do banco funciona tanto em base nova
  quanto em base já existente, sem perda de dados.

## Requirements *(mandatory)*

### Functional Requirements — Acervo / Cadastro

- **FR-001**: O sistema MUST permitir cadastrar, alterar e excluir livros identificados por código de
  barras (EAN-13). A exclusão é um **soft-delete** (inativação): o livro deixa de aparecer no PDV e na
  pesquisa, mas é preservado para a integridade do histórico de vendas (ver data-model).
- **FR-002**: O sistema MUST, ao receber um código de barras, abrir o cadastro em modo "edição" quando o
  código já existe e em modo "novo" (com o código preenchido) quando não existe.
- **FR-003**: Cada livro MUST conter: código, título, autor (opcional), preço, categoria, estoque e
  descrição (opcional).
- **FR-004**: A categoria MUST usar o enumerado fixo e preservado: 0 Não Categorizado · 1 Bíblias ·
  2 Infantil · 3 Família · 4 Devocional · 5 Estudo & Teologia · 6 Ficção.
- **FR-005**: O sistema MUST exibir os últimos livros cadastrados/alterados como atalhos clicáveis.

### Functional Requirements — Venda / PDV

- **FR-010**: O sistema MUST permitir adicionar itens à venda por leitura de código de barras (Enter
  confirma) e por busca de título/autor com seleção em dropdown.
- **FR-011**: O sistema MUST somar a quantidade quando o mesmo livro é adicionado novamente, em vez de
  criar linha duplicada, e MUST impedir quantidade menor que 1.
- **FR-012**: O sistema MUST calcular ao vivo: total do pedido, pago (soma das formas de pagamento),
  restante = max(0, total − pago) e troco = max(0, pago − total).
- **FR-013**: O sistema MUST oferecer exatamente as formas de pagamento, nesta ordem e rótulos: Cartão ·
  Dinheiro · PIX · Ministério · Vale Presente; e MUST permitir "Receber o restante" em cada forma.
- **FR-014**: O sistema MUST bloquear a conclusão quando não há itens, ou quando o pago é menor que o
  total, informando quanto falta.
- **FR-015**: Ao concluir ("Receber"), o sistema MUST gravar o pedido e seus itens, decrementar o estoque
  de cada livro pela quantidade vendida, atribuir o próximo número de pedido (MAX(numero)+1), registrar o
  turno (manhã/tarde) derivado do horário, limpar a tela e devolver o foco ao campo de código.
- **FR-016**: Cada item de pedido MUST guardar um snapshot do título e do preço no momento da venda.
- **FR-017**: O número de pedido MUST ser sequencial e contínuo entre execuções (não reinicia ao reabrir
  o app).
- **FR-018**: O sistema MUST permitir um nome de cliente por pedido, com valor padrão "CLIENTE".

### Functional Requirements — Pesquisa / Detalhes

- **FR-020**: O sistema MUST permitir pesquisar por código de barras e por título/autor.
- **FR-021**: A busca textual MUST ser insensível a acentuação e a maiúsculas/minúsculas.
- **FR-022**: O sistema MUST abrir os detalhes diretamente quando a busca retorna exatamente 1 resultado e
  avisar quando retorna 0.
- **FR-023**: A tela de detalhes MUST exibir capa, título, autor, preço, selo de estoque, categoria,
  estoque, código (com ação de copiar) e descrição.

### Functional Requirements — Início / Dashboard

- **FR-030**: O Início MUST exibir indicadores do dia: vendas de hoje (soma dos pagamentos), itens
  vendidos, ticket médio e contagem de estoque baixo (≤ 3 + esgotados).
- **FR-031**: O Início MUST listar itens de estoque baixo, exibindo os esgotados primeiro, cada um com seu
  selo de estoque, e oferecer atalhos para as ações principais (Nova Venda, Cadastrar, Pesquisar,
  Relatórios).

### Functional Requirements — Relatórios

- **FR-040**: O sistema MUST exigir autenticação (usuário/senha) antes de emitir relatórios.
- **FR-041**: O sistema MUST oferecer relatórios de venda por período: dia inteiro, turma da manhã e turma
  da tarde, filtrados por data.
- **FR-042**: O relatório de vendas MUST detalhar itens por pedido, os valores por forma de pagamento por
  pedido e um "Resumo das Vendas" com totais por forma e o subtotal (Dinheiro + Cartão + PIX).
- **FR-043**: O relatório de estoque MUST listar os livros ordenados por estoque crescente e exibir, no
  cabeçalho, a contagem de títulos e o valor total em estoque.
- **FR-044**: O sistema MUST permitir zerar o caixa do turno, com confirmação, reiniciando os totais do
  turno.
- **FR-045**: Todo relatório emitido MUST oferecer "Voltar" e "Imprimir".

### Functional Requirements — Apresentação / Comportamento

- **FR-050**: Valores monetários MUST ser exibidos em pt-BR com 2 casas (ex.: R$ 1.234,56) e os campos de
  valor MUST aceitar vírgula como separador decimal.
- **FR-051**: Os selos de estoque MUST seguir: estoque ≤ 0 → "Esgotado"; ≤ 3 → baixo (alerta); senão →
  normal.
- **FR-052**: As telas de Venda e Cadastro MUST manter foco automático no campo de código de barras e
  confirmar com Enter.
- **FR-053**: O sistema MUST oferecer tema claro/escuro com persistência da preferência.
- **FR-054**: A interface MUST preservar os rótulos e termos do domínio exatamente (Ministério, Vale
  Presente, Turma da Manhã/Tarde, "Pedido Nº", "0 = Não Categorizado").

### Functional Requirements — Dados / Persistência

- **FR-060**: Os dados MUST ser persistidos localmente e sobreviver ao fechamento do aplicativo (sem
  dependência de servidor HTTP/rede).
- **FR-061**: A inicialização do esquema de dados MUST ser **idempotente** e aplicada via **comando**
  (não manual): rodar em base nova ou já existente produz o mesmo estado final sem erro e sem duplicar
  efeitos, e sem perder dados existentes.
- **FR-062**: O sistema MUST manter integridade entre pedidos, itens de pedido e livros (um item de pedido
  referencia um livro e um pedido válidos).

### Functional Requirements — Migração / Sincronização do Legado (Access)

> Importação **recorrente e idempotente** a partir de `../Livraria/livraria.mdb` durante a fase de
> transição (Access e novo sistema convivem). O ETL detalhado, o mapeamento campo-a-campo e o mapeamento
> de `vdmetodo`→forma de pagamento são registrados em ADR/artefato de migração no `/speckit-plan`.

- **FR-065**: O sistema MUST importar o acervo da tabela legada `cadastro` (≈503 livros), mapeando código
  de barras, título, autor, preço, estoque, descrição e categoria.
- **FR-066**: A categoria legada (texto livre) MUST ser convertida para o enum fixo 0–6: valores numéricos
  "0".."6" mapeiam diretamente; valores vazios ou não-numéricos (ex.: nomes de autor) MUST cair em
  0 (Não Categorizado).
- **FR-067**: O sistema MUST importar as vendas históricas da tabela legada `venda` (≈5.109 linhas) via
  **reconstrução normalizada** para o modelo novo (pedido + itens), a partir das linhas de item e da
  linha-resumo "Total do Pedido No. :", preservando número do pedido, data, cliente, turno e itens (com
  snapshot de título/preço/qtd).
- **FR-067a**: Os valores por forma de pagamento (Cartão, Dinheiro, PIX, Ministério, Vale Presente) de um
  pedido histórico MUST ser **derivados** do método registrado por item (`vdmetodo`) quando as colunas de
  valor por forma do legado estiverem ausentes/zeradas, alocando o total de cada item à forma
  correspondente. O split derivado **MUST somar exatamente o total do pedido** (reconciliação por pedido =
  R$ 0,00). Quando, no legado, o somatório dos itens diverge do total-resumo do pedido, o pedido é
  **sinalizado no relatório de migração** e o total-resumo do legado prevalece como fonte de verdade.
- **FR-068**: A sequência de número de pedido após a importação MUST continuar a partir do maior número
  histórico importado (sem colidir nem reiniciar).
- **FR-069**: A importação MUST ser **idempotente e re-executável a qualquer momento** durante a transição:
  opera como **upsert** por chave estável (código de barras para livros; número do pedido para vendas),
  **inserindo** registros novos e **atualizando** os que mudaram no legado, **sem duplicar** o que já foi
  importado. Re-executar não altera registros inalterados.
- **FR-069a**: A importação MUST preservar dados criados diretamente no novo sistema (não sobrescrever nem
  apagar registros que não vieram do legado), de modo que os dois sistemas possam conviver na transição.

### Functional Requirements — Governança de Engenharia (Guardrails)

> Requisitos voltados à manutenibilidade. As **decisões** correspondentes são registradas como ADRs no
> planejamento; aqui ficam apenas como requisitos verificáveis.

- **FR-070**: O projeto MUST registrar como ADRs versionados as decisões de: (a) persistência em SQLite;
  (b) camada de dados/ORM; (c) migrations geradas via comando e idempotentes; (d) arquitetura Hexagonal
  (ports & adapters) sob princípios SOLID; (e) limite de 300 linhas por arquivo de arquitetura/lógica;
  (f) uso de hooks e skills como guardrails. Cada ADR registra contexto, decisão e consequências.
- **FR-071**: Arquivos de arquitetura/lógica (incluindo `.ts`, `.tsx`, `.js`, `.jsx`, `.rs`, `.css`,
  `.scss` e equivalentes) MUST respeitar o limite de **300 linhas significativas** por arquivo,
  **excluindo** comentários, linhas em branco e arquivos de documentação (`.md`).
- **FR-072**: O limite de tamanho e as demais filosofias (KISS, DRY, separação por camadas) MUST ser
  protegidos por **hooks automáticos** que sinalizam/bloqueiam violações no momento da alteração, sem
  depender de verificação manual.
- **FR-073**: Aprendizados e erros recorrentes resolvidos durante o desenvolvimento MUST ser capturados
  como **skills** reutilizáveis, para evitar a repetição dos mesmos erros.
- **FR-074**: O código MUST seguir KISS e DRY: lógica de domínio isolada de detalhes de UI e de
  infraestrutura (persistência), de modo que regras de negócio possam ser testadas sem a UI nem o banco.

### Key Entities *(include if feature involves data)*

- **Livro**: item do acervo. Identificado pelo código de barras; possui título, autor, preço, categoria
  (enum fixo), estoque e descrição. Base para venda, pesquisa e relatórios de estoque.
- **Pedido**: uma venda concluída. Possui número sequencial, cliente, turno (manhã/tarde), data, total e
  os valores recebidos por forma de pagamento (Cartão, Dinheiro, PIX, Ministério, Vale Presente).
- **Item de Pedido**: uma linha de um pedido. Referencia um livro e guarda snapshot de título e preço, mais
  a quantidade vendida.
- **Categoria**: enumeração fixa (0–6) usada para classificar livros e nos relatórios.
- **Forma de Pagamento**: dimensão de registro de como a venda foi recebida (apenas registro gerencial —
  sem TEF/fiscal).
- **Decisão de Arquitetura (ADR)**: registro versionado de uma decisão técnica relevante e suas
  consequências, que governa a evolução do código.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um operador consegue registrar uma venda típica (3 itens escaneados + um pagamento) e
  concluí-la em **menos de 60 segundos**, usando majoritariamente o leitor/teclado.
- **SC-002**: **100%** das vendas concluídas decrementam o estoque exatamente pela quantidade vendida e
  geram um número de pedido único e sequencial.
- **SC-003**: Em uma busca textual, **100%** dos termos sem acentuação/caixa encontram os títulos
  correspondentes acentuados (ex.: "biblia" → "Bíblia").
- **SC-004**: Para vendas registradas no **novo sistema** (pós go-live), a soma dos valores por forma de
  pagamento no relatório **reconcilia exatamente** (diferença R$ 0,00) com os totais dos pedidos do
  período. Períodos que incluam vendas migradas do legado seguem a reconciliação por pedido de SC-009.
- **SC-005**: Reaplicar a inicialização/migração do banco sobre uma base já migrada termina **sem erro e
  sem alterar dados** (idempotência verificável).
- **SC-006**: **100%** dos arquivos de arquitetura/lógica versionados respeitam o limite de 300 linhas
  significativas; violações são barradas automaticamente antes de entrar no histórico.
- **SC-007**: As decisões de arquitetura listadas (SQLite, ORM, migrations, Hexagonal/SOLID, limite de
  linhas, hooks+skills) estão **todas** registradas como ADRs antes do início da implementação.
- **SC-008**: Um voluntário novo consegue concluir uma venda completa **sem treinamento formal**, apoiado
  apenas pela interface, na primeira tentativa.
- **SC-009**: Após a migração, **100%** dos livros do legado com código de barras válido estão
  pesquisáveis e vendáveis. O total de **cada pedido migrado reconcilia exatamente** (R$ 0,00) com seu
  total no legado. Pedidos cujo somatório de itens diverge do total-resumo do legado são **sinalizados no
  relatório de migração** (não importados silenciosamente com valor aproximado). Re-executar a migração
  não duplica dados.

## Assumptions

- **Plataforma e operação**: aplicativo **desktop** de balcão, uso **mono-usuário por vez** em uma estação;
  sem necessidade de acesso concorrente simultâneo nem de backend HTTP. Conectividade de rede não é
  requisito de funcionamento.
- **Design**: o protótipo em `docs/design-handoff/` é a referência de alta fidelidade (telas, tokens,
  termos). Os dados de exemplo do protótipo são apenas ilustrativos; em produção tudo vem da base local.
- **Autenticação de relatórios**: gate simples por usuário/senha local (padrão de usuário "adm"), suficiente
  para o contexto da igreja; gestão completa de múltiplos usuários/perfis está **fora do escopo da v1**
  (o item "Cadastro Usuário (Administrador)" fica como ponto de extensão futuro).
- **Venda acima do estoque**: por ser sistema gerencial de balcão, a venda **não é bloqueada** por estoque
  insuficiente; o estoque é decrementado e não fica negativo (piso em 0), refletindo "Esgotado". *(Pode ser
  revisado se o cliente exigir bloqueio rígido.)*
- **Troco**: troco aplica-se naturalmente a Dinheiro; valores em formas não-monetárias (Ministério, Vale
  Presente, PIX, Cartão) são tratados como recebidos pelo valor informado, e o excedente entra no cálculo de
  troco apenas como indicação visual — sem devolução por essas formas.
- **Número de pedido**: continua a sequência histórica importada do legado (ver FR-068) e nunca reinicia
  automaticamente.
- **Migração do legado**: a fonte de verdade é o Access `../Livraria/livraria.mdb` (tabelas `cadastro`,
  `venda`, `usuario`; `carrinho` é descartável). A tentativa anterior em Next.js/Prisma/Postgres na mesma
  pasta é **abandonada** e não é referência. Categorias e métodos de pagamento legados podem conter dados
  sujos; a migração normaliza/sane os dados conforme FR-066/FR-067.
- **Promoção (legado)**: a tabela `cadastro` possui `cdpromocao`/`cdvalorpromo`, mas **fora de escopo na
  v1** (0 livros usam; ver Clarifications). A migração ignora esses campos e o PDV usa só o preço normal.
- **Turno**: corte aproximado às 13h (manhã antes, tarde a partir daí), conforme o horário de conclusão da
  venda.
- **Capas de livro**: não há imagens cadastradas no legado; usa-se um placeholder por iniciais. Upload de
  capa é opcional/futuro.
- **Impressão**: "Imprimir" usa a impressão do sistema (ou exportação) — formatação de impressão é um
  detalhe de implementação a definir no plano.
- **Idioma/Localização**: português do Brasil; moeda e datas em pt-BR.
- **Escolha de ORM/camada de dados e a forma exata dos hooks/skills**: são **decisões de arquitetura** a
  serem fixadas em ADRs durante `/speckit-plan`; esta spec exige que as decisões existam e suas propriedades
  (idempotência, isolamento de domínio, limites de tamanho), não a tecnologia específica.

## Dependencies

- Protótipo de design e regras de negócio em `docs/design-handoff/` (README + telas de referência).
- Stack-alvo já inicializada no repositório (camada desktop + UI) — detalhes de tecnologia consolidados nos
  ADRs do plano.
- **Banco legado Access** `../Livraria/livraria.mdb` como fonte da importação **recorrente/idempotente**
  (acervo + vendas históricas) durante a transição. Ferramenta de leitura do `.mdb` (ex.: `mdbtools`)
  disponível no ambiente de migração.
