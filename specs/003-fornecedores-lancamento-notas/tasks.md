---
description: "Task list — Fornecedores & Lançamento de Notas de Entrada (Livraria 2)"
---

# Tasks: Fornecedores & Lançamento de Notas de Entrada — Livraria 2

**Input**: Design documents from `specs/003-fornecedores-lancamento-notas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/tauri-commands.md](contracts/tauri-commands.md),
[quickstart.md](quickstart.md)

**Tests**: testes das **regras de domínio puras** (`cargo test`, sem UI nem banco) são **obrigatórios**
(constituição, Quality Gate #2). Testes de adapter usam SQLite temporário.

**Organization**: agrupado por user story. Reusa o ledger/custo médio da feature 002 (não reimplementa).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: arquivos diferentes, sem dependência pendente
- **[Story]**: US1..US4 (fases Setup/Foundational/Polish sem rótulo)
- Caminhos seguem a estrutura Hexagonal (ver plan.md)

---

## Phase 1: Setup

- [X] T001 [P] Registrar a decisão em `docs/adr/0011-fornecedores-lancamento-notas.md` e no índice `docs/adr/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

### Migração & esquema

- [X] T002 Adicionar migration `m_fornecedores` (CREATE TABLE `fornecedor`, `lancamento_entrada`, `item_lancamento` + índices, incl. `UNIQUE(nome_norm)` e `UNIQUE(lancamento_id, livro_codigo)`) registrando no migrator em `src-tauri/src/migration/mod.rs` (idempotente; ver data-model.md)

### Domínio puro (com testes obrigatórios)

- [X] T003 [P] Criar `src-tauri/src/domain/fornecedor.rs`: struct `Fornecedor`, `nome_norm` (reusa `texto::normalize`), `validar` (nome obrigatório) + testes `#[cfg(test)]`
- [X] T004 [P] Criar `src-tauri/src/domain/lancamento.rs`: enum `StatusLancamento`, structs `Lancamento`/`ItemLancamento`, `total_item`/`total_nota`, `pode_finalizar` (exige fornecedor + ≥1 item; barra nota finalizada) + testes
- [X] T005 [P] Adicionar variantes de erro em `src-tauri/src/domain/erros.rs`: `NomeObrigatorio`, `FornecedorDuplicado`, `SemFornecedor`, `NotaFinalizada` (códigos estáveis)
- [X] T006 Registrar `fornecedor` e `lancamento` em `src-tauri/src/domain/mod.rs`

### Persistência & portas

- [X] T007 [P] Entidades SeaORM `fornecedor.rs`, `lancamento_entrada.rs`, `item_lancamento.rs` em `src-tauri/src/adapters/persistencia/entities/` (+ registrar em `entities/mod.rs`)
- [X] T008 Definir portas em `src-tauri/src/application/ports_compras.rs`: `FornecedorRepo`, `LancamentoRepo` + DTOs de visão (`LancamentoResumo`, `LancamentoDetalhe`, `ItemNota`); registrar em `application/mod.rs`
- [X] T009 [P] Tipos da UI em `src/lib/types.ts`: `Fornecedor`, `Lancamento`/`LancamentoResumo`/`LancamentoDetalhe`, `ItemNota`, `StatusLancamento`

**Checkpoint**: esquema + domínio + portas prontos.

---

## Phase 3: User Story 1 - Fornecedores (Priority: P1) 🎯 MVP

**Goal**: cadastrar/editar/listar/buscar fornecedores; semear da base existente.

**Independent Test**: cadastrar "Editora X", impedir duplicado "editora x", editar, buscar, inativar; e ver
os fornecedores semeados dos textos de fornecedor da 002.

- [X] T010 [US1] Implementar `src-tauri/src/adapters/persistencia/fornecedor_repo.rs` (`SeaFornecedorRepo`): `listar` (busca por nome, ativos), `salvar` (upsert por `nome_norm`, rejeita duplicado), `excluir` (soft-delete), `semear` (idempotente a partir de `movimento_estoque.fornecedor`); registrar em `persistencia/mod.rs`
- [X] T011 [US1] Teste de adapter (SQLite temp) em `src-tauri/tests/`: dedup por `nome_norm`, soft-delete, `semear` idempotente
- [X] T012 [US1] Caso de uso `src-tauri/src/application/fornecedores.rs` (validar nome, salvar, listar, excluir, `adotar`/semear) + testes com `FakeFornecedorRepo`
- [X] T013 [US1] Comandos `src-tauri/src/commands_fornecedor.rs` (`fornecedores_listar`, `fornecedor_salvar`, `fornecedor_excluir`) + `FornecedorDto`/`FornecedorInput`
- [X] T014 [US1] `src-tauri/src/lib.rs`: registrar módulo + handlers; chamar `semear_fornecedores` no boot (após migrar)
- [X] T015 [P] [US1] Wrappers `invoke` em `src/lib/ipc.ts` (`fornecedoresListar`, `fornecedorSalvar`, `fornecedorExcluir`)
- [X] T016 [US1] Tela `src/routes/Fornecedores.tsx` (lista + busca + paginação, padrão do Cadastro) + `src/components/FornecedorForm.tsx`
- [X] T017 [US1] Adicionar "Fornecedores" à navegação (`src/components/AppSidebar.tsx` / rota em `src/App.tsx`)

