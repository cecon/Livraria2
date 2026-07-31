---
description: "Task list — feature 012: PDV de responsabilidade reduzida — fase 2 (a nuvem manda)"
---

# Tasks: PDV de responsabilidade reduzida — fase 2 ("a nuvem manda")

**Input**: Design de `/specs/012-pdv-nuvem-manda/` (plan, spec, research, data-model, contracts, quickstart)

**Prerequisites**: fase 1 em produção (migrações `0011`/`0012`/`0013`; triggers de venda pronta/cancelamento; `0012` republicando o saldo). Retaguarda autenticada (008/010) e layout responsivo (011-escritório).

**Tests**: incluídos onde a constituição exige — **domínio** (regra pura) e **homologação SQL** (idempotência de RPC + republicação). Não há TDD completo.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1/US2/US3/US4/US5 · FR-012 (destinar) · caminhos de arquivo explícitos.

---

## Phase 1: Setup

- [ ] T001 Branch `012-pdv-nuvem-manda` a partir do `main` atualizado; confirmar que as próximas migrações livres da nuvem são **`0014`+** (0011–0013 ocupadas).
- [ ] T002 [P] Escrever **ADR-0024** em `docs/adr/0024-pdv-consumidor-nuvem-manda.md`: PDV consumidor (cadastros somente-leitura + entrada/inventário/destinar na nuvem + cancelamento como fato), com o **tradeoff offline** (entrada/inventário passam a exigir conexão; venda/cancelamento seguem offline). Atualizar `docs/adr/README.md`.

---

## Phase 2: Foundational (Blocking) — regra de saldo e janela (reuso)

**Propósito**: garantir que o saldo exibido no PDV já vem do **saldo operacional** e que a **janela de cancelamento** é única no domínio. Bloqueia US1.

- [ ] T003 Confirmar/expor em `crates/livraria-domain/src/pedido.rs` a **janela de cancelamento** (reuso, já no WASM) e a regra pura de **saldo operacional** (`saldo_publicado − vendas não sync + cancelamentos não sync`); testes verdes em `crates/livraria-domain`.
- [ ] T004 Garantir que a UI de venda do PDV exibe o **saldo operacional** (via `estoque_repo::saldo_operacional`) e não a coluna antiga `estoque`: revisar `src/components/StockBadge.tsx` / `src/components/EntradaProduto.tsx` / `src/lib/ipc.ts`.

**Checkpoint**: o saldo mostrado no PDV é o operacional publicado; a regra de janela é única.

---

## Phase 3: User Story 1 — Venda/cancelamento viram fatos; a nuvem contabiliza (P1) 🎯 MVP

**Goal**: o PDV para de gerar estoque oficial e **manda** o cancelamento; a nuvem baixa/estorna e republica. Corrige o bug de produção.

**Independent Test**: vender → nuvem baixa e republica; cancelar no PDV → pedido re-sincroniza, nuvem estorna, saldo volta e republica; o PDV nunca empurra `saida_venda`/`estorno`.

- [ ] T005 [US1] `src-tauri/src/adapters/persistencia/pedido_repo.rs` — `excluir_pedido`: marcar `cancelado=1`, `cancelado_em`, **`sincronizado_em=NULL`**, `atualizado_em=now()`; **remover** a chamada a `estornar_saidas` (sem estorno local). Manter devolução de carimbos fora do PDV (agora é efeito da nuvem).
- [ ] T006 [US1] `src-tauri/src/adapters/persistencia/pedido_repo.rs` + `pedido_sql.rs` — `registrar`: **não** inserir `movimento_estoque` `saida_venda` nem decrementar `livro.estoque`; gravar pedido/itens/pagamentos + `estoque_status='pronta'`. Vender a quantidade pedida (sem `clamp_baixa_venda` pelo estoque local).
- [ ] T007 [US1] `src-tauri/src/adapters/persistencia/replica_sync.rs` — confirmar que o filtro de push já descarta `saida_venda`/`estorno`; garantir que o `pedido` cancelado (agora `sincronizado_em=NULL`) é re-enviado como pendente.
- [ ] T008 [P] [US1] Teste de domínio em `crates/livraria-domain` — janela de cancelamento (verde) + saldo operacional (venda/cancelamento não sincronizados).
- [ ] T009 [US1] Teste de **conformância/idempotência**: cancelar no PDV → o `pedido` sobe → a nuvem cria **um** `estorno_venda` e republica (script de verificação na nuvem + `cargo test` do repo). Rodar 2× = 1 estorno.
- [ ] T010 [US1] Verificar US1 pelo `quickstart.md` (SC-001 saldo cai/volta, SC-002 convergência do "saldo op.", SC-004 zero `saida_venda`/`estorno` de origem PDV, offline).

