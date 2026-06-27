---
description: "Task list — 004 Melhorias de inventário + identidade do livro (id)"
---

# Tasks: Melhorias de inventário + identidade do livro (`id`)

**Input**: Design documents from `specs/004-inventario-melhorias/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/tauri-commands.md](contracts/tauri-commands.md)

**Tests**: Incluídos apenas onde o risco exige (migração `m004` — FR-044/SC-001; função pura `resumir` — US3) e na atualização dos testes existentes que o refactor quebra. Não é uma suíte completa.

**Organização**: por user story. **US1 é fundacional e bloqueia US2–US6** (muda o esquema e a camada de persistência `livro_codigo → livro_id`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US6 (rastreabilidade com a spec)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: andaime para a refatoração e o teste de migração

- [X] T001 [P] Criar ADR-0012 (stub) em `docs/adr/0012-identidade-livro-id.md` com a decisão de PK/identidade e a estratégia de migração (resumir de [research.md](research.md) D1–D3)
- [X] T002 [P] Criar o arquivo de teste de migração `src-tauri/tests/migracao_m004.rs` com um helper que cria um SQLite temporário no esquema atual (002/003) e popula `livro` + `movimento_estoque` + `item_contagem` + `item_lancamento` (apenas o fixture; asserts entram em T006)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ A fundação desta feature é a própria US1 (Phase 3)**: a migração `m004` e o rewiring `livro_codigo → livro_id` precisam estar **verdes** antes de qualquer outra story (muda o esquema e quebra o build se incompleto). Não há tarefas foundational além do Setup — prosseguir direto para a Phase 3.

**Checkpoint**: Setup pronto → iniciar US1.

---

## Phase 3: User Story 1 - Identidade do livro (`id`) e código único (Priority: P1) 🎯 FUNDAÇÃO/MVP-bloqueante

**Goal**: `livro` com `id` PK auto-increment, `codigo` (barcode) UNIQUE, sem `codigo_barras`; FKs reais re-apontadas para `livro(id)`; migração sem perda de dados.

**Independent Test**: aplicar `m004` sobre base populada → `id` existe, `codigo_barras` ausente, contagem de linhas igual antes/depois, `PRAGMA foreign_key_check` vazio; bipagem/extrato/relatório seguem resolvendo pelo `codigo`.

### Migração (núcleo do risco)

- [X] T003 [US1] Implementar o submódulo de migração em `src-tauri/src/migration/m004.rs` (`pub mod m004`): rebuild de `livro` (+`id`, `codigo` UNIQUE NOT NULL, sem `codigo_barras`) e cópia de dados ([data-model.md](data-model.md) passo 1)
- [X] T004 [US1] Em `m004`, reconstruir `movimento_estoque` / `item_contagem` / `item_lancamento` com `livro_id` (FK via `livro_new(id)`, reescrita para `livro(id)` no rename), copiando via `JOIN livro_new ON codigo` (passo 2), e recriar índices (`idx_livro_busca`, `idx_mov_livro(livro_id,id)`, `idx_item_lanc`); `idx_livro_codbarras` cai com o drop da tabela
- [X] T005 [US1] Em `m004`, verificação anti-perda **ciente de órfãs**: compara `count(novo)` com `count(linhas válidas)` e **retorna `Err` (rollback)** se perder linha válida; relatório de órfãs por tabela; `PRAGMA foreign_key_check` ao final + guarda de idempotência `ja_aplicada`. ⚠️ **Ativação no boot** (`m004::aplicar` em `inicializar_schema`) fica com o refactor T007–T020 (depende das entidades novas)
- [X] T006 [P] [US1] `src-tauri/tests/migracao_m004.rs`: fixture com **linha órfã**; asserta `id` presente, `codigo_barras` ausente, **válidas preservadas + órfãs descartadas (relatório)**, `foreign_key_check` limpo e idempotência. **+ teste `#[ignore]` `m004_base_real`** validado contra a cópia de produção (498 livros, 2 órfãs descartadas, fk_check limpo)

### Entidades / domínio / DTO

