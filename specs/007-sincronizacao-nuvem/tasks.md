# Tasks: Sincronização com a nuvem (escritório + PDV offline)

**Input**: Design documents from `specs/007-sincronizacao-nuvem/`

**Prerequisites**: plan.md, spec.md (+ Clarifications 2026-07-20), research.md (D1–D14), data-model.md, contracts/ (sync-port, nuvem-schema, escritorio-web), quickstart.md. Governança: constituição **1.1.0**, **ADR-0015/0016**.

**Tests**: testes de domínio (sem UI/DB), de adapter (Postgres/PostgREST de teste) e de integração são **obrigatórios** — quality gate da constituição (Princípio I e Fluxo de Desenvolvimento). Testes de domínio ficam `#[cfg(test)]` no próprio módulo; UI do escritório em Vitest.

**Organization**: tarefas agrupadas por user story; cada fase é um incremento testável de forma independente. Limite de 300 linhas significativas por arquivo vigia tudo (hook `scripts/check-file-size.sh`); domínio puro sem SeaORM/Tauri/sqlx (hook de pureza). **npm-only** ao mexer no workspace (memória `npm-only-lockfile`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (Escritório recebe c/ notebook off), US2 (PDV vende offline), US3 (Convergência+seed), US4 (Cadastro livro/fornecedor), US5 (Consulta/relatórios), US6 (Sync automático+status)

---

## Phase 1: Setup (workspace, deps, nuvem)

**Purpose**: preparar monorepo, dependências e configuração da nuvem — sem lógica de negócio.

- [ ] T001 Criar workspace npm com o app do escritório: `apps/escritorio` (Vite + React 19 + TS) e `packages/` (tipos compartilhados), configurando `workspaces` em package.json **sem corromper o lockfile** (npm-only; memória `npm-only-lockfile`)
- [ ] T002 [P] Adicionar deps Rust em src-tauri/Cargo.toml: `reqwest` (features rustls-tls, json), `uuid` (v4) — cliente HTTP e identidade global (research D3/D4)
- [ ] T003 [P] Configurar acesso à nuvem via variáveis de ambiente (URL do projeto, chave `anon`, token de usuário de serviço do PDV) — documentar em `apps/escritorio/.env.example` e config do adapter; **nenhum segredo no repositório** (segredos no Notion, ADR-0015)
- [ ] T004 [P] Configurar lint/build do `apps/escritorio` alinhado à raiz (tsconfig, eslint, script `build`)

---

## Phase 2: Foundational (motor de sync + schema nuvem + esqueleto web) ⚠️ BLOQUEIA as stories

**Purpose**: a espinha compartilhada por todas as stories: migração local, schema/auth na nuvem, domínio de sync, porta/adapter, orquestração, comandos e login do escritório.

### Migração local e entidades

- [ ] T005 Criar `m008` em src-tauri/src/migration/m008.rs (registrar em migration/mod.rs): ADD COLUMN `sync_uid`/`origem`/`atualizado_em`/`excluido_em`/`sincronizado_em` (padrão "add se não existe") nas tabelas sincronizáveis (livro, movimento_estoque, pedido, item_pedido, pagamento_pedido, forma_pagamento, lancamento_entrada, item_lancamento, fornecedor, destinacao, transferencia_destinacao, alocacao_venda) + **backfill idempotente** de `sync_uid` + `UNIQUE INDEX` em sync_uid + índices de **dedup** (livro.codigo, fornecedor nome-normalizado/documento) + tabela `sync_cursor` — sem ALTER destrutivo (data-model.md §1-2)
- [ ] T006 [P] Atualizar entities SeaORM com as novas colunas de sync em src-tauri/src/adapters/persistencia/entities/ (tabelas afetadas)
- [ ] T007 Teste de idempotência da `m008` em src-tauri/src/migration/m008.rs (`#[cfg(test)]`, SQLite temporário): aplicar 2× converge; backfill não gera 2º `sync_uid`; índices de dedup criados

### Schema e acesso na nuvem

- [ ] T008 Migração da nuvem (versionada/idempotente) — tabelas espelho com `sync_uid uuid PRIMARY KEY`, `sincronizado_em timestamptz DEFAULT now()`, `origem`, `atualizado_em`, `excluido_em`, `criado_por`, **FKs enforced** e **CHECKs** (qtd<>0, custos>=0, preços>=0) (contracts/nuvem-schema.md); versionar em `apps/nuvem/migrations/` (ou script documentado)
- [ ] T009 [P] Nuvem: habilitar **Supabase Auth** + **RLS por usuário** (policies com `auth.uid()`) e criar VIEWS `vw_saldo_livro`, `vw_custo_medio` (fold do ledger, espelha ADR-0009) — derivados nunca como coluna (research D5, ADR-0016)

### Domínio, porta, adapter, orquestração, comandos

- [ ] T010 [P] Criar src-tauri/src/domain/sincronizacao.rs: regras **puras** — ordenação por dependência (pais→filhas), decisão **last-write-wins** por `atualizado_em`, **match de dedup** por chave natural (livro=código; fornecedor=nome/documento), **detecção de órfã**, convergência do fold — com testes inline (ADR-0016). Sem SeaORM/Tauri/sqlx (hook de pureza)
- [ ] T011 Criar src-tauri/src/application/ports_sync.rs: trait `SyncPort` (`enviar_pendentes`, `puxar_desde(cursor)`, `aplicar_delta`), trait `RelogioServidor` (`agora_servidor`) + tipos de delta/resumo; registrar em application/mod.rs (contracts/sync-port.md)
- [ ] T012 Criar src-tauri/src/adapters/nuvem/mod.rs + supabase_sync.rs: implementa `SyncPort` via PostgREST/HTTPS (`reqwest`), **upsert por `sync_uid`** (`Prefer: resolution=merge-duplicates`), autenticação por token de usuário (nunca `service_role`), leitura do tempo do servidor; registrar em adapters/mod.rs
- [ ] T013 Criar src-tauri/src/application/sincronizacao.rs: caso de uso que orquestra **push pendentes → pull desde cursor → recomputar derivados** (`custo_medio` por fold nos livros afetados) → persistir `last_cursor` em `sync_cursor`; retomável e idempotente
- [ ] T014 Criar src-tauri/src/commands_sync.rs: comandos Tauri `sincronizar_agora`, `status_sincronizacao` (contrato sync-port.md) e registrar em src-tauri/src/lib.rs
- [ ] T015 [P] Criar src/lib/ipc_sync.ts (bindings) + tipos de status em src/lib/types.ts (PDV)

### Esqueleto do escritório e tipos compartilhados

- [ ] T016 [P] Esqueleto `apps/escritorio`: cliente supabase-js + **tela de Login (Supabase Auth)** + guarda de rota (sem sessão, sem acesso) (contracts/escritorio-web.md)
- [ ] T017 [P] Criar `packages/` com tipos de entidade compartilhados (Livro, Fornecedor, Movimento, Venda) reusados por PDV e escritório

### Teste base do motor

- [ ] T018 Teste de adapter em src-tauri/src/adapters/nuvem/supabase_sync.rs (`#[cfg(test)]` contra Postgres/PostgREST de teste): upsert **idempotente** por `sync_uid` (2× = 1); **retomada** após interrupção não duplica

**Checkpoint**: `cargo test` verde; `m008` aplicada; login do escritório funciona; sync manual sobe/baixa um registro sem duplicar.

---

## Phase 3: User Story 1 - Escritório recebe livro com o notebook desligado (P1) 🎯 MVP

**Goal**: o escritório registra entrada de livros na nuvem com o notebook off; ao sincronizar, o estoque do PDV reflete.

**Independent Test**: quickstart Cenário 1 — entrada de 5 offline no escritório → PDV sincroniza → saldo +5, `origem='escritorio'`.

- [ ] T019 [US1] Tela **Recebimento** em apps/escritorio: grava `lancamento_entrada` + `item_lancamento` + `movimento_estoque` tipo `entrada` (evento cru, `origem='escritorio'`, `sync_uid` gerado no cliente, `criado_por`), validado por CHECK do schema (contracts/escritorio-web.md)
- [ ] T020 [US1] Pull+aplicar entradas no PDV: `aplicar_delta` para `movimento_estoque` + recomputar `custo_medio`/saldo do livro afetado (usa application/sincronizacao.rs)
- [ ] T021 [P] [US1] Teste de domínio em src-tauri/src/domain/sincronizacao.rs: movimento `entrada` mesclado soma ao saldo (+N) e recomputa custo médio por fold ordenado por `criado_em`
- [ ] T022 [US1] Teste de integração (Cenário 1) em src-tauri: entrada no "lado nuvem" + pull no PDV → saldo do livro +5, um único movimento, `origem='escritorio'`

**Checkpoint**: escritório recebe com notebook off e o PDV reflete ao sincronizar.

---

## Phase 4: User Story 2 - PDV vende offline e reconcilia (P1)

**Goal**: o PDV vende sem internet e, ao reconectar, as vendas/saídas sobem para a nuvem sem perda nem duplicação.

**Independent Test**: quickstart Cenário 2 — 3 vendas offline → `status` pendentes=3 → reconecta → nuvem com as 3, uma vez cada.

- [ ] T023 [US2] Marcar pendências no PDV: toda venda/movimento de saída nasce com `sincronizado_em = NULL`; `enviar_pendentes` empurra em ordem pais→filhas e marca com o retorno (data-model.md §1, research D10)
- [ ] T024 [US2] Push de `pedido`/`item_pedido`/`pagamento_pedido` (venda com forma de pagamento — 005) via `supabase_sync` (upsert por `sync_uid`)
- [ ] T025 [P] [US2] Teste de adapter: 3 vendas pendentes → push → nuvem tem 3 (idempotente); re-push não duplica
- [ ] T026 [US2] Teste de integração (Cenário 2): vender offline, `status_sincronizacao` mostra pendentes; reconectar → nuvem consistente

**Checkpoint**: PDV opera offline e reconcilia as vendas sem perda.

---

## Phase 5: User Story 3 - Convergência sem perda/dupla + seed inicial (P1)

**Goal**: após ambos sincronizarem, o estoque bate dos dois lados; re-sync é no-op; interrupção retoma; seed carrega o histórico.

**Independent Test**: quickstart Cenários 3, 4, 6 — saldo 12/12; re-sync estável; retomada idêntica; órfã isolada.

- [ ] T027 [US3] Criar src-tauri/src/application/seed_nuvem.rs + comando `seed_inicial` (commands_sync.rs): carga inicial idempotente de todo o histórico (push de pendentes ordenado pais→filhas), reusando o caminho de sync (research D13)
- [ ] T028 [US3] Isolamento de órfãs no push/seed: registros com FK ausente (ex.: movimento com `livro_codigo` inexistente) são separados e reportados em `ResumoSeed/ResumoSync.orfas`, sem abortar o lote (FR-012, memória `sqlite-fks-nao-enforced`)
- [ ] T029 [US3] Garantir recomputação determinística do `custo_medio` por fold ordenado por `criado_em` após cada merge (não por `id` local) em application/sincronizacao.rs (ADR-0016 D5)
- [ ] T030 [P] [US3] Testes de domínio em src-tauri/src/domain/sincronizacao.rs: convergência (soma bate), idempotência (fold estável em 2ª passada), detecção de órfã
- [ ] T031 [US3] Testes de integração (Cenários 3/4/6): saldo 12 nos dois lados; sincronizar 3× sem mudar; interromper e retomar sem duplicar; seed com órfã histórica isola e reporta

**Checkpoint**: estoque converge e o sync é à prova de re-execução, interrupção e órfãs.

---

## Phase 6: User Story 4 - Cadastro de livro e fornecedor nos dois lados (P2)

**Goal**: livro e fornecedor editáveis no PDV e no escritório, com dedup por chave natural e última-edição-vence.

**Independent Test**: quickstart Cenários 5 e 8 — preço editado nos dois lados converge para o mais recente; mesmo código/nome vira um único registro.

- [ ] T032 [US4] Upsert de `livro` com **dedup por código de barras** + **LWW** por `atualizado_em` (tempo do servidor), nos dois sentidos, em application/sincronizacao.rs + adapters/nuvem (ADR-0016 D4/D7)
- [ ] T033 [US4] Upsert de `fornecedor` com **dedup por nome/documento** + **LWW**; tela **Fornecedores** em apps/escritorio (criar/editar), permitindo vincular recebimento a fornecedor novo (FR-021)
- [ ] T034 [US4] Tela **Cadastro/Preço de livro** em apps/escritorio (upsert com `atualizado_em` do servidor; soft delete via `excluido_em`)
- [ ] T035 [P] [US4] Testes de domínio: LWW (edição mais nova vence), match de dedup (mesmo código/nome mescla) em src-tauri/src/domain/sincronizacao.rs
- [ ] T036 [US4] Teste de integração (Cenários 5/8): preço editado dos dois lados → último vence; mesmo código de barras/fornecedor criado nos dois lados → um único registro

**Checkpoint**: cadastros convergem sem duplicata e sem travar nenhum lado.

---

## Phase 7: User Story 5 - Consulta e relatórios no escritório (P2)

**Goal**: o escritório consulta estoque, vendas e os relatórios de 005/006 a partir dos dados sincronizados.

**Independent Test**: após o PDV sincronizar, o escritório vê vendas e os relatórios de formas de pagamento e de repasse por destinação.

- [ ] T037 [US5] Incluir no escopo de push/pull os cadastros/eventos de 005/006: `forma_pagamento`, `destinacao`, `transferencia_destinacao`, `alocacao_venda` (research D14, data-model §4)
- [ ] T038 [US5] Tela **Consulta de estoque** em apps/escritorio (lê `vw_saldo_livro` + `vw_custo_medio`) e **Consulta de vendas** (pedido/itens/pagamento)
- [ ] T039 [US5] Telas de **relatório**: formas de pagamento (005) e **repasse por destinação** (006) lendo `alocacao_venda`+`destinacao` (contracts/escritorio-web.md)
- [ ] T040 [US5] Teste de integração: após sync do PDV, escritório enxerga vendas + relatórios 005/006 batendo com o PDV

**Checkpoint**: visibilidade remota completa no escritório.

---

## Phase 8: User Story 6 - Sincronização automática e indicador de estado (P3)

**Goal**: sync roda em background quando há internet; operador vê sincronizado/pendente/sem conexão; a venda nunca bloqueia.

**Independent Test**: gerar movimento com internet → sincroniza sozinho e o indicador vira "sincronizado"; sem internet → "pendente".

- [ ] T041 [US6] Agendador em background no PDV: chama `sincronizar_agora` periodicamente quando online, sem bloquear a venda (commands_sync.rs / lib.rs)
- [ ] T042 [US6] Indicador de estado no PDV (React): componente que consome `status_sincronizacao` (sincronizado/pendente/sem conexão) — FR-014
- [ ] T043 [P] [US6] Indicador/atualização no escritório (apps/escritorio) refletindo o estado dos dados
- [ ] T044 [US6] Teste de integração: novo movimento com internet auto-sincroniza; offline mostra "pendente" e a venda conclui normalmente

**Checkpoint**: sync transparente e observável.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Segurança (Cenário 7, SC-006/008): confirmar que nenhum bundle (Tauri/web) expõe `service_role`; RLS por usuário ativa; `criado_por` gravado; sem login não há acesso
- [ ] T046 [P] Guardrail de 300 linhas em todos os módulos novos (`scripts/check-file-size.sh`) — extrair (ex.: `supabase_sync` I/O vs. mapeamento) se necessário
- [ ] T047 [P] Docs: notas de deploy do escritório (Portainer/nginx) em docs/ e ajuste do README se preciso
- [ ] T048 [P] Verificar integridade do lockfile npm após o app do escritório (memória `npm-only-lockfile`)
- [ ] T049 Performance (SC-005): sincronização de rotina (volume de 1 dia) conclui < 1 min
- [ ] T050 Rodar `quickstart.md` ponta a ponta (Cenários 1–8) e registrar resultados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA todas as stories**. É o motor de sync + schema/auth na nuvem + login do escritório.
- **User Stories (Phase 3–8)**: dependem da Foundational. Depois disso:
  - **US1** e **US2** (P1) são independentes entre si (entrada vs. saída) e podem seguir em paralelo.
  - **US3** (P1) endurece a convergência/seed sobre o que US1/US2 sincronizam — melhor **após** US1+US2 existirem (usa ambos os fluxos), mas seus testes de domínio (T030) independem.
  - **US4** (P2) depende do upsert com dedup/LWW (T032/T033) — usa o motor; independe de US1/US2 para teste.
  - **US5** (P2) depende do push/pull de vendas (US2) e do escopo 005/006 (T037).
  - **US6** (P3) depende de `status_sincronizacao`/`sincronizar_agora` (Foundational).
- **Polish (Phase 9)**: depois das stories desejadas.

### Within Each User Story

- Testes de domínio/adapter antes ou junto da implementação (quality gate); domínio antes do adapter; adapter antes do comando; comando antes da UI.

### Parallel Opportunities

- Setup: T002, T003, T004 em paralelo.
- Foundational: T006, T009, T010, T015, T016, T017 marcados [P] (arquivos distintos). T010 (domínio) e T016 (esqueleto web) podem correr enquanto T005/T008 (migrações) avançam.
- Uma vez pronta a Foundational, **US1 e US2 em paralelo**; testes [P] dentro de cada story.

---

## Parallel Example: Foundational

```bash
# Após T005 (m008) e T008 (schema nuvem):
Task: "T010 domain/sincronizacao.rs (regras puras + testes)"
Task: "T016 esqueleto apps/escritorio + login Supabase Auth"
Task: "T017 packages/ tipos compartilhados"
Task: "T009 RLS por usuário + views na nuvem"
```

---

## Implementation Strategy

### MVP (US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational, crítica) → 3. Phase 3 (US1) → **validar Cenário 1** → demo (escritório recebe com notebook off).

### Entrega incremental

1. Setup + Foundational → motor pronto.
2. +US1 (recebimento remoto) → **MVP**.
3. +US2 (PDV offline reconcilia) → os dois fluxos P1.
4. +US3 (convergência + seed) → estoque bate e histórico carregado.
5. +US4/US5 (cadastros e relatórios) → back-office completo.
6. +US6 (sync automático + status) → transparência.

### Notas

- Testes de domínio/adapter/integração são gate (constituição). Verificar falha antes de implementar quando fizer sentido.
- Commit após cada tarefa ou grupo lógico. Parar em qualquer checkpoint para validar a story de forma independente.
- Evitar: tarefas vagas, conflito no mesmo arquivo, dependências entre stories que quebrem a independência de teste.