**Checkpoint**: cancelamento estorna em produção; PDV não contabiliza. **MVP entregável** (coordenar deploy PDV + nuvem).

---

## Phase 4: User Story 2 — Cadastros somente-leitura no PDV (P1)

**Goal**: fornecedor, forma de pagamento e destinação passam a ser editáveis só na nuvem; PDV só lê.

**Independent Test**: no PDV não há criar/editar/excluir esses cadastros; alteração na nuvem reflete no PDV no próximo sync; a venda ainda usa a forma de pagamento (leitura).

- [ ] T011 [US2] Remover comandos de escrita do PDV: `src-tauri/src/commands_formas.rs` (`criar_forma`/`excluir_forma`) e equivalentes de fornecedor/destinação (ou torná-los no-op explícito com erro pt-BR "edição só na retaguarda").
- [ ] T012 [P] [US2] Remover/ocultar telas de edição no PDV: `src/components/FormaPagamentoForm.tsx`, `FornecedorForm.tsx`, `DestinacaoForm.tsx` (manter seleção/consulta onde a venda precisa, ex.: seletor de forma de pagamento).
- [ ] T013 [US2] `src-tauri/src/adapters/persistencia/replica_mapa.rs` — tornar `fornecedor`/`forma_pagamento`/`destinacao` **pull-only** (o PDV não os empurra); confirmar que continuam sendo baixados.
- [ ] T014 [US2] Retaguarda: edição de `fornecedor`/`forma_pagamento`/`destinacao` (autoridade) em `apps/escritorio/app/cadastros/…`, reusando o padrão da 010 (rota server/RPC que escreve no Postgres + sync).
- [ ] T015 [US2] Verificar US2 pelo `quickstart.md` (SC-003 zero cadastro com origem no PDV; alteração na nuvem chega ao PDV).

**Checkpoint**: fonte única de cadastro; PDV só consome.

---

## Phase 5: User Story 5 — Dashboard do PDV = lista de vendas do turno (P3, independente)

**Goal**: a tela inicial do PDV mostra as vendas do turno aberto, sem indicadores de estoque.

**Independent Test**: com turno aberto e vendas, a home lista as vendas do turno; sem turno, estado vazio.

- [ ] T016 [US5] `src-tauri/src/commands_dashboard.rs` — substituir os indicadores de estoque (`total_livros`/`total_estoque`/`estoque_baixo`) por `dashboard_do_turno()` retornando as vendas do turno aberto (`numero`, `total_centavos`, hora, situação).
- [ ] T017 [US5] Front do PDV — tela inicial = **lista de vendas do turno** (`src/components/ResumoCard.tsx`/home): renderiza a lista + estado vazio ("abra o turno"). Remover os cartões de estoque.
- [ ] T018 [US5] Verificar US5 pelo `quickstart.md` (SC-006).

**Checkpoint**: home do PDV coerente com o novo papel; 100% offline.

---

## Phase 6: User Story 3 — Entrada de nota apenas na nuvem (P2)

**Goal**: entrada de nota sai do PDV e passa a ser feita na retaguarda, afetando o estoque oficial.

