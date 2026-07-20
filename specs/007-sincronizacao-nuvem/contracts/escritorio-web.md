# Contrato — App do escritório (web)

App **React + Vite estático** (`apps/escritorio`), falando com o Supabase via `@supabase/supabase-js`. Sempre online. Hospedado no Portainer (nginx). **Sem Next.js, sem SSR** (D12).

## Autenticação (Clarificação 2026-07-20)

- **Login por usuário** via **Supabase Auth** (tela de Login). Nenhuma tela grava/lê sem sessão autenticada; RLS por usuário no backend.
- Toda gravação carrega a **autoria** (`criado_por = auth.uid()`) para auditoria/revogação.

## O que o escritório GRAVA (direto na nuvem, como eventos crus)

| Ação (tela) | Efeito | Regra |
|---|---|---|
| **Receber livros** (Recebimento) | Insere `lancamento_entrada` + `item_lancamento` e os `movimento_estoque` tipo `entrada` correspondentes, com `origem='escritorio'`, `sync_uid` gerado no cliente. | qtd/custo validados por `CHECK` no schema (não reimplementa regra de negócio). |
| **Cadastrar/editar livro e preço** | Upsert em `livro` com `atualizado_em = now()` do servidor (LWW). | Dedup por **código de barras**; soft delete via `excluido_em`. |
| **Cadastrar/editar fornecedor** | Upsert em `fornecedor` com `atualizado_em = now()`. | Dedup por **nome/documento**; permite receber de fornecedor novo com o notebook desligado (FR-021). |

- O escritório **não** grava saldo nem `custo_medio` (derivados, lidos das views).
- O escritório **não** vende (fora de escopo).
- Cadastros de **forma de pagamento (005)** e **destinação (006)** ficam no PDV; o escritório os **lê** (relatórios).

## O que o escritório LÊ

| Tela | Fonte |
|---|---|
| Consulta de estoque | `vw_saldo_livro` + `vw_custo_medio` (fold do ledger). |
| Consulta de vendas | `pedido` / `item_pedido` / `pagamento_pedido` sincronizados do PDV. |
| Relatório de formas de pagamento (005) | `pagamento_pedido` + `forma_pagamento`. |
| Relatório de repasse por destinação (006) | `alocacao_venda` + `destinacao`. |

## Convergência

- Eventos crus gravados pelo escritório são puxados pelo PDV no próximo `sincronizar_agora`; o PDV recomputa `custo_medio`/saldo por fold (D5).
- Edições de `livro` convergem por LWW (D7).
- Deleções via `excluido_em` propagam nos dois sentidos (D8).

## Reuso (monorepo)

- Tipos de entidade e componentes de formulário (recebimento, cadastro) compartilhados com o PDV via `packages/` — sem duplicar o modelo.
- **npm-only** ao integrar ao workspace (memória `npm-only-lockfile`): não usar pnpm/npm 11; não corromper o lockfile.
