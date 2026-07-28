---
description: "Task list - Feature 011: PDV com responsabilidade reduzida"
---

# Tasks: PDV com Responsabilidade Reduzida

**Input**: Design documents from `/specs/011-pdv-responsabilidade-reduzida/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED because the plan requires migration idempotency, official stock automation, adapter behavior, and quickstart validation before touching production.

**Organization**: grouped by user story (US1 official cloud stock P1, US2 offline sales/shift P2, US3 simple local stock P3, US4 admin stock routines P4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1/US2/US3/US4
- Every task includes an explicit file path.

---

## Phase 1: Setup

**Purpose**: Prepare production-safety documentation, test harness, and ADR before schema changes.

- [X] T001 Create ADR `docs/adr/0023-estoque-oficial-nuvem-venda-pronta.md` documenting cloud official stock, ready sales, full-quantity stock decrease, original-movement reversal, and production baseline preservation
- [X] T002 [P] Update ADR index `docs/adr/README.md` with ADR-0023 entry
- [X] T003 [P] Update cloud migration register `apps/nuvem/migrations/README.md` reserving `0011_estoque_oficial_venda.sql` and noting production backup requirement
- [X] T004 [P] Create SQL validation fixture skeleton `apps/nuvem/tests/0011_estoque_oficial_venda.sql` covering quickstart scenarios without production secrets

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema and contracts required before any user story implementation.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Create idempotent migration file `apps/nuvem/migrations/0011_estoque_oficial_venda.sql` with `pedido` stock status columns, `item_pedido.livro_uid`, and `movimento_estoque` sale/reversal relationship columns
- [X] T006 Add tables `divergencia_estoque` and `saldo_partida_producao` to `apps/nuvem/migrations/0011_estoque_oficial_venda.sql` with RLS enabled and authenticated policies
- [X] T007 Add unique dedup indexes to `apps/nuvem/migrations/0011_estoque_oficial_venda.sql` for one `saida_venda` per `item_pedido_uid` and one `estorno_venda` per `movimento_origem_uid`
- [X] T008 Add `vw_produto_pdv` to `apps/nuvem/migrations/0011_estoque_oficial_venda.sql` exposing published product fields and `saldo_publicado`
- [X] T009 [P] Add TypeScript cloud types for stock statuses and divergences in `apps/escritorio/lib/nuvem/estoque.ts`
- [X] T010 [P] Confirm `divergencia_estoque` and `saldo_partida_producao` remain cloud-only and are not pulled into the PDV sync order in `src-tauri/src/application/sincronizacao.rs`
- [X] T011 [P] Confirm no local replica mappings are created for `divergencia_estoque` or `saldo_partida_producao` in `src-tauri/src/adapters/persistencia/replica_mapa.rs`

**Checkpoint**: Shared schema design exists, is idempotent by construction, and all later tasks can target stable field names.

---

## Phase 3: User Story 1 - Profissionalizar Estoque Oficial na Nuvem (Priority: P1) MVP

**Goal**: Cloud production stock becomes authoritative for sale stock decreases and cancellation reversals, preserving current production stock as baseline.

**Independent Test**: Apply `0011_estoque_oficial_venda.sql` twice in an equivalent environment, create a ready sale, verify one official `saida_venda`, cancel it, verify one exact `estorno_venda`, and confirm baseline stock is unchanged until new events occur.

### Tests for User Story 1

- [X] T012 [US1] Add SQL test harness instructions and execution command comments in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T013 [US1] Add SQL test for migration reapply/idempotency in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T014 [US1] Add SQL test for ready sale creating one full-quantity `saida_venda` in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T015 [US1] Add SQL test for insufficient stock allowing negative saldo and open `saldo_negativo` divergence in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T016 [US1] Add SQL test for repeated ready-sale processing not duplicating `saida_venda` in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T017 [US1] Add SQL test for cancellation reversing original movements exactly once in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T018 [US1] Add SQL test for partial sale not creating stock movement before ready marker in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T019 [US1] Add SQL test for production baseline preservation in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`
- [X] T020 [US1] Add pre/post saldo snapshot audit query for baseline verification in `apps/nuvem/tests/0011_estoque_oficial_venda.sql`

### Implementation for User Story 1

- [X] T021 [US1] Implement baseline capture function `capturar_saldo_partida_producao()` in `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`
- [X] T022 [US1] Implement sale processing function `processar_estoque_venda_pronta()` in `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`
- [X] T023 [US1] Implement negative-stock and inactive-product divergence insertion in `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`
- [X] T024 [US1] Implement cancellation reversal function `processar_estorno_venda_cancelada()` in `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`
- [X] T025 [US1] Add triggers for ready sale and cancellation processing in `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`
- [X] T026 [US1] Remove manual `movimento_estoque` insertion from cloud checkout in `apps/escritorio/lib/nuvem/venda.ts`
- [X] T027 [US1] Mark completed cloud checkout sales as ready using `estoque_status = 'pronta'` in `apps/escritorio/lib/nuvem/venda.ts`
- [X] T028 [US1] Replace partial-stock warning return with divergence-aware sale result in `apps/escritorio/lib/nuvem/venda.ts`
- [X] T029 [US1] Expose open stock divergences through `listarDivergenciasEstoque()` in `apps/escritorio/lib/nuvem/estoque.ts`
- [X] T030 [US1] Update movement list display labels for `saida_venda` and `estorno_venda` in `apps/escritorio/components/ExtratoMovimentos.tsx`

