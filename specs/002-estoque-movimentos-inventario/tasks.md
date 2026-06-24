---
description: "Task list — Movimentação de Estoque & Inventário (Livraria 2)"
---

# Tasks: Movimentação de Estoque & Inventário — Livraria 2

**Input**: Design documents from `specs/002-estoque-movimentos-inventario/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/tauri-commands.md](contracts/tauri-commands.md),
[quickstart.md](quickstart.md)

**Tests**: testes das **regras de domínio puras** (`cargo test`, sem UI nem banco) são **obrigatórios** por
exigência da constituição (Quality Gate #2), não opcionais. Testes de adapter usam SQLite temporário.

**Organization**: agrupado por user story. Cada história é implementável e testável de forma independente
após a fase Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1..US5 (mapeia as histórias da spec); fases Setup/Foundational/Polish sem rótulo
- Caminhos de arquivo exatos seguem a estrutura Hexagonal do projeto (ver plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: registrar decisões de arquitetura antes de codar (Princípio V).

- [X] T001 [P] Escrever ADR-0008 (razão de movimentos como fonte da verdade + saldo inicial) em `docs/adr/0008-razao-movimentos-estoque.md`
- [X] T002 [P] Escrever ADR-0009 (custo médio ponderado, half-up em centavos) em `docs/adr/0009-custo-medio-ponderado.md`
- [X] T003 [P] Escrever ADR-0010 (inventário: sessão parcial/total, reconciliação no fechamento) em `docs/adr/0010-inventario-reconciliacao.md`
- [X] T004 [P] Atualizar `docs/adr/README.md` com os três novos ADRs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a espinha dorsal do ledger — sem isto, nenhuma história funciona nem a invariante SC-001 vale.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase completar.

### Migração & esquema

- [X] T005 Adicionar migration `m_estoque` (ALTER `livro` add `codigo_barras`, `custo_medio_centavos`; CREATE das tabelas `movimento_estoque`, `sessao_inventario`, `item_contagem`, `pendencia_cadastro` + índices) registrando-a no migrator em `src-tauri/src/migration/mod.rs` (idempotente via seaql_migrations; ver data-model.md)

### Domínio puro (com testes obrigatórios)

- [X] T006 [P] Criar `src-tauri/src/domain/estoque.rs`: enum `TipoMovimento`, struct `MovimentoEstoque`, e funções puras `custo_medio_apos_entrada`, `derivar_custos`, `aplicar_ajuste` (rejeita negativo → `ErroDominio::EstoqueNegativo`), `diferenca_contagem`
- [X] T007 [P] Adicionar variante `EstoqueNegativo` (e afins) em `src-tauri/src/domain/erros.rs`
- [X] T008 Testes unitários de domínio em `src-tauri/src/domain/estoque.rs` (`#[cfg(test)]`): custo médio (4@0 +10@1250 → 893), derivação total↔unitário, ajuste barra negativo, diferença de contagem (depende de T006)
- [X] T009 Estender `src-tauri/src/domain/livro.rs`: campos `codigo_barras: Option<String>` e `custo_medio: Dinheiro` (ou centavos), atualizar construtores/testes existentes sem quebrar selo de estoque

### Portas & ledger base

- [X] T010 Definir a porta `EstoqueRepo` (métodos `registrar_entrada`, `registrar_ajuste`, `extrato`, `gerar_saldos_iniciais`, `fornecedores_sugestoes`) em `src-tauri/src/application/ports.rs` — se o arquivo passar de 300 linhas, extrair para `src-tauri/src/application/ports_estoque.rs` (Princípio III)
- [X] T011 [P] Criar entidade SeaORM `src-tauri/src/adapters/persistencia/entities/movimento_estoque.rs` e registrar em `entities/mod.rs`
- [X] T012 Criar `src-tauri/src/adapters/persistencia/estoque_repo.rs` com `SeaEstoqueRepo`: helper interno de inserção de movimento + atualização atômica de `livro.estoque` (esqueleto + `gerar_saldos_iniciais` idempotente: cria `saldo_inicial` só p/ livros sem movimento) (depende de T010, T011)
- [X] T013 Atualizar upsert de `src-tauri/src/adapters/persistencia/livro_repo.rs` para persistir/ler `codigo_barras` e `custo_medio` na entidade `entities/livro.rs` (depende de T009)

