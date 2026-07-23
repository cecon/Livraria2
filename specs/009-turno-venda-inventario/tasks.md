---
description: "Task list — Feature 009: Turno, Venda e Inventário na nuvem"
---

# Tasks: Operações de balcão na nuvem — Turno, Venda e Inventário

**Input**: Design documents from `/specs/009-turno-venda-inventario/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS — a spec pede explicitamente cobertura automatizada (US4/FR-011) e conformidade
nativo↔WASM (SC-005).

**Organization**: agrupado por user story (US1 Turno P1, US2 Venda P2, US3 Inventário P3, US4 Pendências P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1/US2/US3/US4 (fases de história); Setup/Foundational/Polish não levam label

## Path Conventions

Monorepo/workspace (herdado da 008): domínio em `crates/`, WASM em `crates/livraria-domain-wasm/`,
pacote gerado em `packages/domain/`, UI compartilhada em `packages/ui/`, PDV em `src/` + `src-tauri/`,
Escritório em `apps/escritorio/`, migração da nuvem em `apps/nuvem/migrations/`.

---

## Phase 1: Setup (saneamento e baseline)

**Purpose**: sanear dívidas de ADR (Princípio V) e confirmar baseline verde antes de tocar código.

- [X] T001 Renumerar ADR do WASM: `git mv docs/adr/0019-escritorio-reusa-dominio-wasm.md docs/adr/0022-escritorio-reusa-dominio-wasm.md`, atualizar título/refs internas e o índice/README de ADRs; ajustar a nota de colisão deixada na 008 (resolve a colisão com o `0019` de identidade usuário/senha do #15)
- [X] T002 [P] Corrigir `docs/adr/0021-turno-de-operacao.md`: trocar todas as menções `0004_turno.sql` → `0006_turno.sql` (0004/0005 já usadas pelo #15)
- [X] T003 [P] Confirmar baseline verde na raiz do workspace: `npm ci`, `cargo check -p livraria-domain`, e `cargo check` do `src-tauri`; registrar que parte do baseline (sem mudanças)

**Checkpoint**: ADRs consistentes; workspace compila. Pode iniciar a fundação.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: domínio, fronteira WASM, esquema nas duas pontas e navegação — pré-requisitos compartilhados.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase (todas dependem do domínio/WASM/esquema).

- [X] T004 Criar a entidade pura `crates/livraria-domain/src/turno_operacao.rs` com `TurnoOperacao`, `StatusTurno{Aberto,Encerrado}`, `ResumoCaixa`, `Fechamento` e as funções puras `abrir`, `pode_registrar_venda`, `proximo_numero`, `resumir_fechamento(pagamentos, caixa_inicial, dinheiro_forma_id)` (esperado **só do dinheiro** — clarify Q1), `encerrar(esperado, conferido)`; incluir testes `#[cfg(test)]` no arquivo (roda sem UI/banco). Registrar `pub mod turno_operacao;` em `crates/livraria-domain/src/lib.rs` (≤300 linhas — decompor se necessário)
- [X] T005 Adicionar wrappers WASM do **turno** em `crates/livraria-domain-wasm/src/lib.rs`: `turno_pode_registrar_venda`, `turno_proximo_numero`, `turno_resumir_fechamento`, `turno_encerrar` (fronteira `f64`/`JsValue`, ver `contracts/wasm-api.md`)
- [X] T006 No mesmo `crates/livraria-domain-wasm/src/lib.rs`, adicionar wrappers WASM da **venda**: `validar_conclusao_venda`, `troco_venda`, `restante_venda` (embrulham `Pedido::{validar_conclusao,troco,restante}`) e do **inventário**: `contagem_efetiva`, `resumir` (embrulham `inventario::{contagem_efetiva,resumir}`) — depende de T005 (mesmo arquivo)
- [ ] T007 Estender `packages/domain/` (wrapper TS) para reexportar as novas funções e commitar a regeneração do WASM pelo CI `.github/workflows/wasm.yml` (build no Linux por causa do Windows SAC); confirmar `@livraria/domain` com os novos símbolos em `index.d.ts`
- [X] T008 Criar migração SQLite `src-tauri/src/migration/m009.rs` (idempotente, estilo `aplicar` de m008): `CREATE TABLE IF NOT EXISTS turno_operacao(...)` + `ALTER TABLE pedido ADD COLUMN turno_uid/numero_no_turno` tolerando "duplicate column"; wire `m009::aplicar(db)` em `src-tauri/src/adapters/persistencia/mod.rs` `inicializar_schema()` após `m008`
- [X] T009 [P] Criar migração da nuvem `apps/nuvem/migrations/0006_turno.sql` (idempotente): mirror `turno_operacao` (`sync_uid` + colunas de sync), `CREATE INDEX IF NOT EXISTS idx_turno_operacao_sinc`, `ALTER TABLE pedido ADD COLUMN IF NOT EXISTS turno_uid/numero_no_turno`, e RLS `to authenticated` (padrão de `0002_rls_e_views.sql`)
- [X] T010 Inserir `turno_operacao` na `ORDEM_DEPENDENCIA` da sincronização **antes de `pedido`** e mapear a entidade nos dois lados do sync (adapters de sincronização do `src-tauri` que consomem `crates/livraria-domain/src/sincronizacao.rs`); campos mutáveis convergem por LWW
- [X] T011 [P] Adicionar o item **Turno** (rota `/turnos`, ícone) ao `packages/ui/src/nav.tsx` (compartilhado) e registrar a rota `/turnos` no PDV em `src/App.tsx` (Venda/Inventário já existem no nav)