**Checkpoint**: US1 proves the cloud can own official stock before PDV responsibility is reduced.

---

## Phase 4: User Story 2 - Vender Offline com Turno Local (Priority: P2)

**Goal**: PDV keeps local shift and sale operation offline while sending completed sale/cancellation events for cloud official stock processing.

**Independent Test**: Put PDV offline, open a shift, sell a known product, close the shift, reconnect, sync the sale as ready, and verify cloud official stock processes it once.

### Tests for User Story 2

- [X] T031 [P] [US2] Add Rust sync test for sale payload containing ready marker and no manual stock movement in `src-tauri/tests/replica_venda.rs`
- [X] T032 [P] [US2] Add Rust sync test for cancellation payload containing `cancelado` and no manual reversal movement in `src-tauri/tests/sync_e2e.rs`
- [X] T033 [P] [US2] Add Rust offline shift/sale regression test in `src-tauri/tests/venda.rs`
- [X] T034 [P] [US2] Add Rust test for local shift close summary with sales, payments, and sync pendencies in `src-tauri/tests/venda.rs`

### Implementation for User Story 2

- [X] T035 [US2] Stop pushing `movimento_estoque` rows derived from sales/cancellations in `src-tauri/src/adapters/persistencia/replica_sync.rs`
- [X] T036 [US2] Include `estoque_status = 'pronta'` when syncing completed local sales in `src-tauri/src/adapters/persistencia/replica_sync.rs`
- [X] T037 [US2] Include cancellation metadata for synced canceled sales in `src-tauri/src/adapters/persistencia/replica_sync.rs`
- [X] T038 [US2] Ensure local sale commands still open/close shifts and sell without network in `src-tauri/src/commands.rs`
- [X] T039 [US2] Implement local shift close summary with sales, payments, and sync pendencies in `src-tauri/src/commands.rs`
- [X] T040 [US2] Update sync docs for ready-sale and cancellation payloads in `specs/011-pdv-responsabilidade-reduzida/contracts/sync-pdv-saldo-local.md`

**Checkpoint**: PDV remains offline-first but delegates official stock effects to the cloud after sync.

---

## Phase 5: User Story 3 - Consultar Produto com Saldo Local Simples no PDV (Priority: P3)

**Goal**: PDV displays operational stock as cloud-published stock adjusted by unsynced local sales and cancellations.

**Independent Test**: Sync a product with `saldo_publicado = 10`, sell 2 offline, cancel 1 offline, and verify PDV displays 9 as operational stock.

### Tests for User Story 3

- [X] T041 [P] [US3] Add Rust unit test for simple local balance formula in `src-tauri/tests/estoque_repo.rs`
- [X] T042 [P] [US3] Add Rust sync pull test for `vw_produto_pdv.saldo_publicado` in `src-tauri/tests/sync_e2e.rs`

### Implementation for User Story 3

- [X] T043 [US3] Pull `vw_produto_pdv` product snapshots into local catalog fields in `src-tauri/src/adapters/nuvem/supabase_sync.rs`
- [X] T044 [US3] Add local calculation for `saldo_local = saldo_publicado - vendas_nao_sincronizadas + cancelamentos_nao_sincronizados` in `src-tauri/src/adapters/persistencia/estoque_repo.rs`
- [X] T045 [US3] Update product search/details DTOs to expose operational saldo label in `src-tauri/src/commands.rs`
- [X] T046 [US3] Update PDV product display text to label stock as operational/simple in `src/components/Pdv.tsx`
- [X] T047 [US3] Remove or hide local product stock accounting actions from PDV navigation in `packages/ui/src/nav.tsx`
- [X] T048 [US3] Add sync-cycle test for offline sale reconnecting and surfacing cloud divergence in `src-tauri/tests/sync_e2e.rs`

**Checkpoint**: PDV shows useful stock for selling without claiming accounting authority.

---

## Phase 6: User Story 4 - Centralizar Rotinas Administrativas de Estoque na Nuvem (Priority: P4)

**Goal**: Administrative inventory work, official reports, and divergence resolution live in the cloud, not the PDV.

**Independent Test**: Resolve a cloud divergence administratively, verify official reports use cloud data, and confirm PDV no longer offers stock accounting routines.

### Tests for User Story 4

- [X] T049 [P] [US4] Add TypeScript test for divergence listing and status updates in `apps/escritorio/lib/nuvem/__tests__/estoque.test.ts`
- [X] T050 [P] [US4] Add TypeScript report test proving stock reports read official cloud saldo in `apps/escritorio/lib/nuvem/__tests__/relatorios.test.ts`
- [X] T051 [US4] Add TypeScript test confirming cloud-only stock admin routines are linked from the Escritorio and absent from PDV routes in `apps/escritorio/lib/nuvem/__tests__/estoque.test.ts`

