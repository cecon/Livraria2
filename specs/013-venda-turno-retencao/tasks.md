# Tasks: PDV — venda vinculada a turno, sync só-sobe e retenção de 45 dias

**Input**: Design documents from `/specs/013-venda-turno-retencao/` (spec.md + plan.md)

**Prerequisites**: plan.md ✅, spec.md ✅ (research/data-model/contracts não foram fatiados; o design vive no plan.md)

**Tests**: incluídos apenas nas **regras de domínio e mecânicas de risco** (saldo operacional, poda FK-safe, reconciliação de fechamento) — exigência do quality gate da constituição ("regras de domínio cobertas por testes sem UI/banco").

**Organization**: por user story (US1..US6), cada uma entregável e testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1..US6 (fases de história); Setup/Foundational/Polish sem label

## Contexto de estrutura (do plan.md)

Base já existente (feature 009): `pedido.turno_uid` e `pedido.numero_no_turno` **já existem** e sincronizam; `turno_operacao` já sincroniza (sync_uid PK, status aberto/encerrado); domínio `turno_operacao.rs` tem `StatusTurno`, `pode_registrar_venda`, `proximo_numero(qtd_no_turno)`. Esta feature **força/usa** isso + push-only + poda + máquina.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: base compartilhada (ADR, migração de colunas, porta da máquina)

- [x] T001 **ADR-0025** criado em `docs/adr/0025-turno-como-unidade-venda-push-only.md` (venda push-only; identidade do turno por máquina; `numero_no_turno` como Pedido Nº exibido — número contínuo preservado; poda local 45d FK-safe; reconciliação de fechamento; nota de terminologia Fechar↔encerrado). Também criado o débito **ADR-0024** (PDV consumidor, feature 012) que a constituição referenciava.
- [x] T002 Migração idempotente **m014** em `src-tauri/src/migration/m014.rs` (ADD COLUMN ignorando "duplicate column": `turno_operacao.maquina TEXT`; `pedido.ja_sincronizado INTEGER NOT NULL DEFAULT 0`) e registrar no boot em `src-tauri/src/adapters/persistencia/mod.rs` (após m013)
- [x] T003 [P] Porta `Maquina` (nome do PC) em `src-tauri/src/application/ports.rs` + adapter `src-tauri/src/adapters/persistencia/maquina.rs` (hostname do sistema)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: regras puras de turno que bloqueiam US1/US3/US5. **MUST completar antes das histórias.**

- [x] T004 Domínio em `crates/livraria-domain/src/turno_operacao.rs`: adicionar guardas puras + testes — `pode_abrir(ha_turno_aberto) -> bool` (só abre se não há aberto), `pode_cancelar(venda_turno_uid, turno_aberto_uid) -> bool` (só cancela venda do turno aberto), `turno_podavel(status, data_iso, hoje_iso, dias=45) -> bool` (encerrado + > 45 dias)

**Checkpoint**: domínio de turno pronto e testado sem UI/banco.

---

## Phase 3: User Story 1 — Venda exige turno aberto (Priority: P1) 🎯 MVP

**Goal**: nenhuma venda/cancelamento sem turno aberto; **um único** turno aberto por PDV; cancela só do turno aberto.

**Independent Test**: com turno fechado, vender/cancelar é bloqueado; ao abrir, vincula; segundo turno é recusado enquanto há um aberto.

