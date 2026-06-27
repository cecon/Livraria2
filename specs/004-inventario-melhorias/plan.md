# Implementation Plan: Melhorias de inventário + identidade do livro (`id`)

**Branch**: `main` (feature dir: `004-inventario-melhorias`) | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-inventario-melhorias/spec.md`

## Summary

Quatro frentes, sequenciadas com a fundacional primeiro:

0. **Identidade do livro** (US1, pré-requisito) — `livro` ganha **`id INTEGER PRIMARY KEY AUTOINCREMENT`**; `codigo` (barcode EAN/ISBN) vira **UNIQUE NOT NULL** e segue como fonte de verdade da bipagem/upsert; **`codigo_barras` é removida**; FKs reais (`movimento_estoque`, `item_contagem`, `item_lancamento`) re-apontadas para `livro(id)`. Migração `m004` por **rebuild** em transação única, com **verificação de contagem + `foreign_key_check`** (sem perda de dados). `item_pedido` permanece snapshot por `codigo`. ADR-0012.
1. **Pendências "Já resolvido" / "Cadastrar livro" / reabrir** (US2/US4/US5) — dois botões distintos; "Já resolvido" reusa o `resolver_pendencia` existente; "Cadastrar livro" leva ao cadastro semeando `codigo` e resolve ao salvar; novo `reabrir_pendencia`.
2. **Visualizar inventários realizados** (US3) — lista de sessões fechadas/canceladas + detalhe só-leitura com **agregados** calculados por **função de domínio pura** (`resumir`). Sem schema novo: reusa `item_contagem.qtd_sistema` (snapshot) e `sessao_inventario.fechada_em`.
3. **Remover importação da UI** (US6) — comenta o card da Início; backend (`migrar_legado`) intacto.

Mantém Hexagonal (domínio Rust puro, portas/adapters, comandos Tauri, UI React). **Sem novas dependências.**

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sea-orm-migration, sqlx-sqlite, tokio); serde; React + Vite + shadcn/ui — **sem novas deps**

**Storage**: SQLite local. **Sem tabelas novas.** Migração `m004` **reconstrói** `livro` (+`id`, −`codigo_barras`) e re-aponta FKs de `movimento_estoque`, `item_contagem`, `item_lancamento` para `livro(id)`. Reusa `item_contagem.qtd_sistema` e `sessao_inventario.fechada_em` (já existem).

**Testing**: `cargo test` — domínio puro (`resumir`) via casos sem DB; migração `m004` testada com SQLite temporário populado (contagem antes/depois + `foreign_key_check`); Vitest mínimo na UI

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: "Já resolvido" < 5 s/1 clique (SC-003); ver inventário realizado < 5 s (SC-005); migração de base típica (milhares de livros) em segundos no boot

**Constraints**: offline; ≤ 300 linhas significativas/arquivo; migration idempotente por comando (aplicada 1×, registrada em `seaql_migrations`); **zero perda de dados** (transação + verificação); preserva invariante `Σ movimentos == estoque` (002); upsert do legado por `codigo` (Princípio IV); termos pt-BR

**Scale/Scope**: milhares de livros; dezenas de sessões de inventário; refatoração toca a camada de persistência inteira (livro_codigo → livro_id) + UI de inventário (lista/detalhe) + pendências; mono-usuário

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | Agregados de inventário viram **função pura** `domain::inventario::resumir` (testável sem DB); novas portas/métodos no `InventarioRepo`; migração isolada no adapter `migration`. UI não toca regra. | ✅ PASS |
| II. KISS & DRY / YAGNI | **Sem schema novo** para inventário (reusa snapshot `qtd_sistema` e `fechada_em`); "Já resolvido" **reusa** `resolver_pendencia`; agregados calculados de uma lista única; remove a coluna morta `codigo_barras` e o ramo `codigo OR codigo_barras` (simplifica). | ✅ PASS |
| III. ≤300 linhas/arquivo | `inventario_repo.rs` já perto do limite → novas queries vão para `inventario_sql.rs`/`inventario_relatorio_sql.rs`; `Inventario.tsx` (205) → extrair `InventariosRealizados.tsx`, `InventarioDetalhe.tsx`, `ResumoCard.tsx`; migração `m004` em módulo próprio com helpers. | ✅ PASS (verificável por hook) |
| IV. Migrations por comando & idempotência | `m004` registrada em `seaql_migrations` (roda 1×), **transação única**, rebuild com verificação de contagem + `foreign_key_check` → converge em base nova/povoada sem erro nem perda. Upsert do legado segue por `codigo`. | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | **ADR-0012** (identidade do livro: `id` PK, `codigo` único, remoção de `codigo_barras`, FK→id, estratégia de migração) + nota sobre visualização só-leitura e ciclo de pendências. Hook de 300 linhas vigente. | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Termos `inventário`, `pendência`, `já resolvido`, `cadastrar livro`, `código`; sem mudança de vocabulário do usuário; `codigo` segue sendo o código/barcode visível. | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking não aplicável. **Risco principal**: amplitude do rebuild de FKs — mitigado por transação + verificação de contagem + `foreign_key_check` + testes de migração com base populada.

## Project Structure

### Documentation (this feature)

```text
specs/004-inventario-melhorias/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (base do ADR-0012)
├── data-model.md        # Phase 1 — esquema novo do livro + passos da migração m004
├── quickstart.md        # Phase 1 — validação ponta a ponta (migração + features)
├── contracts/
│   └── tauri-commands.md # Phase 1 — comandos invoke novos/alterados
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas sobre a 002/003