**Checkpoint**: US1 funcional e independente (MVP).

---

## Phase 4: User Story 2 - Novo lançamento e dar entrada (Priority: P1)

**Goal**: criar nota, escolher fornecedor, lançar vários itens e dar entrada (sobe estoque + custo médio).

**Independent Test**: nota para "Editora X", 3 itens, dar entrada → estoque dos 3 sobe, custo médio
recalculado, 1 movimento `entrada` por item com referência = id da nota.

- [X] T018a [US2] **Refator DRY (D3a)**: extrair o helper compartilhado `inserir_entrada_item(txn, livro_codigo, qtd, custo_unit, fornecedor, referencia)` (insere movimento `entrada` + `estoque += qtd` + recalcula custo médio via `domain::estoque`) para `src-tauri/src/adapters/persistencia/estoque_sql.rs`; fazer `estoque_repo.registrar_entrada` **delegar** ao helper. O teste de integração da 002 (`tests/estoque_repo.rs`) MUST continuar verde
- [X] T018 [US2] Implementar `src-tauri/src/adapters/persistencia/lancamento_repo.rs` (`SeaLancamentoRepo`): `criar`, `obter`, `definir_fornecedor`, `adicionar_item` (UNIQUE soma; deriva custo via `domain::estoque::derivar_custos`), `remover_item`, **`finalizar`** (txn única: chama `inserir_entrada_item` por item com `referencia`=nota e `fornecedor`=nome; marca `finalizada`; idempotente). Extrair `lancamento_sql.rs` se passar de 300 linhas (depende de T018a)
- [X] T019 [US2] Teste de adapter (SQLite temp) em `src-tauri/tests/`: finalizar gera 1 entrada por item, estoque/custo médio corretos, **reconciliação `Σ == estoque`** (SC-001), **idempotência** (finalizar 2× não reaplica), item repetido soma na linha
- [X] T020 [US2] Casos de uso `src-tauri/src/application/lancamentos.rs` (criar/definir fornecedor/adicionar/remover item/finalizar usando `pode_finalizar`) + testes com fakes (sem fornecedor → `SEM_FORNECEDOR`; sem itens → `SEM_ITENS`)
- [X] T021 [US2] Comandos `src-tauri/src/commands_lancamento.rs` (`lancamento_criar`, `_obter`, `_definir_fornecedor`, `_adicionar_item`, `_remover_item`, `_finalizar`) + DTOs (`LancamentoDetalhe`, `ItemNota`); registrar em `lib.rs`
- [X] T022 [P] [US2] Wrappers `invoke` + tipos em `src/lib/ipc.ts`
- [X] T023 [US2] `src/components/FornecedorSelect.tsx` (seleção de fornecedor com busca)
- [X] T024 [US2] `src/components/LancamentoEditor.tsx`: escolher fornecedor, adicionar itens via `EntradaProduto` (campo único com autosearch), custo total↔unitário, subtotais, botão **Dar entrada**

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 - Lista de lançamentos e remoção da Entrada antiga (Priority: P1)

**Goal**: a tela de Entrada vira a **lista de notas** com **"Novo lançamento"**; a Entrada de 1 livro sai.

**Independent Test**: após 2 notas, ver a lista (fornecedor, data, status, total, nº itens); "Novo
lançamento" abre nota em branco; nota finalizada abre somente leitura; a tela antiga não existe mais.

- [X] T025 [US3] `lancamentos_listar` e `lancamento_excluir` (rascunho) em `src-tauri/src/adapters/persistencia/lancamento_repo.rs` (resumo: fornecedor, data, status, total, qtdItens)
- [X] T026 [US3] Comandos `lancamentos_listar`, `lancamento_excluir` em `src-tauri/src/commands_lancamento.rs` + handlers em `lib.rs`
- [X] T027 [P] [US3] Wrappers `invoke` (`lancamentosListar`, `lancamentoExcluir`) em `src/lib/ipc.ts`
- [X] T028 [US3] Tela `src/routes/Lancamentos.tsx`: lista de notas (tabela + paginação) + botão "Novo lançamento" → `LancamentoEditor`; abrir finalizada em somente leitura
- [X] T029 [US3] Navegação: trocar "Entrada" por "Lançamentos" em `src/components/AppSidebar.tsx` e a rota em `src/App.tsx`
- [X] T030 [US3] **Remover** a Entrada de 1 livro voltada ao usuário (U1): deletar `src/routes/Entrada.tsx` + rota `/entrada`; remover o **comando** `commands_estoque::registrar_entrada` e `fornecedores_sugestoes` (+ handlers no `lib.rs`); remover o caso de uso `src-tauri/src/application/entrada.rs` (e seu módulo em `application/mod.rs`); remover `registrarEntrada`/`fornecedoresSugestoes` de `src/lib/ipc.ts`. **MANTER** a porta `EstoqueRepo::registrar_entrada` (agora delegando ao helper, T018a) e o teste `tests/estoque_repo.rs`