- [X] T007 [P] [US1] `src-tauri/src/adapters/persistencia/entities/livro.rs`: adicionar `id` (PK), tornar `codigo` único, **remover `codigo_barras`**
- [X] T008 [P] [US1] `src-tauri/src/domain/livro.rs`: remover o campo `codigo_barras` (e seus usos em construtores/`#[cfg(test)]`)
- [X] T009 [US1] `src-tauri/src/commands.rs`: `LivroDto` perde `codigo_barras` (opcional: expor `id` em leitura) — ajustar `From`/serialização

### Rewiring `livro_codigo → livro_id` (persistência)

- [X] T010 [US1] `src-tauri/src/adapters/persistencia/livro_repo.rs`: upsert/salvar por `codigo` mapeando `id`; remover `Set(codigo_barras)`; busca/`por_codigo_barras_ou_codigo` casa **só `codigo`**
- [X] T011 [US1] `src-tauri/src/adapters/persistencia/inventario_sql.rs`: `achar_por_bipagem` casa só `codigo`; `divergencias_query` / `aplicar_fechamento` / `ler_qtd_contada` passam a usar `item_contagem.livro_id` (join `livro.id`) selecionando `livro.codigo` para a `DivergenciaView`
- [X] T012 [US1] `src-tauri/src/adapters/persistencia/inventario_repo.rs`: `bipar`/`desbipar`/`ajustar_item`/`fechar` operam por `livro_id` (resolver o id do livro a partir do `codigo` lido)
- [X] T013 [US1] `src-tauri/src/adapters/persistencia/estoque_repo.rs` + `estoque_sql.rs` (helper `inserir_entrada_item`) + extrato de movimentos: `movimento_estoque.livro_codigo → livro_id` (resolver id)
- [X] T014 [P] [US1] `src-tauri/src/application/venda.rs` e `src-tauri/src/application/ajuste.rs`: inserir movimento por `livro_id`
- [X] T015 [P] [US1] `src-tauri/src/adapters/persistencia/lancamento_repo.rs`: `item_lancamento.livro_codigo → livro_id`; finalização insere movimento por `livro_id`
- [X] T016 [US1] Varrer referências remanescentes a `livro_codigo` (`grep -rn "livro_codigo" src-tauri/src`) em relatórios/dashboard/extrato e migrar para `livro_id` mantendo `codigo` na saída
- [X] T016a [US1] **Sweep de `codigo_barras`** (FR-042/FR-045): remover o campo nos sites de construção de `Livro` ainda **não cobertos** por T008/T014/T019 — `src-tauri/src/application/cadastro.rs:96`, `src-tauri/src/application/migracao.rs:65`, `src-tauri/src/adapters/legado/mdb_importer.rs:178`; ao final `grep -rn "codigo_barras" src-tauri/src` deve **zerar**. Confirmar que o upsert do legado usa `ON CONFLICT(codigo)` (codigo agora UNIQUE) e que `migrar_legado` continua idempotente por `codigo`

### UI e testes

- [X] T017 [P] [US1] `src/components/LivroForm.tsx`: remover o campo "Código de barras (EAN/ISBN)"; `codigo` é o único campo de código; manter possibilidade de seed inicial (preparar US4)
- [X] T018 [P] [US1] `src/lib/types.ts` (remover `codigoBarras` de `Livro`) e `src/lib/ipc.ts` (remover `codigoBarras` de `salvarLivro`/DTO); `LancamentoEditor.tsx`/`buscarPorCodigoBarras` seguem (buscam `codigo`)
- [X] T019 [US1] Atualizar testes Rust existentes para o esquema novo (sem `codigo_barras`, `livro_id`): `src-tauri/tests/estoque_repo.rs`, `venda.rs`, `lancamento_repo.rs`, `inventario_repo.rs`, `livro_repo.rs`
- [X] T020 [US1] `cargo test` + `npm run build`/typecheck verdes; rodar `scripts/check-file-size.sh` e `scripts/check-domain-purity.sh` (Princ. III/I) nos arquivos tocados; rodar [quickstart.md](quickstart.md) §0 e §1

**Checkpoint**: esquema migrado sem perda, build/testes verdes → US2–US6 podem começar.

---