**Checkpoint**: domínio+WASM+esquema+nav prontos. As user stories podem iniciar (em paralelo, se houver equipe).

---

## Phase 3: User Story 1 — Turno de operação (Priority: P1) 🎯 MVP

**Goal**: abrir turno (caixa inicial opcional), conter a numeração, encerrar com **fechamento de caixa**
(conferência só do dinheiro) — no PDV e no Escritório.

**Independent Test**: abrir um turno, encerrar sem vendas e conferir o fechamento (esperado = caixa inicial;
conferido/diferença); tentar abrir um segundo turno na mesma origem → bloqueado.

### Tests for User Story 1 ⚠️

- [ ] T012 [P] [US1] Conformidade nativo↔WASM do turno em `crates/livraria-domain/tests/conformance.rs`: `proximo_numero`, `resumir_fechamento`, `encerrar` (mesmo input → mesmo output)
- [ ] T013 [P] [US1] Teste de integração do ciclo do turno no Escritório em `apps/escritorio/lib/nuvem/__tests__/turno.test.ts`: abrir → contar → encerrar; e **bloqueio de segundo turno aberto** na mesma origem (D7)

### Implementation for User Story 1

- [ ] T014 [US1] Implementar a porta de turno na nuvem `apps/escritorio/lib/nuvem/turno.ts`: `abrirTurno(caixaInicial?)` (falha se já há turno `aberto` do operador nesta origem), `turnoAberto()`, `contarPedidosDoTurno(turnoUid)`, `encerrarTurno(turnoUid, conferidoDinheiro)` (usa `turno_resumir_fechamento`+`turno_encerrar` via `@livraria/domain`), `listarTurnos()`. **Operador = `app_user`** (o `usuario.sync_uid` real do operador logado, lido do cookie do #15) — **não** `auth.uid()`, que é compartilhado sob a sessão de serviço (senão "um turno por operador" e o vínculo operador↔turno colapsam)
- [ ] T015 [P] [US1] Componente `apps/escritorio/components/FechamentoCaixa.tsx`: totais por forma (informativos) + conferência do **dinheiro** (esperado vs. campo "conferido") + diferença (≤300 linhas)
- [ ] T016 [US1] Tela `apps/escritorio/app/turnos/page.tsx`: estados sem-turno (Abrir + caixa inicial via `parse_brl`), turno-aberto (resumo ao vivo + Encerrar), histórico; usa `FechamentoCaixa` (depende de T014, T015)
- [ ] T017 [US1] PDV — caso de uso e comandos do turno: `src-tauri/src/application/turno.rs` (abrir/encerrar sobre o domínio) + `#[tauri::command]` `turno_abrir`/`turno_encerrar`/`turno_aberto` em `src-tauri/src/commands.rs`, com repo `src-tauri/src/adapters/persistencia/turno_repo.rs` (grava em `turno_operacao`, idempotente); expor no `src/lib/ipc.ts`
- [ ] T018 [P] [US1] PDV — UI mínima de turno em `src/routes/Turnos.tsx` (abrir/encerrar + fechamento), reusando `@livraria/ui`; ligado à rota `/turnos` (T011)

**Checkpoint**: turno abre/encerra e numera nas duas pontas; fechamento confere só o dinheiro.

---

## Phase 4: User Story 2 — Venda completa (checkout) (Priority: P2)

**Goal**: dentro de um turno aberto, concluir a venda pelo Escritório com baixa/custo/troco **idênticos ao
PDV**; e passar o PDV a exigir/estampar o turno na venda.

**Independent Test**: concluir a mesma venda no Escritório e no PDV → estoque, custo, valores e troco batem;
venda sem turno é bloqueada.

### Tests for User Story 2 ⚠️

- [ ] T019 [P] [US2] Conformidade nativo↔WASM da venda em `crates/livraria-domain/tests/conformance.rs`: `validar_conclusao_venda`, `troco_venda`, `restante_venda`, `clamp_baixa_venda`
- [ ] T020 [P] [US2] Teste de integração de paridade da venda em `apps/escritorio/lib/nuvem/__tests__/venda.test.ts`: mesma entrada → mesma baixa/custo/troco; bloqueio sem turno; `numero_no_turno` sequencial

### Implementation for User Story 2

- [ ] T021 [US2] Porta de venda na nuvem `apps/escritorio/lib/nuvem/venda.ts`: pré-checa `turno_pode_registrar_venda`; `validar_conclusao_venda` (WASM); `numero_no_turno = turno_proximo_numero(contarPedidosDoTurno)`; baixa `clamp_baixa_venda` (saldo derivado via `recompor_ledger`/`vw_saldo_livro`); grava `pedido`→`item_pedido`→`pagamento_pedido`→`movimento_estoque`(saída)→`alocacao_venda` (com `operador_uid`/`criado_por` = **`app_user`**, não `auth.uid()`); `listarVendasDoDia()`
- [ ] T022 [P] [US2] Componente `apps/escritorio/components/Carrinho.tsx` (itens/qtd/total) reusando `EntradaProduto` existente (≤300 linhas)
- [ ] T023 [P] [US2] Componente `apps/escritorio/components/FormasPagamento.tsx` (recebimento por forma + troco via `troco_venda`) (≤300 linhas)
- [ ] T024 [P] [US2] Componente `apps/escritorio/components/VendaConcluida.tsx` (confirmação animada, classe `venda-concluida-card`) (≤300 linhas)
- [ ] T025 [US2] Tela `apps/escritorio/app/venda/page.tsx`: checkout + aba "Lista de vendas"; **gate visual**: sem turno aberto, bloqueia e mostra CTA "Abrir turno" (FR-002); **sinalização de baixa parcial** (FR-008): quando `clamp_baixa_venda(qtd,saldo) < qtd`, exibir aviso "estoque insuficiente — baixa parcial" (sem bloquear, sem negativo); usa Carrinho/FormasPagamento/VendaConcluida (depende de T021–T024)
- [ ] T026 [US2] PDV — passar `registrar_venda` a **exigir turno aberto** e estampar `turno_uid`/`numero_no_turno`: ajustar `src-tauri/src/application/venda.rs` + `src-tauri/src/commands.rs` (`proximo_numero_pedido`/`registrar_venda`) + `pedido_repo.rs`/`pedido_sql.rs` para persistir as novas colunas; refletir no `src/components/Pdv.tsx` (bloqueio sem turno)

**Checkpoint**: venda idêntica PDV↔Escritório, sempre contida num turno.

---

## Phase 5: User Story 3 — Inventário na nuvem (Priority: P3)

**Goal**: contagem física (digitação/câmera) em sessão **parcial/total** com reconciliação, gravando os
**ajustes** — sem tabelas novas na nuvem.

**Independent Test**: contar no Escritório (parcial) e fechar → ajustes gravados conferem com a contagem
equivalente do PDV; no modo total, não-contados contam 0.

### Tests for User Story 3 ⚠️

- [ ] T027 [P] [US3] Conformidade nativo↔WASM do inventário em `crates/livraria-domain/tests/conformance.rs`: `contagem_efetiva` (parcial/total), `diferenca_contagem` e `resumir` (ResumoInventario) — cobre as funções de inventário da SC-005
- [ ] T028 [P] [US3] Teste de integração da contagem em `apps/escritorio/lib/nuvem/__tests__/inventario.test.ts`: parcial só ajusta contados; total zera não-contados; ajustes = os do PDV

### Implementation for User Story 3

- [ ] T029 [US3] Porta de inventário `apps/escritorio/lib/nuvem/inventario.ts`: sessão **client-side** (rascunho em `localStorage`, modo parcial/total); `saldosParaContagem(codigos?)`; fechamento aplica `contagem_efetiva`+`diferenca_contagem` (WASM); `aplicarAjustes(ajustes)` grava `movimento_estoque` tipo `ajuste`
- [ ] T030 [P] [US3] Componente `apps/escritorio/components/ContagemInventario.tsx`: seletor de modo + bipar (reusa `EntradaProduto`) + card +1/desfazer −1 (≤300 linhas)
- [ ] T031 [P] [US3] Componente `apps/escritorio/components/RevisaoContagem.tsx`: tabela de divergências (reconciliação) antes de aplicar (≤300 linhas)
- [ ] T032 [US3] Tela `apps/escritorio/app/inventario/page.tsx`: ciclo abrir/contar/revisar/fechar/cancelar usando ContagemInventario/RevisaoContagem (depende de T029–T031)

**Checkpoint**: inventário na nuvem produz os mesmos ajustes do PDV.

---

## Phase 6: User Story 4 — Pendências da retaguarda (Priority: P3)

**Goal**: exportar relatórios (Excel/PDF/WhatsApp) e fechar a cobertura de testes de ida-e-volta, acesso e
concorrência.

**Independent Test**: exportar um relatório em Excel/PDF e compartilhar por WhatsApp com os mesmos números do
PDV; suíte de integração prova ida-e-volta, acesso e convergência.

### Tests for User Story 4 ⚠️

- [ ] T033 [P] [US4] Teste de **ida-e-volta** PDV↔nuvem em `apps/escritorio/lib/nuvem/__tests__/idaevolta.test.ts`: venda/ajuste gravado numa ponta aparece e confere na outra após sync (inclui `numero_no_turno`)
- [ ] T034 [P] [US4] Teste de **acesso** em `apps/escritorio/lib/nuvem/__tests__/acesso.test.ts`: operações exigem sessão autenticada (RLS `to authenticated`); anônimo é negado
- [ ] T035 [P] [US4] Teste de **convergência concorrente** em `apps/escritorio/lib/nuvem/__tests__/concorrencia.test.ts`: duas edições convergem por LWW sem perda

### Implementation for User Story 4

- [ ] T036 [US4] Estender `apps/escritorio/lib/nuvem/relatorios.ts` com export: **Excel** (`.xlsx` das linhas carregadas), **PDF** (impressão via `@media print`), **WhatsApp** (`https://wa.me/?text=`) — sem endpoint novo, sem `service_role`
- [ ] T037 [US4] Adicionar os botões Exportar Excel/PDF e Compartilhar WhatsApp em `apps/escritorio/app/relatorios/page.tsx` (mesmos números do PDV) (depende de T036)

**Checkpoint**: retaguarda com export e cobertura de testes fechada.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Rodar a validação do `specs/009-turno-venda-inventario/quickstart.md` (5 cenários) e registrar resultados
- [ ] T039 [P] Verificar o gate de **≤300 linhas** em todos os arquivos de lógica novos (`.ts/.tsx/.rs/.css`); decompor o que passar
- [ ] T040 [P] Conferir idempotência de `m009` e `0006_turno.sql` (re-aplicar não duplica/quebra) e o pt-BR/moeda em centavos nas telas novas
- [ ] T041 Atualizar `docs/` (README/índice de ADR já saneado; nota da 009) e o `CLAUDE.md` se necessário

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências.
- **Foundational (Fase 2)**: depende do Setup — **bloqueia todas as user stories** (domínio/WASM/esquema/nav).
- **US1 (Fase 3)**: depende da Fase 2.
- **US2 (Fase 4)**: depende da Fase 2; **integra com o turno** (usa `turnoAberto`/`proximo_numero` da US1) — recomendado após US1, mas testável de forma independente com um turno aberto.
- **US3 (Fase 5)**: depende da Fase 2; **independente** de turno/venda.
- **US4 (Fase 6)**: export é independente; os testes de ida-e-volta/concorrência exercitam US1/US2/US3 (rodar após elas).
- **Polish (Fase 7)**: depois das histórias desejadas.

### Within Each User Story

- Testes escritos antes e devem **falhar** antes da implementação.
- Domínio/porta antes da UI; componentes antes da página que os usa.

### Parallel Opportunities

- Fase 1: T002, T003 em paralelo.
- Fase 2: T009 e T011 em paralelo com a trilha do WASM; **T005→T006** são sequenciais (mesmo arquivo).
- Fase 2 concluída → US1, US3 podem começar em paralelo; US2 logo após o turno (US1) existir.
- Dentro de cada história, os componentes marcados [P] (arquivos distintos) rodam em paralelo; os testes [P] também.

---

## Parallel Example: User Story 1

```bash
# Testes da US1 juntos:
Task: "Conformidade do turno em crates/livraria-domain/tests/conformance.rs"        # T012
Task: "Integração do ciclo do turno em apps/escritorio/lib/nuvem/__tests__/turno.test.ts"  # T013

# Componente + UI do PDV em paralelo (arquivos distintos):
Task: "FechamentoCaixa.tsx"   # T015
Task: "PDV Turnos.tsx"        # T018
```

---

## Implementation Strategy

### MVP First (US1 — Turno)

1. Fase 1 (Setup) → 2. Fase 2 (Foundational) → 3. Fase 3 (US1) → **validar o turno isolado** → demo.

### Incremental Delivery

1. Setup + Foundational → fundação pronta.
2. US1 (Turno) → testar → **MVP** (numeração + fechamento).
3. US2 (Venda) → testar → paridade de checkout.
4. US3 (Inventário) → testar → contagem na nuvem.
5. US4 (Pendências) → export + cobertura de testes.

### Parallel Team Strategy

Após a Fase 2: Dev A → US1; Dev B → US3 (independente); Dev C entra em US2 assim que o turno (US1) existir;
US4 (export) pode andar em paralelo, com os testes de ida-e-volta ao final.

---

## Notes

- [P] = arquivos distintos, sem dependência pendente. [Story] mapeia a história para rastreabilidade.
- **DRY**: nenhuma regra reescrita — turno/venda/inventário vêm do domínio via `@livraria/domain` (WASM).
- **Offline do PDV invariante**: numeração por turno é calculável por origem; a nuvem é aditiva/online.
- Commit após cada tarefa ou grupo lógico; parar em cada checkpoint para validar a história isolada.
- Segredos (ex.: `ESCRITORIO_EMAIL/SENHA` de produção) só no Notion — nunca no repo.