### Integração com a venda (FR-003) & wiring

- [X] T014 Alterar `registrar()` em `src-tauri/src/adapters/persistencia/pedido_repo.rs` para inserir um movimento `saida_venda` (ref = nº do pedido) por item **na mesma transação** da baixa; `importar()` permanece sem movimento. Extrair helper se aproximar de 300 linhas
- [X] T015 Aplicar `app.manage` do `EstoqueRepo` e chamar `gerar_saldos_iniciais` no boot (após migrar) em `src-tauri/src/lib.rs` (espelha `garantir_admin`)
- [X] T016 [P] Estender DTOs de fronteira em `src-tauri/src/commands.rs`: `LivroDto` ganha `codigoBarras?`/`custoMedioCentavos`; criar `MovimentoView` (camelCase)
- [X] T017 [P] Espelhar tipos na UI em `src/lib/types.ts`: `Livro` (+ `codigoBarras?`, `custoMedioCentavos`), `Movimento`, `TipoMovimento`
- [X] T018 Teste de adapter (SQLite temporário) em `src-tauri/tests/`: `gerar_saldos_iniciais` é idempotente; reconciliação `Σ movimentos == estoque` vale após venda (cobre SC-001); e **imutabilidade** — confirmar que `EstoqueRepo`/`SeaEstoqueRepo` não expõem caminho de update/delete de `movimento_estoque`, só append (FR-005). (depende de T012, T014)

**Checkpoint**: ledger pronto, invariante SC-001 garantida — as histórias podem começar (em paralelo, se houver gente).

---

## Phase 3: User Story 1 - Entrada de mercadoria (Priority: P1) 🎯 MVP

**Goal**: dar entrada (compra) com quantidade, custo (total↔unitário) e fornecedor, subindo o estoque com
movimento `entrada` e recalculando o custo médio.

**Independent Test**: dar entrada de 10 un. com custo e fornecedor num livro com estoque 4 → estoque 14,
movimento `entrada`, custo médio recalculado (quickstart cenário 2).

### Implementation

- [X] T019 [US1] Caso de uso `registrar_entrada` em `src-tauri/src/application/entrada.rs`: `EntradaInput`, deriva custo (T006), valida `qtd > 0` (`QTD_INVALIDA`), chama `EstoqueRepo::registrar_entrada`
- [X] T020 [US1] Testes do caso de uso em `src-tauri/src/application/entrada.rs` com `FakeEstoqueRepo` (qtd inválida; derivação total↔unitário; custo médio aplicado; **entrada não altera `preco` do livro** — FR-013) (depende de T019)
- [X] T021 [US1] Implementar `registrar_entrada` e `fornecedores_sugestoes` em `src-tauri/src/adapters/persistencia/estoque_repo.rs`: txn = insere movimento `entrada` (+qtd, custo_unit, fornecedor), `estoque += qtd`, recalcula `custo_medio` via domínio (depende de T012)
- [X] T022 [US1] Comandos Tauri `registrar_entrada` e `fornecedores_sugestoes` em `src-tauri/src/commands.rs` + `EntradaInput` DTO; registrar no `generate_handler!` em `src-tauri/src/lib.rs`
- [X] T023 [P] [US1] Wrappers `invoke` em `src/lib/ipc.ts` (`registrarEntrada`, `fornecedoresSugestoes`)
- [X] T024 [US1] Tela/componente de entrada `src/routes/Entrada.tsx` + `src/components/EntradaForm.tsx`: busca livro, qtd, fornecedor (com sugestões), campo custo total **ou** unitário (um deriva o outro), R$ pt-BR (centavos)
- [X] T025 [US1] Adicionar rota "Entrada" na navegação (`src/components/AppSidebar.tsx` / `src/App.tsx`)