**Independent Test**: lançar nota na retaguarda → saldo sobe e republica → PDV mostra o novo saldo; PDV sem a função; idempotente.

- [ ] T019 [US3] Nuvem `apps/nuvem/migrations/0014_lancar_entrada.sql`: RPC `lancar_entrada(...)` `SECURITY DEFINER` — cria `movimento_estoque` `tipo='entrada'` por item (idempotente por (nota,item)), atualiza custo, valida admin. `GRANT ... TO authenticated`. **Aplicar** (com dry-run/rollback, padrão 0012/0013).
- [ ] T020 [P] [US3] Teste de homologação `apps/nuvem/tests/0014_lancar_entrada.sql`: idempotência + republicação (saldo sobe uma vez).
- [ ] T021 [US3] Retaguarda `apps/escritorio/app/entrada/…` + `lib/nuvem/entrada.ts`: tela de lançar nota (fornecedor, itens, custo) chamando a RPC; erros pt-BR.
- [ ] T022 [US3] Remover a entrada de nota do PDV **por completo**: (a) UI/fluxo de lançamento + comandos em `src-tauri/`; (b) **remover do sync** `lancamento_entrada`/`item_lancamento` — `crates/livraria-domain/src/sincronizacao.rs` (`ORDEM_DEPENDENCIA` + ajustar os testes de ordenação nas linhas ~108-109) e `src-tauri/src/adapters/persistencia/replica_mapa.rs` (SPECS); (c) **dropar** as tabelas via migração local idempotente `src-tauri/src/migration/m012.rs` (`DROP TABLE IF EXISTS item_lancamento; DROP TABLE IF EXISTS lancamento_entrada;` — filha antes da pai). Histórico preservado na nuvem.
- [ ] T023 [US3] Verificar US3 pelo `quickstart.md` (SC-005 entrada; PDV sem a função).

**Checkpoint**: entrada centralizada na nuvem.

---

## Phase 7: User Story 4 — Inventário apenas na nuvem (P2)

**Goal**: inventário sai do PDV e passa a ser feito na retaguarda (responsivo p/ balcão), ajustando o estoque oficial.

**Independent Test**: registrar contagem na retaguarda → `ajuste` (delta) → saldo reflete → republica; PDV sem inventário; idempotente.

- [ ] T024 [US4] Nuvem `apps/nuvem/migrations/0015_ajustar_inventario.sql`: RPC `ajustar_inventario(...)` — cria `movimento_estoque` `tipo='ajuste'` `qtd = contado − saldo` por item (idempotente por (sessão,item)), valida admin. **Aplicar**.
- [ ] T025 [P] [US4] Teste de homologação `apps/nuvem/tests/0015_ajustar_inventario.sql`: idempotência (mesma contagem não duplica) + republicação.
- [ ] T026 [US4] Retaguarda `apps/escritorio/app/inventario/…` + `lib/nuvem/inventario.ts`: contagem/ajuste **responsivo** (usável no balcão pelo celular), chamando a RPC.
- [ ] T027 [US4] Remover o inventário do PDV **por completo**: `src/components/InventarioScanner.tsx` + comandos/`inventario_sql.rs` em `src-tauri/`; **dropar** as tabelas (locais, fora do sync) via migração idempotente `src-tauri/src/migration/m013.rs` (`DROP TABLE IF EXISTS item_contagem; DROP TABLE IF EXISTS sessao_inventario;` — filha antes da pai).
- [ ] T028 [US4] Verificar US4 pelo `quickstart.md` (SC-005 inventário; PDV sem a função).

**Checkpoint**: ajuste de inventário centralizado; contagem possível no balcão via retaguarda.

---

## Phase 8: FR-012 — Destinar estoque apenas na nuvem (P2)

**Goal**: a operação de alocação (livre↔carimbos) migra para a nuvem; o PDV só lê os saldos por destinação.

**Independent Test**: destinar na retaguarda → saldos por destinação mudam (total inalterado) e republicam; PDV lê, sem oferecer a operação.

