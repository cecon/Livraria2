---
description: "Task list — feature 011: cancelar/reabrir venda + responsivo (Escritório)"
---
# Tasks: Escritório — cancelar/reabrir venda com estorno fiel e uso no celular

**Input**: Design de `/specs/011-escritorio-cancelamento-responsivo/` (plan, spec, research, data-model, contracts, quickstart)
**Prerequisites**: feature 009 (venda/turno no Escritório) + a paridade de caixa 1+2 (input maquininha, botão restante, bloqueio de falta) já feita em `fix/venda-escritorio-paridade`
**Tests**: incluídos onde a constituição exige (domínio + **conformância nativo↔SQL do estorno** + idempotência).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1/US2/US3 · caminhos de arquivo explícitos.

---

## Phase 1: Setup

- [ ] T001 Branch `011-escritorio-cancelamento-responsivo` (a partir do `main` atualizado); confirmar que a próxima migração livre da nuvem é **`0011`** (existem `0001`–`0010`).

---

## Phase 2: Foundational (Blocking) — base do cancelamento idempotente

**Propósito**: a **identidade determinística** do estorno (D2) — o que faz a idempotência atravessar o sync. Bloqueia US1/US3 (não a US2).

- [ ] T002 [P] Fixar `NS_LIVRARIA = f5bc34a5-3b33-409c-96d0-a56664436ba7` (UUID **literal** compartilhado) e a fórmula `sync_uid(estorno)=uuidv5(NS,"estorno:"||pedido||":"||livro)` — o **mesmo literal** hardcoded na RPC (SQL) e no PDV (Rust). Documentar em `data-model.md`; o T006 confirma que os dois geram o mesmo `sync_uid`.
- [ ] T003 Foundational PDV: `src-tauri/src/adapters/persistencia/pedido_sql.rs` — o movimento de **estorno** passa a gravar `sync_uid` **determinístico** (uuidv5 por pedido/livro) em vez do aleatório do backfill; teste unitário do uid (mesma entrada → mesmo uid).
- [ ] T004 [P] Confirmar/expor `livraria_domain::pedido::pode_cancelar_venda` (janela 5 dias) no domínio + WASM — reusar (já existe); teste da janela verde.

**Checkpoint**: o estorno tem uid determinístico dos dois lados; a regra de janela é única (domínio/WASM).

---

## Phase 3: User Story 1 — Cancelar venda (P1) 🎯 MVP

**Goal**: admin cancela uma venda pela lista; devolve estoque **e** carimbos, respeita a janela, idempotente (inclusive no sync).
**Independent Test**: cancelar uma venda de hoje → estoque volta exato, carimbo volta, some do total mas fica no histórico; repetir/concorrer = 1 estorno; sincroniza com o PDV.

- [ ] T005 [US1] Nuvem `apps/nuvem/migrations/0011_cancelar_venda.sql`: RPC `cancelar_venda(p_admin,p_pedido)` `SECURITY DEFINER`, **transacional** — valida admin ativo + **janela 5 dias**; **idempotência** (já cancelado → no-op); **devolve carimbos** (`transferencia_destinacao` compensatória, uid determinístico); **estorna estoque** (`movimento_estoque tipo='estorno'`, `net<0`, uid determinístico); marca `pedido.cancelado/cancelado_em/atualizado_em/sincronizado_em`. `GRANT ... TO authenticated`. **Aplicar**.
- [ ] T006 [US1] Teste de **conformância** nativo (PDV `excluir_pedido`) ↔ SQL (RPC): mesmo pedido → **mesmo** efeito em estoque e carimbo; e **idempotência** (rodar 2× + simular concorrência PDV+nuvem → **1** estorno). `src-tauri/tests/` + script de verificação na nuvem.
- [ ] T007 [US1] Escritório `apps/escritorio/app/api/vendas/cancelar/route.ts`: rota server que lê `app_user` (cookie httpOnly) e chama a RPC `cancelar_venda`; mapeia erros (janela/permissão) pt-BR.
- [ ] T008 [US1] Escritório `apps/escritorio/lib/nuvem/venda.ts`: `cancelarVenda(pedidoNumero)` → chama `/api/vendas/cancelar`.
- [ ] T009 [US1] Escritório `apps/escritorio/app/venda/page.tsx`: ação **Cancelar** na aba "Lista de vendas" (confirmação; **janela via WASM** desabilita fora de 5 dias; recarrega; venda fica riscada/"cancelada").
- [ ] T010 [US1] Verificar US1 pelo `quickstart.md` (SC-001 estoque, SC-002 carimbo, SC-003 janela, SC-004 idempotência, SC-005 histórico, sync com o PDV). **Confirmar que o dashboard/listagem já exclui canceladas dos totais** (comportamento da 009); ajustar só se falhar.

**Checkpoint**: cancelamento fiel e idempotente pela retaguarda. **MVP entregável.**

