# Implementation Plan: Cadastro de Fornecedores & Lançamento de Notas de Entrada

**Branch**: `main` (feature dir: `003-fornecedores-lancamento-notas`) | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-fornecedores-lancamento-notas/spec.md`

## Summary

Formalizar **fornecedores** (cadastro/edição) e transformar a entrada de mercadoria numa **lista de notas
(lançamentos)** multi-item. Cada nota: escolhe-se o fornecedor (da lista), lançam-se vários livros (qtd +
custo total↔unitário) e, ao **finalizar (dar entrada)**, o estoque sobe e o custo médio é recalculado —
**reusando a razão de movimentos da feature 002** (um movimento `entrada` por item, `referencia` = id da
nota, `fornecedor` = nome). Notas podem ser salvas como **rascunho** (não afetam estoque) e retomadas; ao
finalizar viram **imutáveis** e idempotentes. A tela "Entrada de 1 livro" da 002 é **removida**. Mantém a
arquitetura Hexagonal (domínio Rust puro, portas/adapters, comandos Tauri, UI React).

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sqlx-sqlite, tokio); sea-orm-migration; serde; React + Vite +
shadcn/ui — **sem novas dependências** (reusa a stack das 001/002)

**Storage**: SQLite local; novas tabelas `fornecedor`, `lancamento_entrada`, `item_lancamento`. Reusa
`movimento_estoque` e `livro` da 002.

**Testing**: `cargo test` (domínio/aplicação puros via fakes; adapters com SQLite temporário); Vitest mínimo

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: lançar nota com 5 itens e dar entrada < 2 min (SC-002); selecionar fornecedor < 10 s
(SC-003); leituras de lista percebidas como instantâneas

**Constraints**: offline; ≤ 300 linhas significativas por arquivo; migration idempotente por comando; seed de
fornecedores idempotente; **dinheiro em centavos**; preserva a invariante `Σ movimentos == estoque` (002);
termos pt-BR

**Scale/Scope**: dezenas de fornecedores; notas com poucos itens cada; +3 telas (Fornecedores, Lista de
lançamentos, Editor de nota); mono-usuário

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | Domínio puro novo (`fornecedor.rs`, `lancamento.rs`: validação, total, regra de finalização); portas `FornecedorRepo`/`LancamentoRepo`; adapters SeaORM; finalização reusa o ledger da 002 por meio do domínio de custo médio | ✅ PASS |
| II. KISS & DRY / YAGNI | Reusa razão de movimentos, custo médio e `derivar_custos` da 002; **helper único `inserir_entrada_item`** compartilhado por `estoque_repo` e `lancamento_repo` (sem duplicar a mecânica de entrada — D3a); fornecedor leve (sem NF-e); total = soma dos itens | ✅ PASS |
| III. ≤300 linhas/arquivo | Domínio, casos de uso, repos e comandos em arquivos pequenos e separados (`commands_fornecedor.rs`, `commands_lancamento.rs`); editor de nota dividido em componentes | ✅ PASS (verificável por hook) |
| IV. Migrations por comando & idempotência | Nova migration `m_fornecedores` (CREATE TABLE IF NOT EXISTS); seed de fornecedores a partir de `movimento_estoque.fornecedor` por passo idempotente em runtime | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | Novo ADR-0011 (fornecedor + lançamento por nota reusando o ledger). Hook de 300 linhas vigente | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Termos `fornecedor`, `lançamento`, `nota`, `rascunho`, `dar entrada`; custo em centavos, R$ pt-BR | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking não aplicável.

## Project Structure

### Documentation (this feature)

```text
specs/003-fornecedores-lancamento-notas/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (vira ADR-0011)
├── data-model.md        # Phase 1 — entidades, esquema SQLite, regras
├── quickstart.md        # Phase 1 — validação ponta a ponta
├── contracts/
│   └── tauri-commands.md # Phase 1 — comandos invoke (fornecedor + lançamento)
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas sobre a 002

```text
src-tauri/src/
├── domain/
│   ├── fornecedor.rs       # NOVO — Fornecedor, normalização de nome, validação
│   └── lancamento.rs       # NOVO — Lancamento, ItemLancamento, StatusLancamento, total, regra de finalização
├── application/
│   ├── ports_compras.rs    # NOVO — FornecedorRepo, LancamentoRepo (+ DTOs de visão)
│   ├── fornecedores.rs     # NOVO — CRUD de fornecedor + seed (adoção)
│   ├── lancamentos.rs      # NOVO — criar/salvar rascunho/itens/finalizar/listar
│   └── mod.rs              # ALTERADO — registra módulos novos
├── adapters/persistencia/
│   ├── entities/
│   │   ├── fornecedor.rs           # NOVO
│   │   ├── lancamento_entrada.rs   # NOVO
│   │   └── item_lancamento.rs      # NOVO
│   ├── estoque_sql.rs      # NOVO — helper compartilhado `inserir_entrada_item(txn,...)` (D3a, DRY)
│   ├── estoque_repo.rs     # ALTERADO — `registrar_entrada` passa a delegar ao helper (mantido + teste 002)
│   ├── fornecedor_repo.rs  # NOVO — impl FornecedorRepo (+ seed idempotente)
│   ├── lancamento_repo.rs  # NOVO — impl LancamentoRepo (finalizar atômico usando o helper + idempotente)
│   └── lancamento_sql.rs   # NOVO (se necessário p/ 300 linhas) — helpers SQL de lançamento
├── migration/mod.rs        # ALTERADO — registra m_fornecedores (3 tabelas)
├── commands_fornecedor.rs  # NOVO — comandos de fornecedor
├── commands_lancamento.rs  # NOVO — comandos de lançamento
├── commands_estoque.rs     # ALTERADO — remove comando `registrar_entrada` (single) e `fornecedores_sugestoes`
├── application/entrada.rs  # REMOVIDO — caso de uso da entrada de 1 livro (substituído por notas)
└── lib.rs                  # ALTERADO — seed fornecedores no boot; registra novos handlers; remove antigos

src/ (UI React)
├── routes/
│   ├── Fornecedores.tsx    # NOVO — lista + form (padrão do Cadastro)
│   ├── Lancamentos.tsx     # NOVO — lista de notas + "Novo lançamento" (substitui Entrada.tsx)
│   └── Entrada.tsx         # REMOVIDO
├── components/
│   ├── FornecedorForm.tsx  # NOVO
│   ├── LancamentoEditor.tsx# NOVO — escolher fornecedor + EntradaProduto p/ itens + dar entrada
│   └── FornecedorSelect.tsx# NOVO — seleção com busca
├── lib/                    # ALTERADO — ipc.ts (novos invoke), types.ts (Fornecedor, Lancamento, ItemNota)
└── components/AppSidebar.tsx # ALTERADO — "Entrada" → "Lançamentos"; adiciona "Fornecedores"

docs/adr/0011-fornecedores-lancamento-notas.md  # NOVO
```

**Structure Decision**: Desktop Hexagonal (mesma das 001/002). O domínio puro ganha `fornecedor.rs` e
`lancamento.rs` (regras testáveis sem UI/banco). A finalização da nota é **atômica** num adapter
(`lancamento_repo`), inserindo um movimento `entrada` por item e recalculando o custo médio via funções de
domínio da 002 — preservando a invariante de estoque. Comandos e UI seguem o padrão existente; arquivos
pequenos cumprem o Princípio III.

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável.