## Phase 4: User Story 2 - Marcar pendência como "Já resolvido" (Priority: P1)

**Goal**: dois botões na lista de pendências; "Já resolvido" dispensa sem tocar estoque.

**Independent Test**: clicar "Já resolvido" → sai da lista ativa, 0 livros criados, estoque inalterado.

- [X] T021 [US2] `src/components/Pendencias.tsx`: substituir o botão único por **dois botões distintos** — "Cadastrar livro" (placeholder até US4) e "Já resolvido" (chama `resolverPendencia` existente, FR-002); ajustar textos/ajuda
- [X] T021a [US2] **FR-005** — `src/routes/Inventario.tsx`: renderizar `<Pendencias>` **também na visão de sessão aberta** (hoje só aparece no branch sem sessão, linha ~126), para que "Já resolvido"/"Cadastrar livro" fiquem disponíveis **durante** a contagem; reusar o contador `pend` já existente para recarregar
- [ ] T022 [US2] Validar [quickstart.md](quickstart.md) §2.3 (dispensa tira da lista ativa; estoque/custo inalterados; idempotente) **e** que as ações de pendência aparecem durante e após a sessão (FR-005)

**Checkpoint**: "Já resolvido" funcional (primeiro ganho visível pós-fundação).

---

## Phase 5: User Story 3 - Visualizar inventários realizados (Priority: P1)

**Goal**: lista de inventários realizados + detalhe só-leitura com agregados (faltaram/sobraram/bateram/total).

**Independent Test**: abrir uma sessão fechada → agregados corretos + detalhe por livro + pendências; sem nenhum controle de edição.

### Domínio (regra pura)

- [X] T023 [P] [US3] `src-tauri/src/domain/inventario.rs`: adicionar `ResumoInventario { total, bateram, faltaram, sobraram, soma_diferencas }` e a função pura `resumir(itens: &[(i64, i64)]) -> ResumoInventario` com testes (`#[cfg(test)]`: bateram/faltaram/sobraram/soma; identidade total)

### Aplicação / portas / adapter

- [X] T024 [US3] `src-tauri/src/application/ports_inventario.rs`: `SessaoView` ganha `fechada_em: Option<String>`; adicionar `ResumoView` e os métodos de trait `sessoes_realizadas`, `itens_fechada`
- [X] T025 [US3] `src-tauri/src/adapters/persistencia/inventario_sql.rs` (ou novo `inventario_relatorio_sql.rs` se passar de 300 linhas): query `sessoes_realizadas` (status `fechada`/`cancelada`, com `fechada_em`) e `itens_fechada` (todos os itens do snapshot, **incluindo diferença 0**); atualizar `sessao_de_row` para `fechada_em`
- [X] T026 [US3] `src-tauri/src/adapters/persistencia/inventario_repo.rs`: implementar `sessoes_realizadas` e `itens_fechada` **thin** (toda a SQL em `inventario_relatorio_sql.rs`, T025) — `inventario_repo.rs` já está em ~303 linhas; se passar de 300 **significativas**, extrair antes de prosseguir (Princípio III)
- [X] T027 [US3] `src-tauri/src/application/inventario.rs`: caso de uso `relatorio(sessao_id)` que compõe sessão + `resumir(itens)` + itens + pendências da sessão (FR-011/012/014/015)
- [X] T028 [US3] `src-tauri/src/commands_inventario.rs`: comandos `inventario_realizados` e `inventario_relatorio`; registrar handlers em `src-tauri/src/lib.rs`

### Frontend

