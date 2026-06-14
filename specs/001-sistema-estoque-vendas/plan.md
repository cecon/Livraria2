# Implementation Plan: Sistema de Estoque & Vendas — Livraria 2 (Espaço do Livro)

**Branch**: `main` (feature dir: `001-sistema-estoque-vendas`) | **Date**: 2026-06-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-sistema-estoque-vendas/spec.md`

## Summary

Modernizar o sistema gerencial de estoque & vendas da livraria Espaço do Livro como **app desktop
offline** (Tauri 2). O **núcleo de domínio é puro Rust** (regras de venda, estoque, pedido, relatórios),
isolado de UI e banco por **portas & adapters** (Hexagonal/SOLID). A persistência é **SQLite** acessada
por um adapter com **ORM SeaORM**; **migrations programáticas idempotentes** rodam por comando. A UI é
**React + TypeScript + shadcn/ui**, atuando como adapter de entrada via comandos Tauri (`invoke`). Há um
**importador idempotente (upsert)** do legado Access (`../Livraria/livraria.mdb`) lido via `mdbtools`,
re-executável durante a transição. Guardrails (hook de limite de 300 linhas, skills) e ADRs protegem as
filosofias da constituição. Valores monetários são **inteiros em centavos** para reconciliação exata.

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sqlx-sqlite, runtime tokio); sea-orm-migration; serde;
React + Vite 7 + shadcn/ui + Tailwind v4; `mdbtools` (binário de sistema, leitura do `.mdb` legado)

**Storage**: SQLite local (arquivo em `app_data_dir` do Tauri); legado Access `.mdb` somente leitura na
transição

**Testing**: `cargo test` (domínio/aplicação puros, sem UI nem banco; adapters com SQLite temporário);
Vitest para utilidades de UI (mínimo na v1)

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: venda típica (3 itens + pagamento) concluída em < 60 s (SC-001); busca/leitura de
código percebida como instantânea (< 100 ms p95) em acervo de ~500–5.000 livros

**Constraints**: offline; sem backend HTTP; ≤ 300 linhas significativas por arquivo de lógica; migrations
e import idempotentes; moeda em centavos (inteiro); termos de domínio pt-BR preservados

**Scale/Scope**: ~503 livros, ~5.109 vendas históricas a migrar; 8 telas; 5 formas de pagamento; mono-usuário

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | Domínio Rust puro; portas (traits) para repositório, relógio, importador, impressão; adapters na borda; UI e SeaORM fora do domínio | ✅ PASS |
| II. KISS & DRY / YAGNI | Sem backend HTTP; um único núcleo de regras; sem embeddings/microsserviços (anti-padrão do legado); ORM só na borda | ✅ PASS |
| III. ≤300 linhas/arquivo | Layout por módulos pequenos; entidades SeaORM uma por tabela; hook de verificação | ✅ PASS (verificável) |
| IV. Migrations por comando & idempotência | sea-orm-migration programática via comando; import upsert por chave estável | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | Hook de 300 linhas (Claude + pre-commit); ADRs em `docs/adr/`; skills em `.claude/skills/` | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Enum de categorias 0–6, formas de pagamento exatas, nº de pedido, turno, R$ pt-BR, busca sem acento | ✅ PASS |

**Resultado**: nenhuma violação. Nenhuma entrada em Complexity Tracking necessária.

## Project Structure

### Documentation (this feature)

```text
specs/001-sistema-estoque-vendas/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (vira ADRs em docs/adr/)
├── data-model.md        # Phase 1 — entidades, esquema SQLite, mapeamento legado
├── quickstart.md        # Phase 1 — guia de validação ponta a ponta
├── contracts/           # Phase 1 — contratos dos comandos Tauri (invoke API)
│   └── tauri-commands.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src-tauri/                      # Núcleo Rust (Hexagonal)
├── src/
│   ├── domain/                 # Regras puras — SEM UI, SEM banco, SEM serde de transporte
│   │   ├── livro.rs            # Livro, Categoria (enum 0–6), regras de estoque/selo
│   │   ├── pedido.rs           # Pedido, ItemPedido, snapshot, turno
│   │   ├── pagamento.rs        # FormaPagamento, cálculo pago/restante/troco
│   │   ├── dinheiro.rs         # Valor monetário em centavos (i64) + formatação pt-BR
│   │   └── erros.rs            # Erros de domínio
│   ├── application/            # Casos de uso + PORTAS (traits)
│   │   ├── ports.rs            # LivroRepo, PedidoRepo, Relogio, ImportadorLegado, Impressora
│   │   ├── venda.rs            # Registrar venda (baixa estoque, nº pedido)
│   │   ├── cadastro.rs         # Incluir/alterar/excluir livro
│   │   ├── pesquisa.rs         # Buscar por código/título (sem acento)
│   │   ├── dashboard.rs        # Indicadores do dia
│   │   ├── relatorios.rs       # Vendas/estoque/zerar caixa
│   │   └── migracao.rs         # Orquestra import idempotente (upsert)
│   ├── adapters/               # ADAPTERS (implementam as portas)
│   │   ├── persistencia/       # SeaORM + SQLite
│   │   │   ├── entities/        # Entidades SeaORM (1 arquivo por tabela)
│   │   │   ├── livro_repo.rs    # impl LivroRepo
│   │   │   └── pedido_repo.rs   # impl PedidoRepo
│   │   ├── legado/              # Importador do Access via mdbtools
│   │   │   └── mdb_importer.rs
│   │   └── relogio.rs          # Relógio do sistema
│   ├── migration/              # sea-orm-migration (uma migration por arquivo)
│   ├── commands.rs             # Comandos Tauri (porta de entrada) → chamam casos de uso
│   ├── lib.rs                  # Wiring/composição (injeta adapters nas portas)
│   └── main.rs
├── migration/                  # (se separado como crate de migração)
└── tests/                      # Testes de integração de adapters (SQLite temporário)

src/                            # UI React (adapter de saída/entrada visual)
├── routes/                     # Inicio, Venda, Cadastro, Pesquisa, Relatorios
├── components/                 # AppSidebar, StockBadge, Cover, PaymentRow…
│   └── ui/                     # shadcn
├── lib/                        # ipc.ts (wrappers de invoke), format.ts (BRL, normalize), types.ts
└── App.tsx

docs/
├── adr/                        # ADRs (MADR) — decisões da Phase 0
└── design-handoff/             # Referência de design (existente)

scripts/
└── check-file-size.*           # Guardrail de 300 linhas (hook + pre-commit)
```

**Structure Decision**: Desktop Hexagonal. O domínio e os casos de uso vivem em Rust (`src-tauri/src/domain`
e `application`), 100% testáveis por `cargo test` sem UI nem banco. Toda I/O (SQLite via SeaORM, leitura do
`.mdb`, relógio, impressão) é uma **porta** (trait) implementada por um **adapter** na borda. Os comandos
Tauri (`commands.rs`) são a porta de entrada; a UI React os consome via `invoke`. Isso cumpre os Princípios
I, II e VI da constituição e mantém arquivos pequenos (Princípio III).

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável.
