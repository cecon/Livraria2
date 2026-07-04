---
description: "Task list — Cadastro de formas de pagamento (Crédito, Débito, PIX Igreja)"
---

# Tasks: Cadastro de formas de pagamento (Crédito, Débito, PIX Igreja)

**Input**: Design documents from `specs/005-formas-pagamento/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/tauri-commands.md](contracts/tauri-commands.md), [quickstart.md](quickstart.md)

**Tests**: Incluídos (o spec exige verificação de migração sem perda — SC-002/003 — e o projeto já testa domínio/migração/repos via `cargo test`). Tests acompanham cada camada.

**Organização**: por user story. US3 e US1 são P1; US2 é P2. O **swap do modelo de pagamento + migração `m006`** é fundacional (toda story roda contra o schema migrado) e está nas Phases 2–3, que bloqueiam US1/US2.

**Rev. 2026-07-04**: incorpora as clarificações da sessão 2026-07-03 — FR-016a (falha da migração → rollback + app bloqueia abertura), FR-010/D9 (unicidade de rótulo por comparação normalizada) e FR-007 (bloqueio de reativação com nome conflitante).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3 (Setup/Foundational/Polish não têm label)

## Path Conventions

Desktop Hexagonal: núcleo Rust em `src-tauri/src/`, testes em `src-tauri/tests/`, UI React em `src/`. Dinheiro sempre em centavos inteiros.

---

## Phase 1: Setup

**Purpose**: registro da decisão e baseline verde antes do refactor.

- [X] T001 [P] Criar `docs/adr/0013-cadastro-formas-pagamento.md` a partir das decisões D1–D9 de [research.md](research.md) (registro+junção, remoção das `val_*`, forma de sistema por chave, estratégia `m006` com bloqueio do app em falha, normalização de rótulo); marcar status "Aceita".
- [X] T002 Rodar baseline e registrar testes de pagamento atuais: `cd src-tauri && cargo test` e `npm test` — confirmar verde antes de alterar o modelo.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: trocar o modelo de pagamento (enum/coluna larga → struct + lista + entidades). Bloqueia US1, US2 e US3. **Nada compila contra o DB sem isto + a migração (Phase 3).**

- [X] T003 [P] Reescrever `FormaPagamento` em `src-tauri/src/domain/pagamento.rs` como struct `{id, chave, rotulo, de_sistema, ativa, ordem}`; adicionar enum `ChaveSistema` (credito/dinheiro/pix/ministerio/vale) com `chave()` e `de_legado_metodo()`; validações puras (`nome` não-vazio, `pode_excluir(em_uso)`, `pode_desativar`) e função pura `nome_normalizado(&str)` (trim + lowercase + remoção de diacríticos — FR-010/D9, sem dependência nova); manter `Turno`. Atualizar testes unitários (rótulos/ordem/legado/normalização).
- [X] T004 Atualizar `src-tauri/src/domain/pedido.rs`: substituir struct `Pagamentos` por `Vec<Recebimento{forma_id, valor}>`; `pago()` = Σ; `por_forma_id`; `troco(dinheiro_forma_id)` (excedente válido só até o recebido na forma Dinheiro — FR-013); ajustar `Pedido` e testes.
- [X] T005 [P] Criar entidade `src-tauri/src/adapters/persistencia/entities/forma_pagamento.rs` (id, chave, rotulo, de_sistema, ativa, ordem).
- [X] T006 [P] Criar entidade `src-tauri/src/adapters/persistencia/entities/pagamento_pedido.rs` (pedido_numero, forma_id, valor_centavos; PK composta).
- [X] T007 Atualizar `src-tauri/src/adapters/persistencia/entities/pedido.rs` (remover `val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale`) e registrar as duas entidades novas em `entities/mod.rs`.
- [X] T008 Atualizar `src-tauri/src/application/ports.rs`: adicionar trait `FormaPagamentoRepo` (listar/listar_ativas/por_chave/em_uso/criar/renomear/definir_ativa/reordenar/excluir) e trocar os campos de pagamento de `PedidoRelatorio` por `recebimentos: Vec<RecebimentoRelatorio{forma_id, chave, rotulo, valor_centavos}>`.

**Checkpoint**: domínio e portas compilam isoladamente (sem o DB); testes de domínio verdes.

---

## Phase 3: User Story 3 — Migrar dados existentes sem prejuízo (Priority: P1) 🎯

**Goal**: ao subir o app, todos os valores históricos migram para `pagamento_pedido` sem perda/duplicação; "Cartão" vira "Crédito" (mesma identidade). Em falha, rollback e o app bloqueia a abertura com mensagem clara (FR-016a).

**Independent Test**: sobre base populada (incl. vendas do legado), aplicar a `m006` e comparar Σ por venda e Σ global por forma antes/depois — idênticos; reaplicar não altera nada; falha simulada deixa `val_*` intactas e retorna erro.

- [X] T009 [US3] Criar `src-tauri/src/migration/m006.rs` (espelha `m004`): em transação única — criar `forma_pagamento`+`pagamento_pedido`, semear as 7 formas (todas ativas, flags `de_sistema` conforme [data-model.md](data-model.md)), backfill `val_* > 0` → linhas (por chave), **verificar Σ por pedido e Σ global por forma** (rollback se divergir), rebuild de `pedido` sem `val_*`, `PRAGMA foreign_key_check` limpo; `aplicar()` idempotente por estado e retornando `Err` descritivo em falha da verificação (dados originais intactos — FR-016a).
- [X] T010 [US3] Registrar em `src-tauri/src/migration/mod.rs` (`pub mod m006;`) e chamar `crate::migration::m006::aplicar(db)` **após** `m004` em `src-tauri/src/adapters/persistencia/mod.rs`, **propagando o `Err`** (sem engolir): o setup em `src-tauri/src/lib.rs` captura a falha em `State` gerenciado e expõe o comando `estado_boot` (`{ok, erroMigracao?}` — ver [contracts/tauri-commands.md](contracts/tauri-commands.md)), em vez de seguir o boot normal (FR-016a).
- [X] T011 [US3] Criar tela de bloqueio de migração: componente `src/components/ErroMigracao.tsx` + gate em `src/App.tsx` consultando `estadoBoot()` via `src/lib/ipc.ts` — se `ok=false`, renderizar APENAS a mensagem (atualização dos dados falhou; nenhum valor foi perdido; procurar suporte antes de vender), sem navegação/PDV/cadastros (FR-016a).
- [X] T012 [US3] Testes de migração em `src-tauri/tests/migracao.rs`: (a) base populada — Σ por venda e por forma preservados; (b) reaplicar é no-op (idempotência); (c) `foreign_key_check` limpo; (d) base vazia converge; (e) venda com pagamento esparso/zero não cria linhas e ainda fecha a verificação; (f) **falha simulada** (Σ divergente injetada) → `aplicar()` retorna `Err` e as colunas `val_*` permanecem intactas (rollback — FR-016a).

**Checkpoint**: migração verde sobre base populada (incl. caso de falha) — US3 entregue e demonstrável.

---

## Phase 4: User Story 1 — Registrar venda com as novas formas (Priority: P1) 🎯 MVP

**Goal**: PDV lista as 7 formas ativas (Crédito/Débito/Dinheiro/PIX/PIX Igreja/Ministério/Vale), grava o recebido por forma e os relatórios refletem dinamicamente.

**Independent Test**: vender R$100 dividido em Crédito R$60 + Débito R$40; conferir gravação separada, total e troco (só do Dinheiro).

**Depends on**: Phase 2 + Phase 3 (schema migrado).

- [X] T013 [US1] Criar `src-tauri/src/adapters/persistencia/forma_pagamento_repo.rs` (`SeaFormaPagamentoRepo`) com ao menos `listar`, `listar_ativas`, `por_chave`, `em_uso`.
- [X] T014 [US1] Criar `src-tauri/src/adapters/persistencia/pagamento_pedido_sql.rs` (escrever as linhas de recebimento de um pedido; ler recebimentos por pedido) — mantém `pedido_repo.rs` < 300 linhas (Princípio III).
- [X] T015 [US1] Atualizar `src-tauri/src/adapters/persistencia/pedido_repo.rs`: `inserir_cabecalho_e_itens` grava via `pagamento_pedido_sql` (remover escrita das `val_*`); `importar` idem.
- [X] T016 [US1] Atualizar `src-tauri/src/application/venda.rs`: `PagamentosInput` → `Vec<{forma_id, valor_centavos}>`; resolver a forma `dinheiro` (por chave) para o troco; validar que cada `forma_id` existe e está **ativa**.
- [X] T017 [US1] Atualizar `src-tauri/src/adapters/persistencia/relatorio_repo.rs`: `vendas()` junta `pagamento_pedido` + `forma_pagamento` → `recebimentos` por pedido (ordenado por `ordem`).
- [X] T018 [US1] Atualizar `src-tauri/src/application/relatorios.rs`: `ResumoVendas` dinâmico (`Vec<{forma_id, rotulo, total_centavos}>` por `ordem` + `subtotal_centavos`); atualizar o teste de reconciliação.
- [X] T019 [US1] Atualizar `src-tauri/src/commands.rs`: `registrar_venda` (payload lista) e `relatorio_vendas` (DTO dinâmico); garantir handler de `listar_formas_ativas` registrado em `src-tauri/src/lib.rs`.
- [X] T020 [P] [US1] Atualizar `src/lib/types.ts`: remover `FORMAS_PAGAMENTO`/`FormaKey` fixos; adicionar `FormaPagamento`, `Recebimento` e `ResumoVendas`/`PedidoRelatorio` dinâmicos.
- [X] T021 [US1] Atualizar `src/lib/venda.ts`: `Pagamentos` parametrizado pelas formas carregadas (`forma_id → centavos`); `pagamentosParaPayload` produz a lista; atualizar `src/lib/venda.test.ts`.
- [X] T022 [US1] Atualizar `src/lib/ipc.ts`: binding `listarFormasAtivas`; `registrarVenda` com payload lista; tipos dinâmicos de resumo/recebimentos.
- [X] T023 [US1] Atualizar `src/components/Pdv.tsx`: carregar formas ativas via IPC; renderizar um `PaymentRow` por forma (na `ordem`); troco amarrado à forma `chave='dinheiro'`. Ajustar `src/components/PaymentRow.tsx` para forma genérica.
- [X] T024 [P] [US1] Atualizar `src/components/RelatoriosViews.tsx` e `src/routes/ListaVendas.tsx`: renderizar `recebimentos` e o resumo por forma dinamicamente.

**Checkpoint**: venda multi-forma + relatórios funcionando — MVP (US1) entregue.

---

## Phase 5: User Story 2 — Gerenciar o cadastro de formas (Priority: P2)

**Goal**: tela onde o responsável cria/renomeia/reordena/ativa-desativa formas; excluir só formas não-de-sistema nunca usadas. Unicidade de rótulo por comparação normalizada; reativação com nome conflitante bloqueada.

**Independent Test**: criar "Boleto", reordenar, desativar (some do PDV), tentar criar "boleto" (bloqueado — duplicata normalizada), tentar reativar com nome conflitante (bloqueado), e tentar excluir uma forma usada (bloqueado, orienta desativar).

**Depends on**: Phase 2 + Phase 3 (e reusa o repo criado em T013).

- [X] T025 [US2] Estender `src-tauri/src/adapters/persistencia/forma_pagamento_repo.rs` com `criar`, `renomear`, `definir_ativa`, `reordenar`, `excluir` (checagem de `em_uso` por SQL explícito — FR-017).
- [X] T026 [US2] Criar `src-tauri/src/application/formas_pagamento.rs`: casos de uso com guards — não excluir/desativar de sistema; não excluir em uso; não desativar a última ativa; rótulo não-vazio e único entre ativas por **`nome_normalizado`** (caixa/acentos/trim — FR-010/D9); **reativar com rótulo conflitante bloqueado** com erro orientando renomear antes (FR-007).
- [X] T027 [US2] Criar `src-tauri/src/commands_formas.rs` (`listar_formas`, `criar_forma`, `renomear_forma`, `definir_forma_ativa`, `reordenar_formas`, `excluir_forma`) e registrar handlers em `src-tauri/src/lib.rs`.
- [X] T028 [P] [US2] Adicionar bindings em `src/lib/ipc.ts`: `listarFormas`, `criarForma`, `renomearForma`, `definirFormaAtiva`, `reordenarFormas`, `excluirForma`.
- [X] T029 [US2] Criar `src/components/FormasPagamentoLista.tsx` (listar/reordenar/ativar-desativar/excluir, com mensagens de bloqueio distinguindo os casos: de sistema / em uso / última ativa / reativação com nome conflitante).
- [X] T030 [P] [US2] Criar `src/components/FormaPagamentoForm.tsx` (criar/renomear, exibindo o erro de duplicata normalizada — "credito" = "Crédito").
- [X] T031 [US2] Criar `src/routes/FormasPagamento.tsx` e ligar a navegação em `src/App.tsx`.
- [X] T032 [US2] Testes de repo/uso em `src-tauri/tests/forma_pagamento_repo.rs`: bloqueio por `em_uso`, bloqueio de forma de sistema, bloqueio da última ativa, rótulo duplicado **normalizado** ("boleto" vs "Boleto" vs " BOLETO "), **reativação com nome conflitante bloqueada** (FR-007).

**Checkpoint**: CRUD do cadastro completo refletindo no PDV/relatórios.

---

## Phase 6: Polish & Cross-Cutting

- [X] T033 [P] Atualizar importador do legado `src-tauri/src/adapters/legado/mapeamentos.rs` e `src-tauri/src/adapters/legado/mdb_importer.rs`: montar `Pagamentos` por **chave** (`de_legado_metodo → chave → forma_id`), mantendo `importar` idempotente; atualizar `src-tauri/tests/migracao.rs`/testes de importação.
- [X] T034 [P] Rodar `scripts/check-file-size.sh` nos arquivos tocados (esp. `pedido_repo.rs`, `Pdv.tsx`, `relatorios.rs`, `App.tsx`) e dividir o que passar de 300 linhas (Princípio III).
- [X] T035 [P] Executar [quickstart.md](quickstart.md) ponta a ponta (migração sobre base populada, venda multi-forma, CRUD do cadastro incl. duplicata normalizada e reativação conflitante); `cargo test` + `npm test` verdes. Não tocar `package-lock.json` (memória: npm-only).
- [X] T036 Finalizar `docs/adr/0013-cadastro-formas-pagamento.md` com notas as-built e atualizar o índice `docs/adr/README.md`.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T008)** → **US3 (T009–T012)** desbloqueia o restante.
- **US1 (T013–T024)** e **US2 (T025–T032)** dependem de Foundational + US3. US2 reusa o repo de T013; pode começar após T013/T014 mas idealmente após US1 estabilizar o repo.
- Dentro de US3: T011 (tela de bloqueio) depende de T010 (estado de erro exposto ao frontend).
- **Polish (T033–T036)** por último (legado depende do novo modelo; guardrails/quickstart validam tudo).
- Ordem de stories por prioridade: **US3 (P1) → US1 (P1, MVP) → US2 (P2)**.

## Parallel Opportunities

- Foundational: **T003 (domínio pagamento)**, **T005 (entidade forma)**, **T006 (entidade junção)** em paralelo (arquivos distintos). T004/T007/T008 dependem destes.
- US1: **T020 (types.ts)** e, ao final, **T024 (RelatoriosViews/ListaVendas)** marcados [P]; o backend T013–T019 é majoritariamente sequencial pela cadeia repo→app→commands.
- US2: **T028 (ipc bindings)** e **T030 (FormaPagamentoForm)** [P].
- Polish: **T033/T034/T035** [P] entre si.

## Implementation Strategy

- **MVP** = Phase 1–4 (Setup + Foundational + US3 + US1): modelo migrado sem perda (com fail-safe bloqueante) + venda com as novas formas e relatórios dinâmicos. Já entrega o pedido central (Crédito/Débito/PIX Igreja em uso).
- **Incremento 2** = US2 (cadastro CRUD) — a autonomia ("ficar mais livre").
- **Incremento 3** = Polish (legado por chave, guardrails, ADR as-built).
