---
description: "Task list — Escritório espelho do PDV (paridade nuvem ↔ local)"
---

# Tasks: Escritório espelho do PDV (paridade nuvem ↔ local)

**Input**: Design documents from `/specs/008-escritorio-espelho-pdv/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos — a constituição exige regras de domínio cobertas por testes sem UI/banco (gate de qualidade) e o objetivo de DRY exige **testes de conformidade PDV↔WASM** (mesmo input → mesmo output).

**Organization**: agrupado por user story. Ordem de execução por prioridade + dependência: **US1 (P1) → US2 (P2) → US4 (P2, pré-requisito de venda) → US3 (P3)**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3/US4 (mapeia para as user stories do spec.md)

---

## Phase 1: Setup (infraestrutura compartilhada)

**Purpose**: registrar decisões e transformar o repo em workspace.

- [X] T001 [P] Escrever ADR-0019 (Escritório reusa o domínio via WASM) em `docs/adr/0019-escritorio-reusa-dominio-wasm.md`
- [X] T002 [P] Escrever ADR-0020 (UI compartilhada via `packages/ui` + workspace) em `docs/adr/0020-ui-compartilhada-workspace.md`
- [X] T003 [P] Escrever ADR-0021 (Turno de operação: entidade de domínio, Pedido Nº por turno, ciclo abrir/encerrar, convergência) em `docs/adr/0021-turno-de-operacao.md`
- [X] T004 Converter o repo em **npm workspaces**: raiz com `workspaces: ["packages/*","apps/*"]` + `transpilePackages` no `next.config.mjs`. PDV, Escritório, `@livraria/ui` e `@livraria/domain` linkados; `vite build` e `next build` verdes. ✅ **Docker reworkado (T062)**: o `Dockerfile` agora builda da **raiz do workspace** (`docker build -f apps/escritorio/Dockerfile .`), `outputFileTracingRoot` na raiz, `.dockerignore` (exclui `src-tauri/target`). Imagem rebuildada e container no ar (47612).
- [ ] T005 Criar **Cargo workspace**: `Cargo.toml` raiz `[workspace]` com membros `crates/*` e `src-tauri` — **DIFERIDO**: adotado **path dependency** (`livraria-domain = { path = "../crates/livraria-domain" }`) em vez de workspace, para **não mover o `target/`/bundle do Tauri** (`src-tauri/target/...` esperado pela `tauri.conf.json`/`release.yml`). Workspace formal só se/quando trouxer ganho claro (ex.: `livraria-domain-wasm`), aí validado à parte.
- [X] T006 [P] Estender `scripts/check-file-size.sh` (guardrail 300 linhas) para cobrir `packages/` e `crates/`

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Purpose**: domínio compartilhado (crate + WASM), UI compartilhada e regras elevadas ao domínio. **⚠️ Nenhuma user story começa antes disto.**

### Domínio → crate → WASM

- [X] T007 Extrair o domínio puro para `crates/livraria-domain/` (mover `src-tauri/src/domain/*` → `crates/livraria-domain/src/`; `Cargo.toml` só com `serde`+`thiserror`)
- [X] T008 Apontar o PDV ao crate: dependência em `src-tauri/Cargo.toml` + ajustar `use crate::domain` → `livraria_domain`; `cargo test` verde (sem mudança de comportamento)
- [X] T009 [P] [refino ADR-0018] Adicionar função pura `clamp_baixa_venda(qtd, saldo)` em `crates/livraria-domain/src/estoque.rs`; `src-tauri/src/adapters/persistencia/pedido_repo.rs` passa a chamá-la (comportamento idêntico) + teste unitário
- [X] T010 [P] [refino ADR-0017] Adicionar função pura `baseline_saldo_inicial(estoque, soma_mov)` em `crates/livraria-domain/src/estoque.rs`; `application/estoque_setup.rs`/adapter passa a chamá-la + teste unitário
- [X] T011 Criar `crates/livraria-domain-wasm/` (`wasm-bindgen`+`serde-wasm-bindgen`) expondo as funções de `contracts/domain-wasm-api.md`
- [X] T012 Pipeline `wasm-pack build` → pacote TS `packages/domain/` (`@livraria/domain`) com tipos + init assíncrono — **feito via CI** (`.github/workflows/wasm.yml`), pois a máquina de dev tem Smart App Control (enforce, os error 4551) que bloqueia `wasm-pack` local. O runner Linux gera `@livraria/domain` (index.js + index_bg.wasm + index.d.ts, fronteira `number`) e commita na branch. Regenerado a cada mudança nos crates de domínio.
- [X] T013 [P] Scaffolding do harness de conformidade: vetores de teste em `specs/008-escritorio-espelho-pdv/contracts/` compartilhados entre `cargo test` (nativo) e teste JS (WASM)

### UI compartilhada

- [X] T014 Extrair `packages/ui/`: tokens `@theme`/`:root`/`.dark` (de `src/index.css`), `components/ui/*`, `lib/utils` (`cn`); `package.json` `@livraria/ui`
- [X] T015 Migrar o PDV (`src/`) para consumir `@livraria/ui` (remover cópias locais de `components/ui` e tokens; `@source` do Tailwind aponta para o pacote); PDV ainda builda
- [X] T016 Escritório: adicionar Tailwind v4 (`@tailwindcss/postcss` + `postcss.config`), importar tokens de `@livraria/ui` em `apps/escritorio/app/globals.css`, instalar `clsx`/`tailwind-merge`/`cva`/`lucide-react`/`next-themes`; corrigir alias `@/*`
- [X] T017 Escritório: marcar componentes interativos de `@livraria/ui` como `"use client"` onde necessário; `next build` verde

**Checkpoint**: domínio compartilhado (nativo+WASM), UI compartilhada e regras elevadas prontos — user stories podem começar.

---

## Phase 3: User Story 1 — Reconhecer o sistema à primeira vista (Priority: P1) 🎯 MVP

**Goal**: Escritório visualmente idêntico ao PDV (tema, barra lateral, componentes, estados).

**Independent Test**: telas equivalentes lado a lado (quickstart Cenário 1); 100% da navegação coincide (SC-001), zero telas divergentes (SC-004).

- [X] T018 [US1] Barra lateral com os 10 itens (rótulo/ícone/ordem/rota) de `contracts/ui-parity.md` em `packages/ui/` (compartilhada) e consumida pelo Escritório
- [X] T019 [US1] Layout do Escritório com sidebar + provider de tema (`next-themes`, classe `.dark`, chave `eldl-theme`) em `apps/escritorio/app/layout.tsx`
- [X] T020 [P] [US1] Toggle de tema (Sun/Moon) + marca "EL"/"Espaço do Livro" em paridade, em `apps/escritorio/app/layout.tsx`
- [X] T021 [US1] Realinhar cascas das telas existentes ao shadcn/rotas: `livros→/cadastro`, `consulta→/pesquisa`, `recebimento→/lancamentos`, `fornecedores`, `relatorios`, `operadores` em `apps/escritorio/app/*`
- [X] T022 [US1] Padronizar estados **carregando/vazio/erro** com componentes de `@livraria/ui` nas telas do Escritório
- [X] T023 [P] [US1] Checklist de paridade visual/navegação (comparação lado a lado) documentado e executado (quickstart Cenário 1)

**Checkpoint**: US1 funcional e testável — o Escritório "parece o PDV".

---

## Phase 4: User Story 2 — Retaguarda com as mesmas funções (Priority: P2)

**Goal**: telas de retaguarda operando direto na nuvem, com os mesmos resultados do PDV.

**Independent Test**: cada tarefa de retaguarda no Escritório confere com o PDV; ida-e-volta pela sync (quickstart Cenário 2; SC-003/SC-006).

- [X] T024 [US2] Camada de dados do Escritório (supabase-js tipado: `livro`, `fornecedor`, `forma_pagamento`, `destinacao`, `movimento_estoque`, `lancamento_*`, `vw_saldo_livro`) em `apps/escritorio/lib/nuvem/*.ts` (por `contracts/supabase-operations.md`)
- [X] T025 [P] [US2] Cadastro/preço (upsert `livro` por `sync_uid`, LWW, dedup por `codigo`) em `apps/escritorio/app/cadastro/page.tsx`
- [X] T026 [P] [US2] Pesquisa (livro + saldo de `vw_saldo_livro`; **custo médio via `@livraria/domain` (fold WASM)**) em `apps/escritorio/app/pesquisa/page.tsx`
- [ ] T027 [P] [US2] Lançamentos (`lancamento_entrada`+`item_lancamento`+`movimento_estoque(entrada)`) em `apps/escritorio/app/lancamentos/page.tsx`
- [X] T028 [P] [US2] Fornecedores (CRUD por `sync_uid`, dedup `nome_norm`) em `apps/escritorio/app/fornecedores/page.tsx`
- [X] T029 [P] [US2] Formas de Pagamento (CRUD, dedup `chave`) em `apps/escritorio/app/formas-pagamento/page.tsx`
- [ ] T030 [P] [US2] Destinações (via `alocar_venda`/`validar_transferencia` do WASM) em `apps/escritorio/app/destinacoes/page.tsx`
- [ ] T031 [P] [US2] Relatórios (mesmos números do PDV para o período) em `apps/escritorio/app/relatorios/page.tsx`
- [ ] T032 [US2] Início/dashboard em paridade em `apps/escritorio/app/page.tsx`
- [ ] T033 [US2] Estado de conexão (FR-010): bloquear gravação sem conexão + aviso, hook em `apps/escritorio/lib/conexao.ts`
- [ ] T034 [P] [US2] Integração ida-e-volta (grava no Escritório → aparece no PDV após sync) — quickstart Cenário 2
- [ ] T035 [P] [US2] Conformidade **custo médio** WASM vs PDV nativo em vetores compartilhados
- [ ] T064 [US2] **[FR-013 acesso]** Validar regras de acesso do Escritório: login por conta autenticada + RLS `to authenticated`; ação não permitida retorna mensagem clara e não expõe dados/operações além do permitido — em `apps/escritorio/middleware.ts` + teste
- [ ] T065 [P] [US2] **[FR-014 convergência]** Teste de concorrência: editar o mesmo `livro`/`fornecedor` no PDV e no Escritório → vence o `atualizado_em` de **servidor** (LWW), sem perda silenciosa (quickstart Cenário 6)

**Checkpoint**: US1 + US2 funcionais — retaguarda completa na nuvem, com paridade de resultado.

---

## Phase 5: User Story 4 — Turno de operação (Priority: P2, pré-requisito da Venda)

**Goal**: abrir → vender dentro do turno (Pedido Nº 1..n) → encerrar com fechamento de caixa, em PDV e Escritório.

**Independent Test**: quickstart Cenário 3; zero colisão de Pedido Nº entre origens (SC-007); resumo de fechamento confere (SC-008).

- [ ] T036 [US4] Domínio: entidade `TurnoOperacao` + funções puras (`abrir`, `pode_registrar_venda`, `proximo_numero`, `resumir_fechamento`, `encerrar`) em `crates/livraria-domain/src/turno_operacao.rs` + testes unitários
- [ ] T037 [US4] Expor funções de turno em `crates/livraria-domain-wasm` e reconstruir `@livraria/domain`
- [ ] T038 [US4] Migration **`m009`** (SQLite, idempotente): `turno_operacao` + `pedido.turno_uid`/`pedido.numero_no_turno` em `src-tauri/src/migration/m009.rs` (+ registrar em `migration/mod.rs`)
- [ ] T039 [US4] Migration **`0004_turno.sql`** (nuvem): mirror `turno_operacao` (`sync_uid` + colunas de sync) + FK/colunas em `pedido` + RLS `to authenticated` em `apps/nuvem/migrations/0004_turno.sql`; aplicar via Management API
- [ ] T040 [US4] Sync: incluir `turno_operacao` em `ORDEM_DEPENDENCIA` (antes de `pedido`) e no mapa de réplica em `src-tauri/src/domain/sincronizacao.rs` + `adapters/persistencia/replica_*`
- [ ] T041 [US4] PDV: `TurnoRepo` (SQLite) + casos de uso (abrir/encerrar/`proximo_numero`); venda passa a exigir turno aberto em `src-tauri/src/application/` + `adapters/persistencia/`
- [ ] T042 [US4] Escritório: `TurnoRepo` (Supabase) em `apps/escritorio/lib/nuvem/turno.ts`
- [ ] T043 [US4] UI compartilhada: indicador de turno + modal "Abrir turno" (caixa inicial opcional) em `packages/ui/`
- [ ] T044 [US4] UI compartilhada: tela **Encerrar turno / fechamento de caixa** (totais por forma, esperado vs. conferido, diferença) em `packages/ui/`
- [ ] T045 [US4] PDV: integrar fluxo de turno (abrir/encerrar; venda exige turno) em `src/`
- [ ] T046 [US4] Escritório: integrar fluxo de turno (abrir/encerrar; bloquear venda sem turno) em `apps/escritorio/app/`
- [ ] T047 [P] [US4] Testes unitários do domínio (numeração por turno; resumo de fechamento) em `crates/livraria-domain/src/turno_operacao.rs`
- [ ] T048 [P] [US4] Conformidade `proximo_numero`/`resumir_fechamento`/`encerrar` PDV↔WASM
- [ ] T049 [US4] Integração: numeração sem colisão entre turnos PDV/Escritório + fechamento (quickstart Cenário 3; SC-007/SC-008)
- [ ] T066 [US4] **[edge: turno esquecido]** Definir e implementar a política de **turno aberto de longa duração** (ex.: virada de dia): alerta e/ou encerramento assistido com resumo — **nunca** encerrar em silêncio sem fechamento. Domínio (regra) em `crates/livraria-domain/src/turno_operacao.rs` + UI de alerta em `packages/ui/`

**Checkpoint**: turno completo nas duas pontas — pré-requisito da Venda pronto.

---

## Phase 6: User Story 3 — Venda e Inventário completos na nuvem (Priority: P3)

**Goal**: checkout completo e contagem de inventário no Escritório, dentro de um turno, com as mesmas regras do PDV.

**Independent Test**: quickstart Cenários 4 e 5; resultados (estoque/custo/valores/itens) conferem com o PDV.

- [ ] T050 [US3] Venda: `apps/escritorio/app/venda/page.tsx` — carrinho, formas de pagamento, **exige turno aberto**, `numero_no_turno`, `saida_venda` com `clamp_baixa_venda` (WASM), `validar_conclusao`, troco
- [ ] T051 [US3] `PedidoRepo` (Supabase): grava `pedido`/`item_pedido`/`pagamento_pedido` + `movimento_estoque(saida_venda)`, garante baseline, em `apps/escritorio/lib/nuvem/pedido.ts`
- [ ] T052 [US3] Inventário: `apps/escritorio/app/inventario/page.tsx` — contagem (digitação/câmera), `diferenca_contagem`/`resumir` (WASM), `movimento_estoque(ajuste)`
- [ ] T053 [US3] `InventarioRepo` (Supabase) em `apps/escritorio/lib/nuvem/inventario.ts`
- [ ] T054 [P] [US3] Componente de leitura por câmera (`getUserMedia`/decodificação de código) em `packages/ui/`
- [ ] T055 [P] [US3] Integração venda completa (quickstart Cenário 4)
- [ ] T056 [P] [US3] Integração inventário (quickstart Cenário 5)
- [ ] T057 [P] [US3] Conformidade `clamp_baixa_venda`/`validar_conclusao` PDV↔WASM

**Checkpoint**: todas as user stories independentes e funcionais.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T058 [P] Suíte de conformidade completa verde (todas as funções de `contracts/domain-wasm-api.md`, PDV↔WASM)
- [ ] T059 [P] Rodar quickstart.md (Cenários 1–7) fim-a-fim
- [ ] T060 [P] Verificar guardrail ≤300 linhas nos arquivos novos (`packages/`, `crates/`, `apps/escritorio/`) e refatorar se necessário
- [ ] T061 [P] Docs: atualizar `apps/escritorio/README.md` e `docs/deploy-007.md` para o build do WASM + UI compartilhada
- [X] T062 Rebuild + redeploy da imagem Docker do Escritório (com WASM + `@livraria/ui`) no Docker local (porta 47612)
- [ ] T063 [P] Paridade pt-BR: moeda `R$ 1.234,56`, busca sem acento/caixa (Princípio VI) nas telas do Escritório

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as user stories**. Dentro dela: T007→T008 (crate antes de apontar o PDV); T011→T012 (WASM antes do wrapper); T014→T015/T016/T017 (pacote UI antes de consumir).
- **US1 (Phase 3)**: depende da Foundational.
- **US2 (Phase 4)**: depende da Foundational (usa `@livraria/domain` para custo). Pode ir em paralelo com US1 se houver equipe.
- **US4 (Phase 5)**: depende da Foundational; **precede US3**.
- **US3 (Phase 6)**: depende de US4 (venda exige turno).
- **Polish (Phase 7)**: depois das stories desejadas.

### Within Each User Story

- Testes de domínio/conformidade antes de considerar a story "pronta".
- Domínio/entidade → adapter (repo) → UI.
- Migrations (T038/T039) antes dos repos de turno (T041/T042).

### Parallel Opportunities

- Setup: T001/T002/T003/T006 em paralelo.
- Foundational: T009/T010/T013 em paralelo; a trilha do domínio (T007→T008, T011→T012) e a da UI (T014→…) podem correr em paralelo.
- US2: T025–T031 (telas em arquivos distintos) em paralelo após T024.
- Conformidade/integração marcadas [P] em paralelo dentro de cada story.

---

## Parallel Example: User Story 2

```bash
# Após T024 (camada de dados), as telas de retaguarda em paralelo:
Task: "Cadastro em apps/escritorio/app/cadastro/page.tsx"
Task: "Pesquisa em apps/escritorio/app/pesquisa/page.tsx"
Task: "Lançamentos em apps/escritorio/app/lancamentos/page.tsx"
Task: "Fornecedores em apps/escritorio/app/fornecedores/page.tsx"
Task: "Formas de Pagamento em apps/escritorio/app/formas-pagamento/page.tsx"
Task: "Destinações em apps/escritorio/app/destinacoes/page.tsx"
Task: "Relatórios em apps/escritorio/app/relatorios/page.tsx"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1) → **VALIDAR** paridade visual → demo. Já entrega "não gera estranhamento".

### Incremental Delivery

1. Setup + Foundational → base pronta (domínio WASM + UI compartilhada).
2. US1 → paridade visual (MVP).
3. US2 → retaguarda na nuvem.
4. US4 → turno de operação (habilita venda).
5. US3 → venda + inventário completos.
6. Polish → conformidade, quickstart, deploy.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Regras de negócio **nunca** reimplementadas em TS — sempre via `@livraria/domain` (WASM). Conformidade PDV↔WASM prova a paridade (DRY).
- Migrations `m009`/`0004_turno.sql` **idempotentes** (Princípio IV).
- Offline do PDV **invariante**: turno/venda funcionam sem internet no PDV; o Escritório é online.
- ADRs 0019/0020/0021 são pré-requisito (Phase 1) — não implementar antes de registrá-los.
- Commit após cada task ou grupo lógico; parar em cada checkpoint para validar a story.