- [x] T005 [US1] `src-tauri/src/application/turno.rs`: `abrir_ou_continuar(operador)` — se há turno aberto, retorna-o; senão abre novo (grava `abertura`, `operador`, `maquina` via porta `Maquina`); recusa 2º turno usando domínio `pode_abrir`
- [x] T006 [US1] `src-tauri/src/application/turno.rs`: `encerrar(fechamento)` reusando `marcar_encerrado`/`encerrar` do domínio
- [x] T007 [US1] `src-tauri/src/application/venda.rs`: exigir turno aberto ao registrar (usa `pode_registrar_venda`); erro de aplicação claro "abra um turno" quando não há
- [x] T008 [US1] `src-tauri/src/adapters/persistencia/pedido_repo.rs`: `registrar` grava `turno_uid` do turno aberto e `numero_no_turno` (via `proximo_numero` pela contagem de pedidos do turno)
- [x] T009 [US1] `src-tauri/src/application/cancelamento.rs`: permitir cancelar só se a venda pertence ao turno aberto (`pode_cancelar`); venda de turno fechado → erro "corrija no escritório"
- [x] T010 [US1] `src-tauri/src/commands_turno.rs` + `commands.rs`: expor `abrir_ou_continuar`/`encerrar`/estado do turno; `registrar_venda`/`excluir_pedido` retornam o erro de "sem turno" para o front
- [x] T011 [US1] Front `src/`: **bloqueio incisivo** — sem turno aberto, a janela de venda **não renderiza a UI de venda**; mostra uma chamada destacada para abrir turno (não um toast/aviso dispensável). Fluxo de abrir/continuar turno (FR-002)
- [x] T012 [US1] Front `src/`: aviso de **turno aberto após a virada do dia** (FR-023) — alerta para fechar/conferir, sem auto-fechar
- [x] T013 [P] [US1] Testes de integração em `src-tauri/tests/turno_venda.rs`: venda sem turno bloqueada; com turno vincula (`turno_uid` + `numero_no_turno`); cancelamento só do turno aberto; recusa de 2º turno aberto

**Checkpoint**: US1 entregue — disciplina de turno funcionando (MVP).

---

## Phase 4: User Story 2 — Vendas só sobem (Priority: P1)

**Goal**: `pedido` e filhas viram push-only; saldo operacional passa a usar marcador local.

**Independent Test**: dois PDVs não baixam vendas um do outro; saldo operacional correto em venda→sync→cancelar sem baixar vendas.

- [ ] T014 [US2] `src-tauri/src/adapters/persistencia/replica_mapa.rs`: introduzir `push_only(recurso)` e marcar `pedido`, `item_pedido`, `pagamento_pedido`, `alocacao_venda` como push-only
- [ ] T015 [US2] `src-tauri/src/adapters/persistencia/replica_sync.rs`: **pull ignora** recursos push-only (não baixa vendas); push continua enviando na `ORDEM_DEPENDENCIA`
- [ ] T016 [US2] `src-tauri/src/adapters/persistencia/pedido_repo.rs` (ou caminho de push): ao confirmar o envio (`sincronizado_em` setado), marcar `pedido.ja_sincronizado = 1` — persistente, **nunca** limpo pelo cancelamento
- [ ] T017 [US2] `src-tauri/src/adapters/persistencia/estoque_repo.rs`: em `saldo_operacional`, trocar o filtro do termo `+cancelamento` de `estoque_status='incorporada'` para **`ja_sincronizado = 1`** (marcador local em vez do estado puxado)
- [ ] T018 [P] [US2] Testes em `src-tauri/tests/estoque_repo.rs` (adaptar os do fix v26.8.3): saldo correto em venda 'pronta' offline→cancela (net zero) e venda sincronizada→cancela (+restaura) usando `ja_sincronizado`; teste de que o pull não traz vendas (push-only)

**Checkpoint**: US2 entregue — vendas só sobem, saldo operacional íntegro sem baixar vendas.

---

## Phase 5: User Story 5 — Turno único por máquina + numeração + header (Priority: P2)

**Goal**: máquina compõe a identidade/exibição do turno; `numero_no_turno` é o "Pedido Nº"; header mostra PC + operador.

**Independent Test**: numeração reinicia em 1 por turno; turnos de máquinas diferentes têm `maquina` distinta; header sempre mostra PC + operador.

