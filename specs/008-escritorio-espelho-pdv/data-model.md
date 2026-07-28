# Data Model — Fase 1: Escritório espelho do PDV

Esta feature **não cria entidades novas**. Reusa o modelo já existente nas duas pontas: o **esquema-espelho da nuvem** (feature 007, `apps/nuvem/migrations/`) e o **domínio Rust** (`src-tauri/src/domain/`). O que esta feature acrescenta é o **adapter web** (Supabase) que dirige o mesmo domínio e as **regras elevadas** ao domínio. Abaixo, o modelo consolidado e os contratos de porta que o Escritório passa a implementar.

## 1. Entidades (esquema-espelho da nuvem)

Todas chaveadas por `sync_uid uuid PK`, com colunas de sync (`origem`, `atualizado_em`, `excluido_em`, `criado_por`, `sincronizado_em`) e **FK por `sync_uid`** (não por id local). Dinheiro sempre em **inteiro de centavos**. **`estoque` e `custo_medio` NÃO são colunas** — são derivados.

| Entidade | Papel | Chave natural (dedup) | Derivados |
|---|---|---|---|
| `livro` | catálogo, preço | `codigo` (unique) | saldo (view), custo médio (fold WASM) |
| `fornecedor` | origem de mercadoria | `nome_norm` (unique) | — |
| `usuario` | operador/identidade (**sem `senha_hash`**) | `usuario` (unique) | — |
| `forma_pagamento` | meio de pagamento | `chave` (unique) | — |
| `destinacao` | fundo de doação | `nome_norm` (unique) | — |
| `pedido` → `item_pedido`, `pagamento_pedido` | ciclo de venda | `(pedido_uid, forma_uid)` unique | total/troco (domínio) |
| `movimento_estoque` | **ledger append-only** (entrada, saida_venda, ajuste, saldo_inicial) | — | base de saldo e custo |
| `lancamento_entrada` → `item_lancamento` | nota de entrada | — | total nota (domínio) |
| `transferencia_destinacao`, `alocacao_venda` | contabilidade de doações (006) | — | — |
| **`turno_operacao`** *(novo)* | sessão de operação (abre/fecha) do operador | — | resumo de fechamento (domínio) |

### Colunas novas em `pedido`

- `turno_uid uuid` → FK para `turno_operacao(sync_uid)` (nulo tolerado para histórico legado).
- `numero_no_turno int` → **Pedido Nº sequencial dentro do turno** (1..n).

### `turno_operacao` (campos)

`sync_uid` (PK/identidade) · `operador_uid` (quem abriu) · `status` (`aberto`/`encerrado`) · `abertura_em` · `caixa_inicial_centavos` (opcional) · `encerramento_em` · `resumo_json` (totais por forma, qtd, esperado, conferido, diferença) · colunas de sync (`origem`, `atualizado_em`, `excluido_em`, `criado_por`, `sincronizado_em`).

> **Nomenclatura (evitar colisão)**: o tipo de domínio é **`TurnoOperacao`** no arquivo **`crates/livraria-domain/src/turno_operacao.rs`** — **distinto** do enum `Turno` (horário Manhã/Tarde, `pagamento.rs`, Princípio VI). Não reusar o nome `Turno` para a sessão de operação.

### Ciclo de vida do turno

`(inexistente) → Aberto` (ação "Abrir turno", caixa inicial opcional) `→ Encerrado` (fechamento de caixa). Em `Encerrado`: não aceita novas vendas. Numeração de `pedido.numero_no_turno` só avança em turno `Aberto`.

**Regras estruturais herdadas** (007): união aditiva de movimentos é conflito-livre; recursos mutáveis convergem por LWW (`atualizado_em` = hora do servidor); deletes são soft (`excluido_em`); a `0003` removeu os CHECKs do espelho (o invariante mora no domínio, não no banco).

## 2. Derivados — como o Escritório obtém