### Implementation for User Story 4

- [X] T052 [US4] Add divergence resolution functions `resolverDivergenciaEstoque()` and `ignorarDivergenciaEstoque()` in `apps/escritorio/lib/nuvem/estoque.ts`
- [X] T053 [US4] Create cloud divergence review UI in `apps/escritorio/app/estoque/divergencias/page.tsx`
- [X] T054 [US4] Link divergence review from stock/admin navigation in `packages/ui/src/nav.tsx`
- [X] T055 [US4] Ensure stock reports read official cloud saldo and include negative saldo in `apps/escritorio/lib/nuvem/relatorios.ts`
- [X] T056 [US4] Confirm cloud product catalog remains the authoritative cadastro path in `apps/escritorio/app/cadastro/page.tsx`
- [X] T057 [US4] Confirm cloud entry, inventory, adjustment, and cost routines are available or explicitly linked from `apps/escritorio/app/inventario/page.tsx` and `apps/escritorio/app/lancamentos/page.tsx`
- [X] T058 [US4] Remove or disable PDV entry/inventory/adjustment UI routes from `src/App.tsx`
- [X] T059 [US4] Block or remove PDV stock accounting Tauri commands in `src-tauri/src/commands_estoque.rs`
- [X] T060 [US4] Block or remove PDV inventory Tauri commands in `src-tauri/src/commands_inventario.rs`
- [X] T061 [US4] Block or remove PDV entry/invoice Tauri commands in `src-tauri/src/commands_lancamento.rs`
- [X] T062 [US4] Add user-facing redirect or disabled-state text for removed PDV stock admin routines in `src/routes/Pesquisa.tsx`

**Checkpoint**: Cloud is the administrative stock home; PDV is reduced to operational selling and consultation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Production readiness, validation, and guardrails across all stories.

- [X] T063 [P] Run quickstart validation and record results in `specs/011-pdv-responsabilidade-reduzida/quickstart.md`
- [X] T064 [P] Run file-size guardrail and split any file over 300 significant lines using `scripts/check-file-size.sh`
- [X] T065 [P] Run Rust validation for PDV changes with `src-tauri/Cargo.toml` test targets
- [X] T066 [P] Run Escritório build/test validation for changed TypeScript files using `apps/escritorio/package.json`
- [X] T067 [P] Verify no production secrets or Supabase service-role keys were added in `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`
- [X] T068 Update implementation notes and production rollout checklist in `apps/nuvem/migrations/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every user story.
- **US1 (Phase 3)**: depends on Foundational and is the MVP.
- **US2 (Phase 4)**: depends on US1 contract decisions; can start after cloud ready-marker schema exists.
- **US3 (Phase 5)**: depends on Foundational and the `vw_produto_pdv` view; can proceed after T008.
- **US4 (Phase 6)**: depends on US1 divergence model and is best after US1 validates.
- **Polish (Phase 7)**: after desired story scope is complete.

### User Story Dependencies

- **US1 (P1)**: first deliverable; no dependency on later stories.
- **US2 (P2)**: depends on US1 stock contract to avoid duplicate stock effects.
- **US3 (P3)**: depends on product publication view from Foundational; independent of US2 implementation.
- **US4 (P4)**: depends on divergence entities from US1; can be built incrementally.

### Within Each User Story

- Tests should be written first and fail before implementation.
- Schema/functions before client adapters.
- Adapters before UI.
- Quickstart checkpoint before moving to production.

### Parallel Opportunities

- T002, T003, T004 can run in parallel after T001.
- T009, T010, T011 can run in parallel after schema names stabilize.
- T012-T020 are SQL tests in the same file and should be coordinated sequentially or split before parallel work.
- US3 can begin after T008 even while US2 progresses.
- US4 report/UI tasks can run in parallel after divergence functions exist.

---

## Parallel Example: User Story 1

```text
Task: "Add SQL test for ready sale creating one full-quantity saida_venda in apps/nuvem/tests/0011_estoque_oficial_venda.sql"
Task: "Add SQL test for cancellation reversing original movements exactly once in apps/nuvem/tests/0011_estoque_oficial_venda.sql"
Task: "Expose open stock divergences through listarDivergenciasEstoque() in apps/escritorio/lib/nuvem/estoque.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: US1 official cloud stock.
4. Stop and validate quickstart scenarios 1-5 before changing PDV behavior.
5. Apply to production only after backup/snapshot and idempotency reapply pass.

### Incremental Delivery

1. US1: cloud owns official sale/cancellation stock effects.
2. US2: PDV sync sends ready sales/cancellations without official stock movements.
3. US3: PDV shows simple operational local stock.
4. US4: cloud stock administration and divergence workflow.

### Production Rollout Notes

- Preserve production stock as baseline; do not reprocess historical sales to change current saldo.
- Deploy client changes that stop manual `movimento_estoque` writes together with the cloud automation.
- Keep rollback simple: restore from backup/snapshot if production validation fails before accepting new sales.
- Never commit production credentials; use Notion memory for secrets.