- [X] T029 [P] [US3] `src/lib/ipc.ts` + `src/lib/types.ts`: bindings e tipos `SessaoRealizada`, `ResumoInventario`, `RelatorioSessao` (conforme [contracts/tauri-commands.md](contracts/tauri-commands.md))
- [X] T030 [P] [US3] `src/components/ResumoCard.tsx`: card de agregados (total/bateram/faltaram/sobraram/soma)
- [X] T031 [P] [US3] `src/components/InventarioDetalhe.tsx`: detalhe **somente-leitura** (ResumoCard + tabela sistema×contado×diferença + pendências da sessão; sem ações de edição)
- [X] T032 [P] [US3] `src/components/InventariosRealizados.tsx`: lista de sessões realizadas (modo, rótulo, datas, status) com seleção
- [X] T033 [US3] `src/routes/Inventario.tsx`: quando não há sessão aberta, renderizar `<InventariosRealizados/>` (abaixo do form de abertura); selecionar → `<InventarioDetalhe/>`
- [ ] T034 [US3] Rodar `scripts/check-file-size.sh` nos arquivos tocados (Princ. III — atenção a `inventario_repo.rs`/`inventario_sql.rs`/`Inventario.tsx`) e validar [quickstart.md](quickstart.md) §3 (agregados consistentes; nenhuma edição/reabrir/reaplicar)

**Checkpoint**: inventários realizados visíveis e auditáveis.

---

## Phase 6: User Story 4 - "Cadastrar livro" a partir da pendência (Priority: P2)

**Goal**: a pendência leva ao cadastro com `codigo` semeado; ao salvar, resolve a pendência.

**Independent Test**: clicar "Cadastrar livro" → cadastro abre com `codigo` preenchido; ao salvar, a pendência some da lista ativa.

- [X] T035 [US4] `src/routes/Cadastro.tsx`: aceitar um **seed de `codigo`** (via state de rota / param) e abrir `LivroForm` "novo" pré-preenchido
- [X] T036 [US4] `src/components/Pendencias.tsx`: o botão "Cadastrar livro" navega ao Cadastro semeando `codigo` + `pendenciaId`; ao salvar com sucesso, chamar `resolverPendencia(pendenciaId)` (FR-003/004)
- [ ] T037 [US4] Validar [quickstart.md](quickstart.md) §2.5

**Checkpoint**: cadastro a partir da pendência fechando o ciclo.

---

## Phase 7: User Story 5 - Reabrir pendência dispensada (Priority: P3)

**Goal**: recuperar uma pendência marcada como "Já resolvido" por engano.

**Independent Test**: marcar "Já resolvido", ver resolvidas, reabrir → volta à lista ativa com os mesmos dados.

- [X] T038 [US5] `src-tauri/src/application/ports_inventario.rs` + `src-tauri/src/adapters/persistencia/inventario_repo.rs`: método `reabrir_pendencia(id)` (`UPDATE pendencia_cadastro SET resolvida = 0 WHERE id = ?`) (FR-007)
- [X] T039 [US5] `src-tauri/src/commands_inventario.rs` + `lib.rs`: comando `reabrir_pendencia`; binding em `src/lib/ipc.ts`
- [X] T040 [US5] `src/components/Pendencias.tsx`: visão de **resolvidas** (`inventarioPendencias(false)` filtrando `resolvida=1`) com botão "Reabrir" (FR-006)
- [ ] T041 [US5] Validar [quickstart.md](quickstart.md) §2.4

**Checkpoint**: rede de segurança da dispensa pronta.

---

## Phase 8: User Story 6 - Remover "Importar base de dados" do UI (Priority: P3)

**Goal**: tirar o acesso à importação da UI, preservando o backend.

**Independent Test**: nenhum caminho na UI para importar; `migrar_legado` segue registrado; demais fluxos intactos.

- [X] T042 [US6] `src/routes/Inicio.tsx`: comentar/remover o card "Migração / Sincronização do legado" e o estado/handlers/imports associados (`migrarLegado`, `RelatorioMigracao`, `FolderOpen`, `RefreshCw`, `open`, `MDB_KEY`, `caminho`/`ocupado`/`rel`); **não** mexer no backend (FR-020/021/022)
- [ ] T043 [US6] Validar [quickstart.md](quickstart.md) §4 (sem acesso na UI; `migrar_legado` intacto; dados preservados)

**Checkpoint**: importação fora da UI.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T044 [P] Rodar `scripts/check-file-size.sh` (limite de 300 linhas) nos arquivos tocados; extrair módulo/componente onde estourar (candidatos: `inventario_repo.rs`/`inventario_sql.rs`, `Inventario.tsx`, `Pendencias.tsx`)
- [X] T045 [P] Finalizar `docs/adr/0012-identidade-livro-id.md` com a estratégia de migração efetivamente implementada (T003–T006)
- [ ] T046 Rodar [quickstart.md](quickstart.md) completo + `cargo test` + `npm run build` (regressão geral)
- [X] T047 [P] Atualizar memória/contexto se algo não-óbvio surgir na migração (ex.: ordem de drop, FK off)