**Checkpoint**: US1 funcional e demonstrável de forma independente (MVP).

---

## Phase 4: User Story 2 - Inventário por bipagem (Priority: P1)

**Goal**: contar o acervo (ou uma gaveta) bipando códigos, reconciliar contado vs sistema no fechamento e
aplicar ajustes (modo parcial/total); códigos desconhecidos viram pendência.

**Independent Test**: sessão parcial "Gaveta A", bipar livros, fechar → só os contados ajustados, demais
intactos; código inexistente vira pendência (quickstart cenários 4 e 5).

### Domínio puro (com testes obrigatórios)

- [X] T026 [P] [US2] Criar `src-tauri/src/domain/inventario.rs`: enums `ModoInventario`, `StatusSessao`, structs de sessão/contagem e regra de fechamento (diferença por item; modo total → não-contado = 0)
- [X] T027 [US2] Testes unitários em `src-tauri/src/domain/inventario.rs`: diferença ±, modo parcial ignora não-contados, modo total zera não-contados (depende de T026)

### Persistência & porta

- [X] T028 [P] [US2] Entidades SeaORM `sessao_inventario.rs`, `item_contagem.rs`, `pendencia_cadastro.rs` em `src-tauri/src/adapters/persistencia/entities/` (+ registrar em `entities/mod.rs`)
- [X] T029 [US2] Definir porta `InventarioRepo` (abrir, sessao_aberta, bipar, ajustar_item, revisao, fechar, cancelar, pendencias) em `src-tauri/src/application/ports.rs` (ou `ports_estoque.rs`)
- [X] T030 [US2] Adicionar busca de bipagem em `src-tauri/src/adapters/persistencia/livro_repo.rs` (`por_codigo_barras_ou_codigo`): casa o valor lido contra `codigo_barras` **OU** `codigo` (PK), garantindo que livros migrados (EAN no `codigo`, `codigo_barras` nulo) sejam encontrados sem backfill (FR-022, depende de T013)
- [X] T031 [US2] Implementar `src-tauri/src/adapters/persistencia/inventario_repo.rs` (`SeaInventarioRepo`): abrir (rejeita 2ª sessão aberta → `SESSAO_ABERTA_EXISTENTE`), bipar (incrementa `item_contagem` ou cria/soma `pendencia_cadastro`), ajustar_item, revisao, **fechar** (snapshot `qtd_sistema`, gera movimentos `contagem`, modo total zera não-bipados, idempotente), cancelar (depende de T026, T028, T029)
- [X] T032 [US2] Teste de adapter (SQLite temporário) em `src-tauri/tests/`: fechar sessão parcial ajusta só contados (SC-004) e é idempotente; total zera não-bipados (depende de T031)

### Casos de uso & fronteira

- [X] T033 [US2] Casos de uso em `src-tauri/src/application/inventario.rs`: orquestra abrir/bipar (resolve livro por `codigo_barras` via `LivroRepo`; senão pendência)/revisar/fechar/cancelar + testes com fakes (depende de T029)
- [X] T034 [US2] Comandos Tauri `inventario_abrir`, `inventario_sessao_aberta`, `inventario_bipar`, `inventario_ajustar_item`, `inventario_revisao`, `inventario_fechar`, `inventario_cancelar` e `inventario_divergencias` (reconstrói o relatório de uma sessão **fechada** a partir dos movimentos `contagem` com `referencia` = id da sessão — FR-029/SC-006) em `src-tauri/src/commands.rs` + DTOs (`SessaoDto`, `ResultadoBipagem`, `DivergenciaView`, `RelatorioFechamento`); registrar em `lib.rs`
- [X] T035 [P] [US2] Wrappers `invoke` + tipos em `src/lib/ipc.ts` e `src/lib/types.ts`
- [X] T036 [US2] Tela `src/routes/Inventario.tsx` + `src/components/InventarioScanner.tsx`: escolher modo/rótulo, campo focado de bipagem (HID, Enter), lista contada ao vivo, busca por nome no não-encontrado, revisão de divergências, fechar (modo total exige confirmação) — ver FR-022/026
- [X] T037 [US2] Adicionar rota "Inventário" na navegação (`src/components/AppSidebar.tsx` / `src/App.tsx`)

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 - Ajuste avulso de estoque (Priority: P2)