- [ ] T019 [US5] `src-tauri/src/adapters/persistencia/replica_mapa.rs`: incluir a coluna `maquina` no recurso `turno_operacao` (sobe para a nuvem)
- [ ] T020 [US5] Front `src/`: exibir `numero_no_turno` como **"Pedido Nº"** na lista/recibo/relatório (deixar de exibir o `numero` global)
- [ ] T021 [US5] Front `src/components/` (header): mostrar sempre **PC (maquina) + operador** do turno aberto; sem turno, indicar claramente (FR-021)
- [ ] T022 [P] [US5] Teste em `src-tauri/tests/turno_venda.rs`: `numero_no_turno` reinicia 1..N por turno; `maquina` preenchida e distinta por PDV

**Checkpoint**: US5 entregue — turno "pertence" à máquina, numeração limpa por turno, header informativo.

---

## Phase 6: User Story 3 — Retenção/poda de 45 dias (Priority: P2)

**Goal**: podar localmente turnos encerrados+sincronizados+>45d; nuvem retém tudo.

**Independent Test**: poda remove antigo encerrado+sincronizado; preserva aberto/não-sinc/≤45d; não toca livro/saldo; idempotente.

- [ ] T023 [US3] `src-tauri/src/application/poda.rs` (NOVO): podar turnos com `status='encerrado'` + sincronizados + `data < hoje-45`, removendo em **cascata filha→pai** (`alocacao_venda` → `pagamento_pedido` → `item_pedido` → `pedido` → `turno_operacao`) — **FK-safe** (lição do incidente m013/787)
- [ ] T024 [US3] `src-tauri/src/lib.rs`: rodar a poda no **boot** e **após sync** bem-sucedido (idempotente, não bloqueia a UI)
- [ ] T025 [P] [US3] Testes em `src-tauri/tests/poda.rs`: remove encerrado+sinc+>45d; **preserva** turno aberto, não-sincronizado e ≤45d; **não** altera `livro`/`saldo_publicado`; idempotente; reproduz cluster com FKs para provar FK-safe

**Checkpoint**: US3 entregue — banco local limitado a ~45 dias, sem perder nada.

---

## Phase 7: User Story 4 — PDV focado nos turnos recentes (Priority: P3)

**Goal**: tela inicial = lista de vendas do turno (formato do relatório); telas limitadas a ≤45 dias.

**Independent Test**: tela inicial mostra as vendas do turno no formato do relatório; relatórios/busca não retornam >45 dias.

- [ ] T026 [US4] Front `src/routes/Inicio.tsx`: lista **apenas** das vendas do **turno aberto** reusando o **componente da lista do relatório** (FR-022), atualizando ao vender/cancelar; sem turno, lista vazia + chamada para abrir
- [ ] T027 [US4] Front `src/` (relatórios/busca): limitar à janela de ≤45 dias e indicar "histórico completo no escritório" para consultas anteriores (FR-012)

**Checkpoint**: US4 entregue — PDV focado no turno corrente.

---

## Phase 8: User Story 6 — Escritório vê turnos + fecha + reconciliação + backfill (Priority: P3)

**Goal**: nuvem enxerga/fecha turnos; fechamento desce; pendências viram novo turno; vendas históricas ganham turno padrão.

**Independent Test**: escritório lista turnos abertos/fechados; fechar pela nuvem encerra no PDV; fechar com pendências cria novo turno; backfill zera vendas sem turno.

- [ ] T028 [US6] `apps/nuvem/migrations/0014_turno_padrao_backfill.sql`: criar **um turno padrão global** (fechado/conferido, idempotente `if not exists`) + `UPDATE pedido SET turno_uid = <padrão> WHERE turno_uid IS NULL` (FR-014)
- [ ] T029 [P] [US6] Homologação SQL em `apps/nuvem/tests/`: backfill idempotente; **zero** pedidos sem turno após rodar (SC-009)
- [ ] T030 [US6] `apps/escritorio/`: página de **visão de turnos** (abertos/fechados) por máquina, usuário, status, período e totais (FR-018)
- [ ] T031 [US6] `apps/escritorio/`: ação **"fechar turno"** disponível a **qualquer usuário do escritório** (FR-019) — grava `status='encerrado'` + `atualizado_em` (LWW) na nuvem
- [ ] T032 [US6] `src-tauri/src/adapters/persistencia/replica_sync.rs`: ao puxar `turno_operacao` com `status='encerrado'`, aplicar o fechamento local; se houver **vendas não sincronizadas** do turno, **criar um novo turno** e migrar as pendentes para ele (FR-024) — o turno fechado permanece fechado
- [ ] T033 [P] [US6] Testes em `src-tauri/tests/turno_fechamento_nuvem.rs`: fechamento da nuvem desce e encerra no PDV; fechamento com pendências cria novo turno sem perder venda

