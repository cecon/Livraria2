# Implementation Plan: Movimentação de Estoque & Inventário — Livraria 2

**Branch**: `main` (feature dir: `002-estoque-movimentos-inventario`) | **Date**: 2026-06-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-estoque-movimentos-inventario/spec.md`

## Summary

Introduzir uma **razão de movimentos de estoque** (ledger) como fonte da verdade, estendendo o núcleo da
feature 001. Toda alteração de estoque — `saldo_inicial`, `entrada` (compra com fornecedor e custo),
`saida_venda`, `ajuste` e `contagem` (inventário) — vira um **movimento imutável**; o `livro.estoque`
passa a ser um saldo reconciliável com a soma dos movimentos. Adiciona: **entrada de mercadoria** com
**custo médio ponderado** por livro; **inventário por bipagem** (leitor de código de barras) em sessões
**parcial/total** com reconciliação no fechamento; **ajuste avulso** com motivo (nunca deixa estoque
negativo); **extrato** por livro; e **pendências de cadastro** para códigos desconhecidos. Mantém a
arquitetura Hexagonal: domínio Rust puro (regra de custo médio, diferença de contagem, modo total),
portas novas (`EstoqueRepo`, `InventarioRepo`), adapters SeaORM/SQLite, comandos Tauri e UI React.

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sqlx-sqlite, runtime tokio); sea-orm-migration; serde;
React + Vite 7 + shadcn/ui + Tailwind v4 — **sem novas dependências** (reusa a stack da 001)

**Storage**: SQLite local (`app_data_dir`); novas tabelas `movimento_estoque`, `sessao_inventario`,
`item_contagem`, `pendencia_cadastro`; colunas novas em `livro` (`codigo_barras`, `custo_medio_centavos`)

**Testing**: `cargo test` (domínio/aplicação puros via fakes das portas; adapters com SQLite temporário);
Vitest mínimo para utilidades de UI

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: cada bipagem reflete a contagem em < 1 s (SC-003); entrada de mercadoria < 30 s
(SC-002); leituras de extrato/inventário percebidas como instantâneas em acervo de ~500–5.000 livros

**Constraints**: offline; sem backend HTTP; ≤ 300 linhas significativas por arquivo; migrations idempotentes
por comando; geração de `saldo_inicial` idempotente; **dinheiro em centavos (i64)**; custo médio inteiro com
arredondamento half-up documentado; termos pt-BR

**Scale/Scope**: ~503 livros (geram ~503 movimentos `saldo_inicial` na adoção); volume de movimentos cresce
com vendas/entradas/contagens; +3 telas (Entrada, Inventário, Extrato/ajuste); mono-usuário

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | Domínio puro novo (`domain/estoque.rs`, `domain/inventario.rs`: custo médio, diferença de contagem, modo total); portas `EstoqueRepo`/`InventarioRepo`; adapters SeaORM implementam; venda passa a emitir movimento via porta existente | ✅ PASS |
| II. KISS & DRY / YAGNI | Um único mecanismo (ledger) para entrada/venda/ajuste/contagem; sem cadastro formal de fornecedor (texto + sugestão); sem novas dependências | ✅ PASS |
| III. ≤300 linhas/arquivo | Domínio dividido em `estoque.rs` + `inventario.rs`; casos de uso em arquivos pequenos (`entrada.rs`, `ajuste.rs`, `inventario.rs`, `extrato.rs`); portas novas em módulo próprio se `ports.rs` aproximar do limite | ✅ PASS (verificável por hook) |
| IV. Migrations por comando & idempotência | Nova migration `m_estoque` rastreada pelo migrator (roda 1×); `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN`; `saldo_inicial` gerado por passo idempotente em runtime (só p/ livros sem movimento) | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | Novos ADRs: razão de movimentos como fonte da verdade; custo médio ponderado; reconciliação no fechamento do inventário. Hook de 300 linhas vigente | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Termos `entrada`, `fornecedor`, `gaveta/estante`, `saldo inicial`, `inventário`; custo em centavos, R$ pt-BR; busca por código de barras + nome sem acento | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking não aplicável.

## Project Structure

### Documentation (this feature)

```text
specs/002-estoque-movimentos-inventario/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (viram ADRs)
├── data-model.md        # Phase 1 — entidades, esquema SQLite, regras
├── quickstart.md        # Phase 1 — validação ponta a ponta
├── contracts/
│   └── tauri-commands.md # Phase 1 — novos comandos invoke
├── checklists/
│   └── requirements.md  # qualidade da spec (16/16)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas sobre a 001

```text
src-tauri/src/
├── domain/
│   ├── estoque.rs          # NOVO — TipoMovimento, MovimentoEstoque, custo médio, ajuste não-negativo
│   ├── inventario.rs       # NOVO — ModoInventario, StatusSessao, diferença de contagem, regra modo total
│   └── livro.rs            # ALTERADO — campos codigo_barras + custo_medio
├── application/
│   ├── ports.rs            # ALTERADO/EXTENDIDO — EstoqueRepo, InventarioRepo (ou ports_estoque.rs se >300)
│   ├── entrada.rs          # NOVO — registrar entrada (custo total↔unitário, recálculo custo médio)
│   ├── ajuste.rs           # NOVO — ajuste avulso com motivo (não-negativo)
│   ├── inventario.rs       # NOVO — abrir/bipar/revisar/fechar/cancelar sessão; pendências
│   ├── extrato.rs          # NOVO — extrato de movimentação por livro
│   └── estoque_setup.rs    # NOVO — gerar_saldos_iniciais (idempotente, chamado no boot)
├── adapters/persistencia/
│   ├── entities/
│   │   ├── movimento_estoque.rs   # NOVO
│   │   ├── sessao_inventario.rs   # NOVO
│   │   ├── item_contagem.rs       # NOVO
│   │   └── pendencia_cadastro.rs  # NOVO
│   ├── estoque_repo.rs     # NOVO — impl EstoqueRepo (transações atômicas: movimento + saldo + custo médio)
│   ├── inventario_repo.rs  # NOVO — impl InventarioRepo
│   ├── livro_repo.rs       # ALTERADO — upsert com codigo_barras/custo_medio; busca por codigo_barras
│   └── pedido_repo.rs      # ALTERADO — registrar() também insere movimento saida_venda na mesma txn
├── migration/mod.rs        # ALTERADO — registra m_estoque (ALTER livro + novas tabelas)
├── commands.rs             # ALTERADO — novos comandos + DTOs (camelCase)
└── lib.rs                  # ALTERADO — chama gerar_saldos_iniciais no setup; registra novos handlers

src/ (UI React)
├── routes/                 # NOVO — Entrada, Inventario; Extrato/ajuste (em Pesquisa/Cadastro ou rota própria)
├── components/             # NOVO — EntradaForm, InventarioScanner, ExtratoMovimentos, Pendencias
└── lib/                    # ALTERADO — ipc.ts (novos invoke), types.ts (Movimento, Sessao, etc.)

docs/adr/                   # NOVOS ADRs 0008/0009/0010 (ver research.md)
```

**Structure Decision**: Desktop Hexagonal (mesma da 001). O domínio puro ganha `estoque.rs` e
`inventario.rs` (regras testáveis sem UI/banco). Toda I/O nova é porta (`EstoqueRepo`, `InventarioRepo`)
implementada por adapters SeaORM. A venda existente passa a emitir `saida_venda` na mesma transação da baixa,
preservando atomicidade. Arquivos pequenos cumprem o Princípio III; migration nova preserva idempotência (IV).

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável.