```text
src-tauri/src/
├── migration/mod.rs                 # ALTERADO — registra m004 (rebuild livro + FK→id, drop codigo_barras)
│   └── (m004 em submódulo com helpers de rebuild + verificação de contagem/foreign_key_check)
├── domain/inventario.rs             # ALTERADO — + ResumoInventario { total, bateram, faltaram, sobraram, soma } + fn pura resumir(itens)
├── application/
│   ├── ports_inventario.rs          # ALTERADO — SessaoView ganha fechada_em; + ResumoView; + métodos sessoes_realizadas, itens_fechada, reabrir_pendencia
│   └── inventario.rs                # ALTERADO — casos de uso: realizados(), relatorio(sessao_id) compõe sessão+itens+resumo+pendências
├── adapters/persistencia/
│   ├── entities/livro.rs            # ALTERADO — + id (PK), codigo vira único, remove codigo_barras
│   ├── inventario_sql.rs            # ALTERADO — achar_por_bipagem casa só `codigo`; queries livro_codigo→livro_id
│   ├── inventario_relatorio_sql.rs  # NOVO (se necessário p/ 300) — queries de sessões realizadas + itens snapshot
│   ├── inventario_repo.rs           # ALTERADO — + sessoes_realizadas, itens_fechada, reabrir_pendencia (thin)
│   ├── livro_repo.rs                # ALTERADO — por_codigo (busca só `codigo`); upsert por `codigo`; mapeia id
│   ├── estoque_repo.rs / *_sql.rs   # ALTERADO — movimento_estoque.livro_codigo → livro_id
│   └── lancamento_repo.rs           # ALTERADO — item_lancamento.livro_codigo → livro_id
├── commands_inventario.rs           # ALTERADO — + inventario_realizados, inventario_relatorio, reabrir_pendencia; bipar casa só codigo
├── commands.rs / commands_*.rs      # ALTERADO — LivroDto perde codigoBarras; ajustes livro_codigo→livro_id onde aparecer
└── lib.rs                           # ALTERADO — registra handlers novos

src/ (UI React)
├── routes/
│   ├── Inventario.tsx               # ALTERADO — sem sessão aberta: render <InventariosRealizados/>; mantém abertura/sessão
│   ├── Inicio.tsx                   # ALTERADO — comenta o card de Migração do legado + estado/handlers/imports
│   └── Cadastro.tsx                 # ALTERADO — aceita seed de `codigo` (via state/param) p/ "Cadastrar livro"
├── components/
│   ├── Pendencias.tsx               # ALTERADO — dois botões ("Cadastrar livro" / "Já resolvido") + ver/reabrir resolvidas
│   ├── InventariosRealizados.tsx    # NOVO — lista de sessões fechadas/canceladas
│   ├── InventarioDetalhe.tsx        # NOVO — detalhe só-leitura de uma sessão
│   ├── ResumoCard.tsx               # NOVO — agregados (total/bateram/faltaram/sobraram/soma)
│   └── LivroForm.tsx                # ALTERADO — remove campo "Código de barras"; `codigo` é o único; aceita seed inicial
├── lib/
│   ├── ipc.ts                       # ALTERADO — bindings novos (realizados/relatorio/reabrir); remove codigoBarras
│   └── types.ts                     # ALTERADO — Livro perde codigoBarras; + SessaoRealizada, ResumoInventario, RelatorioSessao
└── (App.tsx)                        # eventual rota/param para cadastro semeado

docs/adr/0012-identidade-livro-id.md  # NOVO — decisão de PK/identidade + estratégia de migração
```

**Structure Decision**: Desktop Hexagonal (mesma das 001/002/003). A frente fundacional (identidade) é a de maior amplitude — concentra-se na **migração `m004`** (rebuild atômico com verificação) e na troca mecânica `livro_codigo → livro_id` nos adapters; o domínio puro não depende da forma da chave. As features de inventário reusam dados já persistidos (snapshot) e adicionam uma **função de domínio pura** para os agregados. Arquivos grandes são divididos para cumprir o Princípio III.

**Sequenciamento recomendado** (mesmo dentro da 004, idealmente em commits separados): (a) `m004` + troca de FKs + remoção de `codigo_barras` + testes de migração **verdes** antes de tudo; (b) pendências; (c) visualização; (d) remoção do importar.

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável. O risco de amplitude do rebuild é mitigado por transação única, verificação de contagem de linhas e `PRAGMA foreign_key_check`, com testes de migração sobre base populada.