---

## Phase 4: User Story 2 — Escritório no celular (P1)

**Goal**: a retaguarda vira utilizável no celular (base única, breakpoints), sem regredir o desktop.
**Independent Test**: abrir cada tela em ~360px e completar as tarefas sem rolagem horizontal; concluir uma venda no celular.

- [ ] T011 [P] [US2] Shell responsivo: `apps/escritorio/components/AppSidebar.tsx` + `apps/escritorio/app/layout.tsx` — sidebar **off-canvas/drawer** abaixo de `md` (botão hambúrguer), fixa no desktop; root sem `overflow-x`.
- [ ] T012 [P] [US2] Dashboard e stat tiles `apps/escritorio/app/page.tsx`: grids `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; blocos empilham no mobile.
- [ ] T013 [US2] Tabelas → **cards no mobile** (tabela ≥ `md`): `/cadastro` (livros), `/venda` (lista), `/lancamentos`, `/usuarios` — mesmos dados essenciais, sem rolagem horizontal.
- [ ] T014 [US2] Caixa responsiva `apps/escritorio/app/venda/page.tsx` + `components/FormasPagamento.tsx`: colunas empilham no mobile; alvos de toque ≥ 40px (input maquininha já ok da paridade 1+2).
- [ ] T015 [US2] Verificar US2 pelo `quickstart.md` (SC-006 sem rolagem horizontal em ~360px; SC-007 venda no celular < 2 min; SC-008 desktop sem regressão).

**Checkpoint**: retaguarda usável no celular, desktop intacto.

---

## Phase 5: User Story 3 — Reabrir/clonar venda (P2)

**Goal**: reabrir cancela a original (estoque/carimbo de volta) e abre o clone no caixa pra corrigir.
**Independent Test**: reabrir → original cancelada + caixa com os mesmos itens; concluir → 1 venda válida; desistir → nenhuma nova.

- [ ] T016 [US3] Escritório `apps/escritorio/lib/nuvem/venda.ts`: `reabrirVenda(pedidoNumero)` — chama `cancelarVenda` e retorna os **itens** da venda para carregar no caixa.
- [ ] T017 [US3] Escritório `apps/escritorio/app/venda/page.tsx`: ação **Reabrir** (cancela original + volta pra aba "Venda" com itens carregados; janela via WASM).
- [ ] T018 [US3] Verificar US3 pelo `quickstart.md` (original cancelada + estoque devolvido; caixa com itens; desistir não cria venda).

**Checkpoint**: fluxo de correção completo, paridade com o PDV.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T019 [P] Nota no `docs/adr/0016-sync-identidade-convergencia.md`: **identidade determinística de estorno** (uuidv5 por pedido) p/ idempotência **através** do sync.
- [ ] T020 [P] Guardrail ≤300 linhas (`scripts/check-file-size.sh`) nos arquivos novos/alterados; dividir tabela↔cards em componente se estourar.
- [ ] T021 [P] Idempotência: re-aplicar `0011` em base já migrada (`create or replace`) — no-op; re-rodar a RPC num pedido já cancelado — no-op.
- [ ] T022 Passagem completa do `quickstart.md` (SC-001..008) + `cargo test` (domínio + conformância) + `npm run build -w apps/escritorio`.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** bloqueiam **US1/US3** (não a US2).
- **US1 (P1)** depende do Foundational (uid determinístico + janela).
- **US2 (P1)** depende só do Setup → pode correr **em paralelo** com Foundational+US1. Junto com US1 formam o **MVP**.
- **US3 (P2)** depende da US1 (RPC + `cancelarVenda`).
- **Polish** por último.

## Parallel Opportunities

- `T002` + `T004` (identidade + confirmação da janela) — trilhas distintas.
- **US2 inteira** (T011–T014) em paralelo com o Foundational/US1 (equipe/arquivos diferentes); `T011`/`T012` marcados `[P]`.
- Polish `T019`/`T020`/`T021` `[P]`.

## Implementation Strategy

- **MVP = US1 + US2** (ambos P1): o cancelamento fiel (o pedido de maior risco) **e** o uso no celular.
- **Incremento**: US3 (reabrir/clonar).
- **Ordem de segurança da US1**: T005 (RPC) → **T006 (conformância + idempotência) ANTES** de expor a UI (T009) — não encostar em produção sem o teste verde (lição do A PONTE).

## Notas de coordenação

- **Numeração**: nuvem `0011` (0001–0010 ocupados; `0010_turno` é da 009). Estorno determinístico muda o
  PDV (`pedido_sql`) — vai num build novo do PDV; **coordenar deploy** PDV + retaguarda.
- **DRY**: a *mecânica* de estorno fica em Rust (PDV) e SQL (RPC) — o **T006 (conformância)** é o que
  garante que não divergem (a regra de negócio segue única no domínio).