**Goal**: corrigir o estoque de um livro (±) com motivo obrigatório, sem deixar negativo.

**Independent Test**: ajuste -2 com motivo "quebra" reduz estoque e grava movimento `ajuste`; sem motivo
ou resultado negativo é barrado (quickstart cenário 3).

- [X] T038 [US3] Caso de uso `registrar_ajuste` em `src-tauri/src/application/ajuste.rs`: valida motivo (`MOTIVO_OBRIGATORIO`) e usa `aplicar_ajuste` (T006) para barrar negativo (`ESTOQUE_NEGATIVO`) + testes com fake
- [X] T039 [US3] Implementar `registrar_ajuste` em `src-tauri/src/adapters/persistencia/estoque_repo.rs`: txn = insere movimento `ajuste` (qtd com sinal, motivo) + atualiza `estoque` (depende de T012)
- [X] T040 [US3] Comando Tauri `registrar_ajuste` em `src-tauri/src/commands.rs` + registrar em `lib.rs`
- [X] T041 [P] [US3] Wrapper `invoke` em `src/lib/ipc.ts` e ação de ajuste na UI (em `src/routes/Pesquisa` ou `Cadastro`): qtd ±, motivo obrigatório

**Checkpoint**: US1, US2 e US3 independentes.

---

## Phase 6: User Story 4 - Extrato de movimentação (Priority: P2)

**Goal**: ver o histórico cronológico de um livro com saldo resultante batendo com o estoque.

**Independent Test**: após entrada, venda e ajuste, extrato mostra 3 linhas em ordem e saldo final == estoque
(quickstart, SC-005).

- [X] T042 [US4] Implementar `extrato` em `src-tauri/src/adapters/persistencia/estoque_repo.rs`: lista movimentos do livro em ordem cronológica com `saldoResultante` acumulado (depende de T012)
- [X] T043 [US4] Caso de uso/visão `extrato_livro` em `src-tauri/src/application/extrato.rs` (monta `MovimentoView`)
- [X] T044 [US4] Comando Tauri `extrato_livro` em `src-tauri/src/commands.rs` + registrar em `lib.rs`
- [X] T045 [P] [US4] Wrapper `invoke` + componente `src/components/ExtratoMovimentos.tsx` (acessível da Pesquisa/Cadastro); tipos em `src/lib/types.ts`

**Checkpoint**: US1–US4 independentes.

---

## Phase 7: User Story 5 - Pendências de cadastro (Priority: P3)

**Goal**: listar e resolver os códigos desconhecidos coletados no inventário (cadastrar/dar entrada).

**Independent Test**: bipar código inexistente → aparece em pendências; cadastrar o livro resolve e remove
da lista (quickstart cenário 5, SC-007).

- [X] T046 [US5] Métodos `pendencias` e `resolver_pendencia` em `src-tauri/src/adapters/persistencia/inventario_repo.rs` (depende de T031)
- [X] T047 [US5] Suporte a `codigo_barras` no upsert de cadastro: `LivroInput`/`salvar_livro` aceita `codigoBarras` em `src-tauri/src/commands.rs`; ao cadastrar a partir de pendência, marca `resolver_pendencia`
- [X] T048 [US5] Comandos Tauri `inventario_pendencias`, `resolver_pendencia`, `buscar_por_codigo_barras` em `src-tauri/src/commands.rs` + registrar em `lib.rs`
- [X] T049 [P] [US5] Wrappers `invoke` + componente `src/components/Pendencias.tsx` (lista pendências, botão "cadastrar/dar entrada"); tipos em `src/lib/types.ts`