- [ ] T029 [FR-012] Nuvem `apps/nuvem/migrations/0016_destinar_estoque.sql`: RPC `destinar_estoque(...)` — `transferencia_destinacao` compensatória (mecânica da 006, agora na nuvem), idempotente por (livro,de,para,ref), valida admin. **Aplicar**.
- [ ] T030 [FR-012] **Deferir** a publicação de saldos por destinação para o PDV: com `DestinarEstoque` removido não há consumidor no caixa (YAGNI). Registrar a decisão; publicar só se/quando surgir uma tela no PDV que os use.
- [ ] T031 [FR-012] Retaguarda `apps/escritorio/app/estoque/destinar/…`: tela de destinar chamando a RPC.
- [ ] T032 [FR-012] Remover `src/components/DestinarEstoque.tsx` (operação) do PDV, mantendo a **leitura** dos saldos por destinação.
- [ ] T033 [P] [FR-012] Teste de homologação `apps/nuvem/tests/0016_destinar_estoque.sql`: total inalterado + saldos por destinação corretos + idempotência.

**Checkpoint**: carimbos seguem o estoque para a nuvem; PDV só consome.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T034 [P] Guardrail ≤300 linhas (`scripts/check-file-size.sh`) em todos os arquivos novos/alterados; dividir componentes/telas se estourar.
- [ ] T035 [P] Nota de rollout no ADR-0024: coexistência com PDV antigo (idempotência da nuvem) + política de **não** re-empurrar cancelamentos locais antigos em massa (fix forward-looking).
- [ ] T036 Passagem completa do `quickstart.md` (SC-001..006) + `cargo test` (domínio/conformância) + `npm run build -w apps/escritorio` + testes de homologação `0014/0015/0016`.
- [ ] T037 Coordenar **deploy PDV + retaguarda** (o PDV muda o cancelamento/venda; a retaguarda ganha entrada/inventário/destinar) — release novo do PDV.
- [ ] T038 [P] Registrar `m012`/`m013` na ordem de boot (`src-tauri/src/adapters/persistencia/mod.rs`) e verificar: DROP idempotente (re-rodar em base já migrada = no-op); nada tenta sincronizar `lancamento_entrada`/`item_lancamento` após a remoção; o histórico de entrada/inventário existe na nuvem (auditoria preservada). O ledger legado (`movimento_estoque`/`estoque`) permanece intacto (não é dropado).

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T004)** bloqueiam **US1**.
- **US1 (P1)** é o **MVP** (corrige o bug). Independe de US2–US5, mas é a prioridade de entrega.
- **US2 (P1)** e **US5 (P3)** são **independentes** entre si e de US1 → podem correr em paralelo.
- **US3/US4/FR-012 (P2)** são o maior lift (migração + telas novas na nuvem); independentes entre si (migrações `0014`/`0015`/`0016` distintas) → paralelizáveis.
- **Polish (T034–T037)** por último.

## Parallel Opportunities

- `T002` (ADR) em paralelo com o Setup.
- `T012` (telas cadastro) e `T014` (edição na retaguarda) são trilhas distintas.
- **US3, US4, FR-012** correm em paralelo (arquivos/migrações distintas); dentro de cada uma, o teste de homologação (`T020`/`T025`/`T033`) é `[P]` com a tela.
- Polish `T034`/`T035` `[P]`.

## Implementation Strategy

- **MVP = US1** (corrige o bug de cancelamento + remove a trilha dupla de estoque). Entregar e **coordenar deploy** primeiro.
- **Incremento 1**: US2 (cadastros read-only) + US5 (dashboard do turno) — pequenos e independentes.
- **Incremento 2**: US3 + US4 + FR-012 (entrada, inventário, destinar na nuvem) — cada um com migração + tela + remoção do PDV + teste de homologação. Só remover do PDV **quando** a tela da nuvem estiver pronta (sem buraco funcional).
- **Ordem de segurança**: RPC + teste de homologação (verde) **antes** de remover a função do PDV.
