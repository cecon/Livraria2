# Contrato — Esquema e acesso na nuvem (Supabase/Postgres)

## Tabelas (espelho das sincronizáveis)

Mesmos campos de negócio das tabelas locais + colunas de sync (ver [data-model.md](../data-model.md)). Cada tabela:

- `sync_uid uuid PRIMARY KEY`
- `sincronizado_em timestamptz NOT NULL DEFAULT now()` — cursor de pull (D9)
- `origem text NOT NULL CHECK (origem IN ('pdv','escritorio'))`
- `atualizado_em timestamptz` (só mutáveis: `livro`)
- `excluido_em timestamptz` (só mutáveis)
- **FKs enforced**: `movimento_estoque.livro_codigo → livro(codigo)`, itens → cabeçalho.
- **CHECKs** (fonte única de invariante p/ o escritório): `qtd <> 0`; `custo_unit_centavos >= 0`; `preco_centavos >= 0`.

## Upsert idempotente (PostgREST)

- Escrita = `POST` com header `Prefer: resolution=merge-duplicates`, conflito em `sync_uid` (D3/D4).
- Para `livro` (LWW), a policy/coluna garante que só prevalece quando `atualizado_em` recebido ≥ atual.

## Derivados como VIEW (nunca coluna sincronizada)

- `vw_saldo_livro(livro_codigo, saldo)` = `SUM(qtd)` por livro sobre `movimento_estoque WHERE excluido_em IS NULL`.
- `vw_custo_medio(livro_codigo, custo_medio_centavos)` = fold do ledger ordenado por `criado_em` (espelha ADR-0009).
- O escritório **lê** essas views para exibir estoque/custo; nunca grava saldo/custo (D5).

## Segurança / Auth / RLS (D3 — Clarificação 2026-07-20)

- **Login por usuário** via **Supabase Auth**: cada operador do escritório tem credencial própria; o PDV usa um usuário de serviço dedicado.
- **RLS habilitada** em todas as tabelas, com **policies por usuário autenticado** (`auth.uid()`); acesso confinado ao workspace.
- **Autoria**: coluna `criado_por` (uuid do usuário) nas gravações do escritório → auditoria e **revogação individual** (FR-020).
- **`service_role` nunca** é embarcada em cliente (nem no binário Tauri, nem no bundle web).
- Migrações de schema da nuvem são **versionadas e idempotentes** (paralelo do Princípio IV para o lado nuvem).

## Escopo de tabelas (Clarificação 2026-07-20)

Espelham-se: `livro`, `movimento_estoque`, `pedido`/`item_pedido`/`pagamento_pedido` (005), `forma_pagamento` (005), `lancamento_entrada`/`item_lancamento`, `fornecedor` (003), `destinacao`/`transferencia_destinacao`/`alocacao_venda` (006). Índices únicos de **dedup**: `livro(codigo_barras)`, `fornecedor(nome_normalizado, documento)`.

## O que NÃO vai para a nuvem

- `livro.custo_medio_centavos` como valor (é derivado — vira VIEW).
- Saldo como número.
- `sync_cursor` (é estado local do PDV).
- Qualquer credencial/segredo (ficam na Memória do Projeto no Notion).