**Checkpoint**: US6 entregue — visibilidade/controle central e conflitos resolvidos sem perda.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Atualizar `CLAUDE.md` (marcador SPECKIT / plano corrente) para apontar `specs/013-venda-turno-retencao/plan.md`
- [ ] T035 [P] `specs/013-venda-turno-retencao/quickstart.md`: roteiro de validação ponta-a-ponta (abrir turno → vender → sync → cancelar → fechar pela nuvem → poda)
- [ ] T036 [P] Verificar guardrail **≤300 linhas** nos arquivos novos/alterados (`turno.rs`, `poda.rs`, `replica_sync.rs`, `estoque_repo.rs`, `maquina.rs`); refatorar se necessário
- [ ] T037 Rodar a suíte completa: `cargo test -- --test-threads=1` + domínio + `npm test`/`npm run build` (PDV) + `npm run build -w apps/escritorio` + build do wasm; clippy sem `dead_code`

---

## Dependencies & Execution Order

- **Setup (T001-T003)** → antes de tudo.
- **Foundational (T004)** → bloqueia US1/US3/US5 (guardas de domínio).
- **US1 (P1)** → base para US2 (vincula turno às vendas), US5 (numeração/header) e US6 (reconciliação depende de criação de turno).
- **US2 (P1)** → depende de m014 (T002, coluna `ja_sincronizado`). Independe de US5/US3.
- **US5 (P2)** → depende de US1 (turno com `maquina`) + m014.
- **US3 (P2)** → depende de US1 (turno encerrado) + estado de sincronização (US2 ajuda, mas a poda usa `sincronizado_em` que já existe).
- **US4 (P3)** → depende de US1 (turno com vendas).
- **US6 (P3)** → backfill (T028/T029) é independente (nuvem); a **reconciliação (T032)** depende de US1 + US2.
- **Polish (T034-T037)** → por último.

## Parallel Opportunities

- **Setup**: T003 [P] em paralelo a T001/T002.
- Após US1: **US2, US5 e US6-backfill (T028/T029) podem correr em paralelo** (times/arquivos distintos: sync Rust × front × SQL nuvem).
- Testes marcados [P] (T013, T018, T022, T025, T029, T033) rodam em paralelo dentro de suas fases.
- Polish T034/T035/T036 [P] juntos.

## Implementation Strategy

- **MVP = US1** (venda exige turno aberto + turno único + cancela só do aberto): já entrega a disciplina operacional pedida, testável isoladamente.
- **Incremento 2 = US2** (push-only + saldo local): resolve o risco técnico principal e desacopla o PDV do histórico.
- **Incremento 3 = US5 + US3**: identidade por máquina/numeração + poda (limita o banco).
- **Incremento 4 = US4 + US6**: UX de acompanhamento + visibilidade/controle na nuvem + backfill.
- Cada incremento é entregável e sincronizável isoladamente.

## Notes

- ⚠️ **Poda FK-safe**: seguir a ordem filha→pai e cobrir com teste que reproduz o cluster (lição do incidente 787/m013).
- ⚠️ **`ja_sincronizado` nunca é limpo** pelo cancelamento (diferente de `sincronizado_em`, que zera para re-subir o cancelamento).
- Reusar o **componente da lista de vendas do relatório** na tela inicial (DRY).
- Registrar **ADR-0025** antes de mexer na numeração/sync (Princípio V).
