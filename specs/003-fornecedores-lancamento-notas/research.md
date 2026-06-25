# Phase 0 — Research & Decisões: Fornecedores & Lançamento de Notas

As ambiguidades foram resolvidas em `/speckit-specify` e `/speckit-clarify` (ver `spec.md` › Clarifications).
Sem `NEEDS CLARIFICATION`. As decisões viram o ADR-0011.

## D1 — Fornecedor como entidade própria (→ ADR-0011)

- **Decisão**: tabela `fornecedor` com `id`, `nome` (e `nome_norm` para busca/unicidade), documento, telefone,
  e-mail, observações, `ativo`. O lançamento referencia `fornecedor_id`.
- **Rationale**: padroniza o nome (acaba com "Editora X" vs "editora x"), permite reuso e busca. Substitui o
  texto livre de fornecedor da 002.
- **Unicidade**: `nome_norm` único (normalização sem acento/caixa, como `texto::normalize`). Soft-delete via
  `ativo` para preservar notas históricas.
- **Alternativas rejeitadas**: manter texto livre (não padroniza — rejeitado); cadastro fiscal completo com
  validação de CNPJ (YAGNI para livraria de igreja).

## D2 — Migração: semear fornecedores do texto livre (→ data-model)

- **Decisão**: passo idempotente em runtime (no boot, como `gerar_saldos_iniciais`): para cada `fornecedor`
  distinto não vazio em `movimento_estoque`, criar um `fornecedor` com aquele nome se ainda não existir
  (por `nome_norm`). Os movimentos históricos **permanecem com o texto** (não há religação retroativa).
- **Rationale**: não perde o que já foi digitado; novas notas passam a referenciar a lista. Histórico do
  extrato continua mostrando o nome (texto já gravado no movimento).
- **Alternativas rejeitadas**: religar movimentos antigos a `fornecedor_id` (mudança de schema no
  `movimento_estoque` + backfill arriscado, sem ganho real — rejeitado).

## D3 — Nota como rascunho retomável + finalização atômica (→ ADR-0011)

- **Decisão**: `lancamento_entrada` com `fornecedor_id`, `numero` (opcional, texto), `data`, `status`
  (`rascunho`/`finalizada`), `finalizada_em`. `item_lancamento` com `lancamento_id`, `livro_codigo`,
  `qtd`, `custo_unit_centavos`, `UNIQUE(lancamento_id, livro_codigo)`.
- **Rascunho**: criar/salvar/editar/excluir sem tocar no estoque (FR-020..022). Vários rascunhos simultâneos
  são permitidos (diferente da sessão única do inventário).
- **Finalização (dar entrada)**: numa **única transação**, para cada item chama o **helper compartilhado**
  `inserir_entrada_item(txn, ...)` (ver D3a) e, ao fim, marca a nota como `finalizada`. **Idempotente**:
  finalizar uma nota já `finalizada` não reaplica.
- **Rationale**: reusa integralmente a razão de movimentos da 002, mantendo a invariante `Σ == estoque`. A
  atomicidade garante tudo-ou-nada por nota.
- **Alternativas rejeitadas**: recebimento parcial por item (descartado na clarificação); **duplicar** a
  lógica de inserção de entrada dentro do `lancamento_repo` (violaria DRY — resolvido por D3a).

## D3a — Helper de inserção de entrada compartilhado (DRY, → ADR-0011)

- **Decisão**: extrair a mecânica de uma entrada de item para um helper **txn-aware** único —
  `inserir_entrada_item(txn, livro_codigo, qtd, custo_unit_centavos, fornecedor, referencia)` — que insere o
  movimento `entrada`, soma `livro.estoque` e recalcula o custo médio (via `domain::estoque::custo_medio_apos_entrada`).
  Vive em `adapters/persistencia/estoque_sql.rs`. Usado por **`lancamento_repo.finalizar`** (N itens na mesma
  transação) e por **`estoque_repo.registrar_entrada`** (1 item, abrindo a própria transação).
- **Rationale**: fonte única da mecânica de entrada do ledger (Princípio II / DRY); evita duas cópias da
  regra de custo médio/saldo divergirem. A regra de negócio (custo médio) permanece no domínio; o helper só
  orquestra a persistência.
- **Alternativas rejeitadas**: reimplementar a inserção no `lancamento_repo` (duplicação — rejeitado).

## D4 — Custo total↔unitário e total da nota (→ reuso 002)

- **Decisão**: cada item aceita custo **total** OU **unitário**; o domínio deriva o outro com
  `derivar_custos` (002). Persiste-se o **custo unitário** no item. O **total da nota** é a soma de
  `custo_unit × qtd` dos itens (sem frete/desconto).
- **Rationale**: consistência com a entrada da 002; simplicidade adequada à livraria.

## D5 — Substituição da tela Entrada da 002 (→ UI, resolve U1)

- **Decisão (remover)**: a Entrada de 1 livro voltada ao usuário sai — `src/routes/Entrada.tsx`, a rota
  `/entrada`, o **comando** `commands_estoque::registrar_entrada`, o caso de uso `application/entrada.rs`,
  os wrappers `registrarEntrada`/`fornecedoresSugestoes` no `ipc.ts` e o comando `fornecedores_sugestoes`
  (a seleção de fornecedor passa a vir da tabela `fornecedor`). A entrada de um único livro vira uma **nota
  de 1 item**.
- **Decisão (manter)**: a **porta `EstoqueRepo::registrar_entrada`** e o teste de integração da 002
  (`tests/estoque_repo.rs`) **permanecem** — `registrar_entrada` vira um wrapper fino sobre o helper
  `inserir_entrada_item` (D3a), continuando como primitiva atômica de 1 item (e mantendo a cobertura do
  ledger). O domínio de custo médio (`domain::estoque`) permanece intacto.
- **Rationale**: um fluxo de UI só, consistente; sem dead code (a primitiva fica testada e é a base do
  helper compartilhado).

## D6 — Sem novas dependências

- **Decisão**: tudo com a stack atual. Seleção de fornecedor reusa o padrão de busca/lista já existente
  (Input + lista filtrada / componente próprio `FornecedorSelect`).
