# Tasks: Sincronização com a nuvem (escritório + PDV offline)

**Input**: Design documents from `specs/007-sincronizacao-nuvem/`

**Prerequisites**: plan.md, spec.md (+ Clarifications 2026-07-20), research.md (D1–D15), data-model.md, contracts/ (sync-port, nuvem-schema, escritorio-web), quickstart.md. Governança: constituição **1.1.0**, **ADR-0015/0016**.

**Tests**: testes de domínio (sem UI/DB), de adapter (Postgres/PostgREST de teste) e de integração são **obrigatórios** — quality gate da constituição (Princípio I e Fluxo de Desenvolvimento). Testes de domínio ficam `#[cfg(test)]` no próprio módulo; UI do escritório em Vitest.

**Organization**: tarefas agrupadas por user story; cada fase é um incremento testável de forma independente. Limite de 300 linhas significativas por arquivo vigia tudo (hook `scripts/check-file-size.sh`); domínio puro sem SeaORM/Tauri/sqlx (hook de pureza). **npm-only** ao mexer no workspace (memória `npm-only-lockfile`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (Escritório recebe c/ notebook off), US2 (PDV vende offline), US3 (Convergência+seed), US4 (Cadastros: livro/fornecedor/operador), US5 (Consulta/relatórios), US6 (Sync automático+status)

---

## Phase 1: Setup (workspace, deps, nuvem)

**Purpose**: preparar monorepo, dependências e configuração da nuvem — sem lógica de negócio.

- [X] T001 Criar workspace npm com o app do escritório: `apps/escritorio` (**Next.js App Router** + React + TS) e `packages/` (tipos compartilhados), configurando `workspaces` em package.json **sem corromper o lockfile** (npm-only; memória `npm-only-lockfile`)
- [X] T002 [P] Adicionar deps Rust em src-tauri/Cargo.toml: `reqwest` (features rustls-tls, json), `uuid` (v4) — cliente HTTP e identidade global (research D3/D4)
- [X] T003 [P] Configurar acesso à nuvem via variáveis de ambiente (URL do projeto, chave `anon`, token de usuário de serviço do PDV) — documentar em `apps/escritorio/.env.example` e config do adapter; **nenhum segredo no repositório** (segredos no Notion, ADR-0015)
- [X] T004 [P] Configurar lint/build do `apps/escritorio` (Next.js) alinhado à raiz (tsconfig, eslint, script `build`) + **`Dockerfile`** (build standalone do Next.js) para publicar como serviço no Portainer Swarm

---

## Phase 2: Foundational (motor de sync + schema nuvem + esqueleto web) ⚠️ BLOQUEIA as stories

**Purpose**: a espinha compartilhada por todas as stories: migração local, schema/auth na nuvem, domínio de sync, porta/adapter, orquestração, comandos e login do escritório.

### Migração local e entidades

- [X] T005 Criar `m008` em src-tauri/src/migration/m008.rs (registrar em migration/mod.rs): ADD COLUMN `sync_uid`/`origem`/`atualizado_em`/`excluido_em`/`sincronizado_em` (padrão "add se não existe") nas tabelas sincronizáveis (livro, movimento_estoque, pedido, item_pedido, pagamento_pedido, forma_pagamento, lancamento_entrada, item_lancamento, fornecedor, destinacao, transferencia_destinacao, alocacao_venda, **usuario**) + **`ADD COLUMN pedido.operador TEXT`** (atribuição, nullable) + **backfill idempotente** de `sync_uid` + `UNIQUE INDEX` em sync_uid + índices de **dedup** (livro.codigo, `fornecedor.nome_norm` — índice único já existente na 003, `documento` como desempate, usuario) + tabela `sync_cursor` — sem ALTER destrutivo. **`usuario.senha_hash` fica fora do sync** (data-model.md §1-2)
- [~] T006 [P] Atualizar entities SeaORM com as novas colunas de sync (e `pedido.operador`) em src-tauri/src/adapters/persistencia/entities/ (tabelas afetadas) — N/A: réplica usa SQL cru, entidades não participam do sync
- [X] T007 Teste de idempotência da `m008` em src-tauri/src/migration/m008.rs (`#[cfg(test)]`, SQLite temporário): aplicar 2× converge; backfill não gera 2º `sync_uid`; índices de dedup criados

### Schema e acesso na nuvem

- [X] T008 Migração da nuvem (versionada/idempotente) — tabelas espelho com `sync_uid uuid PRIMARY KEY`, `sincronizado_em timestamptz DEFAULT now()`, `origem`, `atualizado_em`, `excluido_em`, `criado_por`, **FKs enforced** e **CHECKs** (qtd<>0, custos>=0, preços>=0); `usuario` **sem `senha_hash`**; `pedido.operador` (contracts/nuvem-schema.md); versionar em `apps/nuvem/migrations/` (ou script documentado)
- [X] T009 [P] Nuvem: habilitar **Supabase Auth** + **RLS por usuário** (policies com `auth.uid()`) e criar VIEWS `vw_saldo_livro`, `vw_custo_medio` (fold do ledger, espelha ADR-0009) — derivados nunca como coluna (research D5, ADR-0016)

### Domínio, porta, adapter, orquestração, comandos

- [X] T010 [P] Criar src-tauri/src/domain/sincronizacao.rs: regras **puras** — ordenação por dependência (pais→filhas, cobrindo `livro`, `fornecedor`, `forma_pagamento`, `usuario`, `destinacao` como pais), decisão **last-write-wins** por `atualizado_em`, **match de dedup** por chave natural (livro=código; fornecedor=`nome_norm`; operador=`usuario`), **propagação de exclusão (soft delete)** sem "ressuscitar" (FR-015), **detecção de órfã**, convergência do fold — com testes inline (ADR-0016). Sem SeaORM/Tauri/sqlx (hook de pureza)
- [X] T011 Criar src-tauri/src/application/ports_sync.rs: trait `SyncPort` (`enviar_pendentes`, `puxar_desde(cursor)`, `aplicar_delta`), trait `RelogioServidor` (`agora_servidor`) + tipos de delta/resumo; registrar em application/mod.rs (contracts/sync-port.md)
- [X] T012 Criar src-tauri/src/adapters/nuvem/mod.rs + supabase_sync.rs: implementa `SyncPort` via PostgREST/HTTPS (`reqwest`), **upsert por `sync_uid`** (`Prefer: resolution=merge-duplicates`), autenticação por token de usuário (nunca `service_role`), leitura do tempo do servidor, **excluindo `usuario.senha_hash` do payload**; registrar em adapters/mod.rs
- [X] T013 Criar src-tauri/src/application/sincronizacao.rs: caso de uso que orquestra **push pendentes → pull desde cursor → recomputar derivados** (`custo_medio` por fold nos livros afetados) → persistir `last_cursor` em `sync_cursor`; retomável e idempotente
- [X] T014 Criar src-tauri/src/commands_sync.rs: comandos Tauri `sincronizar_agora`, `status_sincronizacao` (contrato sync-port.md) e registrar em src-tauri/src/lib.rs
- [X] T015 [P] Criar src/lib/ipc_sync.ts (bindings) + tipos de status em src/lib/types.ts (PDV)

### Esqueleto do escritório e tipos compartilhados

- [X] T016 [P] Esqueleto `apps/escritorio` (Next.js): helpers `utils/supabase/{server,client,middleware}.ts` (`@supabase/ssr`) + **tela de Login (Supabase Auth)** + middleware de sessão + guarda de rota (sem sessão, sem acesso) (contracts/escritorio-web.md)
- [ ] T017 [P] Criar `packages/` com tipos de entidade compartilhados (Livro, Fornecedor, Operador, Movimento, Venda) reusados por PDV e escritório

### Teste base do motor

- [X] T018 Teste de adapter em src-tauri/src/adapters/nuvem/supabase_sync.rs (`#[cfg(test)]` contra Postgres/PostgREST de teste): upsert **idempotente** por `sync_uid` (2× = 1); **retomada** após interrupção não duplica

**Checkpoint**: `cargo test` verde; `m008` aplicada; login do escritório funciona; sync manual sobe/baixa um registro sem duplicar.

---

## Phase 3: User Story 1 - Escritório recebe livro com o notebook desligado (P1) 🎯 MVP

**Goal**: o escritório registra entrada de livros na nuvem com o notebook off; ao sincronizar, o estoque do PDV reflete.

**Independent Test**: quickstart Cenário 1 — entrada de 5 offline no escritório → PDV sincroniza → saldo +5, `origem='escritorio'`.

- [X] T019 [US1] Tela **Recebimento** em apps/escritorio: grava `lancamento_entrada` + `item_lancamento` + `movimento_estoque` tipo `entrada` (evento cru, `origem='escritorio'`, `sync_uid` gerado no cliente, `criado_por`), validado por CHECK do schema (contracts/escritorio-web.md)
- [X] T020 [US1] Pull+aplicar entradas no PDV: `aplicar_delta` para `movimento_estoque` + recomputar `custo_medio`/saldo do livro afetado (usa application/sincronizacao.rs)
- [X] T021 [P] [US1] Teste de domínio em src-tauri/src/domain/sincronizacao.rs: movimento `entrada` mesclado soma ao saldo (+N) e recomputa custo médio por fold ordenado por `criado_em`
- [X] T022 [US1] Teste de integração (Cenário 1) em src-tauri: entrada no "lado nuvem" + pull no PDV → saldo do livro +5, um único movimento, `origem='escritorio'`

**Checkpoint**: escritório recebe com notebook off e o PDV reflete ao sincronizar.

---

## Phase 4: User Story 2 - PDV vende offline e reconcilia (P1)

**Goal**: o PDV vende sem internet e, ao reconectar, as vendas/saídas (com operador) sobem para a nuvem sem perda nem duplicação.

**Independent Test**: quickstart Cenário 2 — 3 vendas offline → `status` pendentes=3 → reconecta → nuvem com as 3, uma vez cada, com operador.

- [X] T023 [US2] Marcar pendências no PDV: toda venda/movimento de saída nasce com `sincronizado_em = NULL`; `enviar_pendentes` empurra em ordem pais→filhas e marca com o retorno (data-model.md §1, research D10)
- [X] T024 [US2] Push de `pedido`/`item_pedido`/`pagamento_pedido` (venda com forma de pagamento — 005) via `supabase_sync` (upsert por `sync_uid`). **`forma_pagamento` (pai da FK `pagamento_pedido.forma_id`) deve estar no escopo desde a Foundational**; o push ordena pais→filhas (T010/T023)
- [ ] T025 [US2] Registrar o **operador logado** na venda (`pedido.operador`) no fluxo de venda do PDV (application/venda.rs + captura do operador da sessão) e incluí-lo no push (FR-023). **`usuario` (pai de `pedido.operador`) deve estar no escopo desde a Foundational** (push ordenado pais→filhas); o refino de dedup/LWW do operador é T036
- [X] T026 [P] [US2] Teste de adapter: 3 vendas pendentes → push → nuvem tem 3 (idempotente); re-push não duplica
- [X] T027 [US2] Teste de integração (Cenário 2): vender offline, `status_sincronizacao` mostra pendentes; reconectar → nuvem consistente, com operador atribuído

**Checkpoint**: PDV opera offline, reconcilia as vendas e cada venda leva o operador que a fez.

---

## Phase 5: User Story 3 - Convergência sem perda/dupla + seed inicial (P1)

**Goal**: após ambos sincronizarem, o estoque bate dos dois lados; re-sync é no-op; interrupção retoma; seed carrega o histórico.

**Independent Test**: quickstart Cenários 3, 4, 6 — saldo 12/12; re-sync estável; retomada idêntica; órfã isolada.

- [X] T028 [US3] Criar src-tauri/src/application/seed_nuvem.rs + comando `seed_inicial` (commands_sync.rs): carga inicial idempotente de todo o histórico (push de pendentes ordenado pais→filhas), reusando o caminho de sync (research D13)
- [X] T029 [US3] Isolamento de órfãs no push/seed: registros com FK ausente (ex.: movimento com `livro_codigo` inexistente) são separados e reportados em `ResumoSeed/ResumoSync.orfas`, sem abortar o lote (FR-012, memória `sqlite-fks-nao-enforced`)
- [X] T030 [US3] Garantir recomputação determinística do `custo_medio` por fold ordenado por `criado_em` após cada merge (não por `id` local) em application/sincronizacao.rs (ADR-0016 D5)
- [X] T031 [P] [US3] Testes de domínio em src-tauri/src/domain/sincronizacao.rs: convergência (soma bate), idempotência (fold estável em 2ª passada), detecção de órfã
- [X] T032 [US3] Testes de integração (Cenários 3/4/6): saldo 12 nos dois lados; sincronizar 3× sem mudar; interromper e retomar sem duplicar; seed com órfã histórica isola e reporta

**Checkpoint**: estoque converge e o sync é à prova de re-execução, interrupção e órfãs.

---

## Phase 6: User Story 4 - Cadastros bidirecionais: livro, fornecedor, operador (P2)

**Goal**: livro, fornecedor e operador editáveis no PDV e no escritório, com dedup por chave natural e última-edição-vence; senha do operador nunca sai do PDV.

**Independent Test**: quickstart Cenários 5, 8, 9 — preço converge para o mais recente; mesmo código/nome/usuário vira um único registro; operador criado remoto fica pendente de senha.

- [X] T033 [US4] Upsert de `livro` com **dedup por código de barras** + **LWW** por `atualizado_em` (tempo do servidor), nos dois sentidos, em application/sincronizacao.rs + adapters/nuvem (ADR-0016 D4/D7)
- [X] T034 [US4] Upsert de `fornecedor` com **dedup por `nome_norm`** (índice único da 003; documento desempate) + **LWW**; tela **Fornecedores** em apps/escritorio (criar/editar), permitindo vincular recebimento a fornecedor novo (FR-021)
- [X] T035 [US4] Tela **Cadastro/Preço de livro** em apps/escritorio (upsert com `atualizado_em` do servidor; soft delete via `excluido_em`)
- [X] T036 [US4] Sincronizar **operador** (`usuario`): upsert com **dedup por `usuario`** + **LWW**, com o adapter **excluindo `senha_hash` do payload** em application/sincronizacao.rs + adapters/nuvem (D15, FR-022)
- [X] T037 [US4] Tela **Operadores** em apps/escritorio (criar/editar identidade: usuário + nome + ativo, **sem senha**) + no PDV: tratar `senha_hash` vazio como "definir senha no 1º login" e bloquear login até definir (src/ do PDV + application)
- [X] T038 [P] [US4] Testes de domínio: LWW (edição mais nova vence), match de dedup (mesmo código/nome/usuário mescla) em src-tauri/src/domain/sincronizacao.rs
- [ ] T039 [US4] Teste de integração (Cenários 5/8/10): preço editado dos dois lados → último vence; mesmo código de barras/fornecedor criado nos dois lados → um único registro; **exclusão (soft delete) de um livro/fornecedor num lado propaga e NÃO ressuscita após sincronizar** (FR-015, Cenário 10)
- [ ] T040 [US4] Teste de integração (Cenário 9): operador criado no escritório aparece no PDV como "pendente"; após definir senha local, loga; `senha_hash` nunca presente na nuvem (SC-010)

**Checkpoint**: cadastros (livro, fornecedor, operador) convergem sem duplicata; senha do PDV nunca sai local.

---

## Phase 7: User Story 5 - Consulta e relatórios no escritório (P2)

**Goal**: o escritório consulta estoque, vendas (com "vendido por") e os relatórios de 005/006 a partir dos dados sincronizados.

**Independent Test**: após o PDV sincronizar, o escritório vê vendas com operador e os relatórios de formas de pagamento e de repasse por destinação.

- [X] T041 [US5] Confirmar/estender o escopo de push/pull dos **eventos/cadastros de 006** para os relatórios: `destinacao`, `transferencia_destinacao`, `alocacao_venda` (`forma_pagamento` de 005 já sincroniza desde a Foundational por ser pai de `pagamento_pedido`) (research D14, data-model §4)
- [X] T042 [US5] Tela **Consulta de estoque** em apps/escritorio (lê `vw_saldo_livro` + `vw_custo_medio`) e **Consulta de vendas** (pedido/itens/pagamento)
- [X] T043 [US5] Telas de **relatório**: formas de pagamento (005) e **repasse por destinação** (006) lendo `alocacao_venda`+`destinacao` (contracts/escritorio-web.md)
- [X] T044 [US5] Exibir o **operador ("vendido por")** na consulta/relatório de vendas do escritório, resolvendo `pedido.operador` → nome (vendas antigas: "operador desconhecido") (FR-023, SC-011)
- [X] T045 [US5] Teste de integração: após sync do PDV, escritório enxerga vendas (com operador) + relatórios 005/006 batendo com o PDV

**Checkpoint**: visibilidade remota completa no escritório, com atribuição de operador.

---

## Phase 8: User Story 6 - Sincronização automática e indicador de estado (P3)

**Goal**: sync roda em background quando há internet; operador vê sincronizado/pendente/sem conexão; a venda nunca bloqueia.

**Independent Test**: gerar movimento com internet → sincroniza sozinho e o indicador vira "sincronizado"; sem internet → "pendente".

- [X] T046 [US6] Agendador em background no PDV: chama `sincronizar_agora` periodicamente quando online, sem bloquear a venda (commands_sync.rs / lib.rs)
- [X] T047 [US6] Indicador de estado no PDV (React): componente que consome `status_sincronizacao` (sincronizado/pendente/sem conexão) — FR-014
- [ ] T048 [P] [US6] Indicador/atualização no escritório (apps/escritorio) refletindo o estado dos dados
- [ ] T049 [US6] Teste de integração: novo movimento com internet auto-sincroniza; offline mostra "pendente" e a venda conclui normalmente

**Checkpoint**: sync transparente e observável.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T050 [P] Segurança (Cenário 7, SC-006/008/010): confirmar que nenhum bundle (Tauri/web) expõe `service_role`; RLS por usuário ativa; `criado_por` gravado; sem login não há acesso; **`usuario.senha_hash` não presente na nuvem nem no bundle web**
- [X] T051 [P] Guardrail de 300 linhas em todos os módulos novos (`scripts/check-file-size.sh`) — extrair (ex.: `supabase_sync` I/O vs. mapeamento) se necessário
- [X] T052 [P] Docs + deploy: `Dockerfile` do Next.js (output standalone) e **stack de Docker Swarm** (compose/service) para o Portainer; notas de deploy em docs/ e ajuste do README se preciso
- [X] T053 [P] Verificar integridade do lockfile npm após o app do escritório (memória `npm-only-lockfile`)
- [ ] T054 Performance (SC-005): sincronização de rotina (volume de 1 dia) conclui < 1 min
- [ ] T055 Rodar `quickstart.md` ponta a ponta (Cenários 1–10) e registrar resultados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA todas as stories**. É o motor de sync + schema/auth na nuvem + login do escritório.
- **User Stories (Phase 3–8)**: dependem da Foundational. Depois disso:
  - **US1** e **US2** (P1) são independentes entre si (entrada vs. saída) e podem seguir em paralelo.
  - **US3** (P1) endurece a convergência/seed sobre o que US1/US2 sincronizam — melhor **após** US1+US2, mas seus testes de domínio (T031) independem.
  - **US4** (P2) usa o motor de upsert/dedup/LWW — independe de US1/US2 para teste.
  - **US5** (P2) depende do push/pull de vendas (US2), do operador na venda (T025) e do escopo 005/006 (T041).
  - **US6** (P3) depende de `status_sincronizacao`/`sincronizar_agora` (Foundational).
- **Polish (Phase 9)**: depois das stories desejadas.

### Escopo de sync e ordem de FK (importante)

- **Todas as tabelas sincronizáveis** recebem `sync_uid`/colunas de sync na Foundational (T005) e são tratadas pelo adapter genérico (T012) — inclusive os **pais** `livro`, `fornecedor`, `forma_pagamento`, `usuario`, `destinacao`. As tarefas por story (T033/T034/T036/T041) adicionam **UI, dedup e LWW**, não o sync básico.
- O push/seed **ordena pais→filhas** (T010/T023/T028), o que satisfaz as FKs enforced na nuvem (ex.: `pagamento_pedido.forma_id → forma_pagamento`, `pedido.operador → usuario`, `movimento.livro_codigo → livro`). Por isso um filho de US2 nunca sobe antes de seu pai, mesmo que a UI do pai esteja numa story posterior.

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
3. +US2 (PDV offline reconcilia, com operador) → os dois fluxos P1.
4. +US3 (convergência + seed) → estoque bate e histórico carregado.
5. +US4/US5 (cadastros livro/fornecedor/operador e relatórios) → back-office completo.
6. +US6 (sync automático + status) → transparência.

### Notas

- Testes de domínio/adapter/integração são gate (constituição). Verificar falha antes de implementar quando fizer sentido.
- Commit após cada tarefa ou grupo lógico. Parar em qualquer checkpoint para validar a story de forma independente.
- Evitar: tarefas vagas, conflito no mesmo arquivo, dependências entre stories que quebrem a independência de teste.