| Derivado | Fonte no Escritório | Observação |
|---|---|---|
| **Saldo do livro** | `vw_saldo_livro` (leitura) | `Σ qtd` dos movimentos não excluídos. Imediato após inserir movimento. |
| **Custo médio** | **domínio via WASM** (`recompor_ledger` sobre movimentos ordenados por `criado_em`) | Evita `vw_custo_medio` (que não existe e duplicaria a regra). |
| **Total/troco de venda** | domínio (`Pedido::total/restante/troco`, `validar_conclusao`) | Idêntico ao PDV. |
| **Baixa de venda (clamp)** | domínio (regra elevada, ADR-0018) | `min(qtd, saldo).max(0)`; sinaliza quando `baixa < qtd`. |
| **Baseline de saldo inicial** | domínio (regra elevada, ADR-0017) | `saldo_inicial = estoque − Σ movimentos`, garante ledger completo antes de operar. |

## 3. Contratos de porta (o que o adapter Supabase implementa)

O Escritório espelha os *ports* do PDV (`application/ports*.rs`) como um **adapter web** sobre PostgREST/supabase-js. Nível conceitual (assinaturas detalhadas em `contracts/`):

- **LivroRepo (web)**: listar/buscar por `codigo`; upsert por `sync_uid` (LWW por `atualizado_em`); saldo via `vw_saldo_livro`; custo via fold WASM.
- **PedidoRepo (web)**: criar `pedido`+`item_pedido`+`pagamento_pedido`; emitir `saida_venda` por item com clamp do domínio; nunca deixa saldo negativo.
- **FormaPagamentoRepo (web)**, **FornecedorRepo (web)**, **DestinacaoRepo (web)**: CRUD por `sync_uid` + dedup por chave natural.
- **LancamentoRepo (web)**: `lancamento_entrada`+`item_lancamento`+`movimento_estoque(entrada)`.
- **InventarioRepo (web)**: sessão de contagem → movimentos de ajuste; `contagem_efetiva`/`resumir` do domínio.
- **EstoqueRepo (web)**: garantir baseline de saldo inicial (regra elevada) antes de operar um livro.
- **TurnoRepo (web + PDV)**: abrir turno (operador, caixa inicial opcional); obter turno aberto do operador; `proximo_numero` para o pedido; encerrar com resumo de fechamento; dedup/convergência por `sync_uid`.
- **PedidoRepo** (ajuste): toda venda referencia o `turno_uid` aberto e grava `numero_no_turno = proximo_numero(...)`.
- **Relógio (web)**: hora do **servidor** (header `Date`/`now()`), nunca o relógio do navegador para carimbos de convergência.

## 3.1 Migrations (idempotentes por comando)

- **SQLite local `m009`**: cria `turno_operacao`; adiciona `pedido.turno_uid`, `pedido.numero_no_turno`. Re-aplicável sem duplicar.
- **Nuvem `0004_turno.sql`**: mirror `turno_operacao` (`sync_uid` PK + colunas de sync) + FK `pedido.turno_uid` + `pedido.numero_no_turno` + RLS `to authenticated`.
- **Sync**: `turno_operacao` entra na `ORDEM_DEPENDENCIA` **antes de `pedido`**; convergência LWW por `atualizado_em` de servidor (turno é *origin-owned*).

Todos os adapters carimbam `origem:"escritorio"`, `criado_por = auth.uid()` e respeitam RLS (`to authenticated`).

## 4. Invariantes a preservar (checados por teste de paridade)

- Moeda = inteiro de centavos em toda escrita/leitura/soma.
- `Σ movimentos == estoque real` por livro (ledger completo; ADR-0017) antes de operar.
- Nenhuma venda gera saldo negativo; `baixa < qtd` é sinalizado, não silencioso (ADR-0018).
- Convergência idêntica à do PDV (LWW por `atualizado_em` de servidor; soft-delete).
- Mesmo resultado de `recompor_ledger`, `custo_medio_apos_entrada`, `Pedido::validar_conclusao`, `alocar_venda/alocar_perda`, `contagem_efetiva/resumir` entre PDV (nativo) e Escritório (WASM) — **mesmo input → mesmo output**.
- Venda só existe com `turno_uid` de turno **Aberto**; `numero_no_turno` é sequencial 1..n **dentro do turno** (sem colisão entre origens/turnos).
- Resumo de fechamento (totais por forma, esperado, conferido, diferença) idêntico PDV↔Escritório para as mesmas vendas do turno.