**Checkpoint**: todas as histórias independentes e funcionais.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T050 [P] Rodar o guardrail `scripts/check-file-size.sh` e refatorar qualquer arquivo > 300 linhas significativas (alvos prováveis: `commands.rs`, `pedido_repo.rs`, `estoque_repo.rs`, `ports.rs`)
- [X] T051 [P] Atualizar a aba de relatório de estoque (`src/lib/exportar.ts`) para incluir custo médio e/ou divergências de inventário, se aplicável (SC-006)
- [X] T052 Executar a validação ponta a ponta de [quickstart.md](quickstart.md) (cenários 1–7) com `npm run tauri dev`
- [X] T053 [P] `cargo test` completo + `cargo clippy` limpos; conferir reconciliação SC-001 em base com dados reais migrados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar já (ADRs em paralelo).
- **Foundational (Phase 2)**: depende do Setup; **BLOQUEIA** todas as histórias. Ordem interna: T005 → (T006,T007,T009) → T008 → T010 → (T011,T012,T013) → (T014,T015,T016,T017) → T018.
- **User Stories (Phases 3–7)**: todas dependem da Foundational. Depois disso podem ir em paralelo ou por prioridade (P1 → P2 → P3).
- **Polish (Phase 8)**: depende das histórias desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: só depende da Foundational. Independente.
- **US2 (P1)**: só depende da Foundational. Independente (cria pendência ao bipar desconhecido).
- **US3 (P2)**: só depende da Foundational (usa `aplicar_ajuste` + `estoque_repo`).
- **US4 (P2)**: só depende da Foundational (lê movimentos). Mais rica de demonstrar após US1/US2/US3 gerarem movimentos, mas testável isolada.
- **US5 (P3)**: depende da Foundational + da criação de pendência feita na US2 (T031); o resto é listar/resolver.

### Within Each User Story

- Domínio/regra (com teste) antes do adapter; adapter antes do caso de uso; caso de uso antes do comando; comando antes da UI.

### Parallel Opportunities

- Setup: T001–T004 todos [P].
- Foundational: T006/T007/T009 [P]; T011 [P]; T016/T017 [P].
- Entre histórias: após a Foundational, US1, US2 e US3 podem ser tocadas por pessoas diferentes em paralelo.
- Dentro das histórias, tarefas [P] são em arquivos distintos (ex.: wrappers de UI vs. Rust).

---

## Parallel Example: Foundational

```bash
# Domínio puro e erros em paralelo (arquivos diferentes):
Task: "T006 Criar domain/estoque.rs (TipoMovimento, MovimentoEstoque, funções puras)"
Task: "T007 Adicionar EstoqueNegativo em domain/erros.rs"
Task: "T009 Estender domain/livro.rs (codigo_barras, custo_medio)"

# Espelhamento de tipos na fronteira em paralelo:
Task: "T016 DTOs em commands.rs (LivroDto+, MovimentoView)"
Task: "T017 Tipos em src/lib/types.ts (Livro+, Movimento)"
```

---

## Implementation Strategy

### MVP First (US1 — Entrada de mercadoria)

1. Phase 1 (Setup/ADRs) → 2. Phase 2 (Foundational — ledger + invariante) → 3. Phase 3 (US1).
4. **PARAR e VALIDAR**: dar entrada e conferir estoque/custo médio/movimento. 5. Demo.

> Observação: a Foundational já entrega valor invisível porém crítico (saldo inicial + venda emitindo
> movimento), garantindo SC-001 antes de qualquer tela nova.

### Incremental Delivery

Foundational pronto → US1 (entrada) → US2 (inventário) → US3 (ajuste) → US4 (extrato) → US5 (pendências).
Cada história agrega valor sem quebrar as anteriores.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Testes de domínio são **obrigatórios** (constituição) e devem passar sem UI nem banco.
- Vigiar o limite de 300 linhas a cada crescimento de `commands.rs`, `ports.rs`, `pedido_repo.rs`, `estoque_repo.rs` — extrair módulo quando necessário (T050 fecha isso).
- Commit após cada tarefa ou grupo lógico; parar em qualquer checkpoint para validar a história isolada.