**Checkpoint**: US1, US2, US3 independentes; fluxo de entrada unificado em notas.

---

## Phase 6: User Story 4 - Rascunho retomável (Priority: P2)

**Goal**: salvar nota incompleta (rascunho) sem afetar estoque, retomar/editar/excluir; estoque só ao finalizar.

**Independent Test**: criar rascunho com 2 itens e sair (estoque intacto); reabrir, +1 item, dar entrada
(sobe os 3); criar outro rascunho e excluí-lo (nada lançado).

- [X] T031 [US4] Garantir no `lancamento_repo`/casos de uso: salvar como `rascunho` não toca no estoque; excluir rascunho não lança nada; editar nota `finalizada` → `NOTA_FINALIZADA`
- [X] T032 [US4] Teste de adapter (SQLite temp): rascunho com itens **não** altera estoque; excluir rascunho remove sem efeito; finalizar é idempotente
- [X] T033 [US4] UI: distinguir **rascunho** vs **finalizada** na lista (`Lancamentos.tsx`), botão "Continuar" no rascunho e somente-leitura na finalizada

**Checkpoint**: todas as histórias independentes e funcionais.

---

## Phase 7: Polish & Cross-Cutting

- [X] T034 [P] Rodar `scripts/check-file-size.sh` e refatorar arquivos > 300 linhas significativas (alvos prováveis: `lancamento_repo.rs`, `commands_lancamento.rs`, `Lancamentos.tsx`)
- [X] T035 [P] `cargo test` + `cargo clippy` limpos; conferir reconciliação SC-001 após finalizar notas
- [X] T036 Executar a validação ponta a ponta de [quickstart.md](quickstart.md) (cenários 1–6) com `npm run tauri dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ADR. Sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **BLOQUEIA** as histórias. Ordem: T002 → (T003,T004,T005) → T006 → (T007,T009) → T008.
- **US1 (P1)**: só depende da Foundational. Independente (MVP).
- **US2 (P1)**: depende da Foundational. Usa fornecedores (US1) para selecionar, mas é testável com um fornecedor semeado/criado direto.
- **US3 (P1)**: depende de US2 (repo/comandos de lançamento existirem) para listar e abrir.
- **US4 (P2)**: depende de US2/US3 (notas e lista).
- **Polish (Phase 7)**: depois das histórias desejadas.

### Parallel Opportunities

- Setup/Foundational: T003/T004/T005 [P], T007/T009 [P].
- Dentro das histórias: wrappers de UI (`[P]`) em paralelo ao Rust; tipos/ipc em paralelo às telas.
- US1 e US2 podem ser tocadas por pessoas diferentes após a Foundational (US3/US4 vêm depois de US2).

---

## Parallel Example: Foundational

```bash
Task: "T003 domain/fornecedor.rs (struct + normalize + validar + testes)"
Task: "T004 domain/lancamento.rs (status, total, pode_finalizar + testes)"
Task: "T005 novas variantes em domain/erros.rs"
Task: "T009 tipos em src/lib/types.ts"
```

---

## Implementation Strategy

### MVP First (US1 — Fornecedores)

1. Setup/ADR → 2. Foundational (migration + domínio + portas) → 3. US1 (fornecedores) → validar e demo.

### Incremental Delivery

Foundational → US1 (fornecedores) → US2 (lançar nota + dar entrada) → US3 (lista + remover Entrada antiga) →
US4 (rascunho). Cada história agrega valor sem quebrar as anteriores.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Testes de domínio são **obrigatórios** (constituição) e rodam sem UI/banco.
- A finalização **reusa** `domain::estoque::custo_medio_apos_entrada` e `derivar_custos` (002) e insere
  movimentos `entrada` — preserva `Σ movimentos == estoque`.
- Vigiar o limite de 300 linhas em `lancamento_repo.rs`/`commands_lancamento.rs`/`Lancamentos.tsx` (T034).
- Commit por tarefa ou grupo lógico; parar em cada checkpoint para validar a história isolada.