---

## Dependencies & Execution Order

### Phase/Story dependencies

- **Setup (Phase 1)**: sem dependências.
- **US1 (Phase 3)**: depende do Setup. **Bloqueia US2–US6** (esquema + persistência). Deve estar com `cargo test`/build verdes (T020) antes de seguir.
- **US2 (Phase 4)**: depende de US1. Independente das demais (reusa `resolver_pendencia`).
- **US3 (Phase 5)**: depende de US1. Independente de US2/US4/US5.
- **US4 (Phase 6)**: depende de US1 e de US2 (compartilha o `Pendencias.tsx` com os dois botões).
- **US5 (Phase 7)**: depende de US1 e de US2 (estende a UI de pendências).
- **US6 (Phase 8)**: depende **apenas** de US1 (build) — independente das demais; pode ser feita a qualquer momento após a fundação.
- **Polish (Phase 9)**: depende das stories desejadas concluídas.

### Within US1

- Migração (T003–T006) e rewiring (T007–T016) andam juntos para compilar; UI/testes (T017–T020) ao final.
- T006 (teste) pode ser escrito em paralelo, mas só passa após T003–T005.

### Parallel opportunities

- **Setup**: T001, T002 em paralelo.
- **US1**: T007/T008 (entity/domain) em paralelo; T014/T015 em paralelo; T017/T018 (UI/types) em paralelo. T010–T013/T016 tendem a ser sequenciais (tocam camadas interligadas).
- **US3**: T023 (domínio) e, no front, T029/T030/T031/T032 em paralelo antes do T033 (integração no route).
- **Entre stories**: após US1, **US6** pode rodar em paralelo a US2/US3 por outro dev (arquivo isolado `Inicio.tsx`).

---

## Parallel Example: US1 (entidade + domínio + UI)

```bash
# Após o esqueleto da migração, rodar em paralelo:
Task: "T007 entities/livro.rs: +id, codigo único, -codigo_barras"
Task: "T008 domain/livro.rs: remover campo codigo_barras"
Task: "T017 LivroForm.tsx: remover campo Código de barras"
Task: "T018 types.ts/ipc.ts: remover codigoBarras"
```

## Parallel Example: US3 (frontend)

```bash
Task: "T030 ResumoCard.tsx"
Task: "T031 InventarioDetalhe.tsx"
Task: "T032 InventariosRealizados.tsx"
# depois integrar no route:
Task: "T033 Inventario.tsx: render InventariosRealizados + InventarioDetalhe"
```

---

## Implementation Strategy

### MVP / sequência recomendada

1. **Phase 1 Setup** → **Phase 3 US1** (fundação): migração `m004` + rewiring, com **T006/T020 verdes** (zero perda de dados é o gate). Idealmente em **commit/PR próprio**.
2. **US2** (já resolvido) — primeiro ganho de UX visível.
3. **US3** (visualizar inventários realizados) — valor principal pedido.
4. **US4** (cadastrar a partir da pendência) → **US5** (reabrir) → **US6** (remover importar).

### Incremental delivery

- US1 verde → base sólida (sem valor de usuário direto, mas desbloqueia tudo).
- + US2 → demo "Já resolvido".
- + US3 → demo "ver inventários realizados".
- + US4/US5/US6 → polimento do ciclo de pendências e limpeza da UI.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- US1 mistura migração e rewiring porque **o build não compila** com o esquema pela metade — trate-a como uma unidade até T020.
- **Gate de segurança** da US1: contagem de linhas antes/depois + `PRAGMA foreign_key_check` (FR-044/SC-001). Sem isso verde, não avançar.
- `item_pedido` **não** é tocado (snapshot histórico). Upsert do legado segue por `codigo`.
- Commit após cada tarefa ou grupo lógico; parar nos checkpoints para validar a story isoladamente.
