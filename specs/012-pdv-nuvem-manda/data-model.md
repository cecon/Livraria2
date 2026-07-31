# Data Model — PDV de responsabilidade reduzida — fase 2 (feature 012)

Poucas entidades novas — o foco é **mudança de autoria** (quem escreve o quê) e **eventos oficiais** de
estoque na nuvem. Reusa o modelo das fases 006/009/011.

## Mudança de autoria (quem é a fonte de verdade)

| Entidade | Antes (PDV escreve) | Depois (fase 2) |
|---|---|---|
| `pedido` / `item_pedido` / `pagamento_pedido` | PDV cria | **PDV cria (fato)** — inalterado |
| `pedido.cancelado` | PDV marca, **não sincroniza** | **PDV marca + re-sincroniza** (`sincronizado_em=NULL`) |
| `movimento_estoque` (`saida_venda`/`estorno`) | **PDV gera** | **Nuvem gera** (trigger; PDV para) |
| `fornecedor` / `forma_pagamento` / `destinacao` (cadastro) | PDV edita | **Nuvem edita**; PDV só lê |
| Entrada de nota (`movimento_estoque` `entrada`) | PDV gera | **Nuvem gera** (RPC `lancar_entrada`) |
| Inventário (`movimento_estoque` `ajuste`) | PDV gera | **Nuvem gera** (RPC `ajustar_inventario`) |
| Destinar (alocação `transferencia_destinacao`) | PDV gera | **Nuvem gera** (RPC `destinar_estoque`) |

## Entidades / eventos

- **`pedido`** — fato operacional. Estado mutável relevante: `cancelado` (LWW por `atualizado_em`).
  Invariante do cancelamento: ao cancelar no PDV, `sincronizado_em` volta a `NULL` (fica pendente).
- **`movimento_estoque`** — ledger oficial **na nuvem** (append-only). Tipos: `saida_venda`,
  `estorno_venda` (fase 1), **`entrada`** (nota), **`ajuste`** (inventário). `saldo_publicado =
  Σ movimentos` via `vw_saldo_livro`; qualquer inserção republica (trigger `0012`).
- **Entrada de nota** — evento na nuvem: por item, `entrada` `qtd>0`; identidade estável por (nota,
  item) para idempotência.
- **Ajuste de inventário** — evento na nuvem: por item contado, `ajuste` `qtd = contado − saldo`;
  identidade por (sessão de inventário, item).
- **`transferencia_destinacao` / `alocacao_venda`** — carimbos de destinação, agora movidos **na
  nuvem** (RPC `destinar_estoque`); o PDV lê os saldos por destinação publicados.
- **Cadastros de referência** (`fornecedor`, `forma_pagamento`, `destinacao`) — **pull-only** no PDV
  (LWW com origem na nuvem); sem push do PDV.
- **Saldo operacional (derivado, PDV)** — `saldo_publicado − Σ vendas não sincronizadas + Σ
  cancelamentos não sincronizados` (regra pura; já na fase 1). Base do saldo exibido offline.

## Invariantes

- **INV-1 (cancelamento sobe)**: um pedido cancelado no PDV MUST ter `sincronizado_em IS NULL` até a
  nuvem confirmar; a nuvem estorna uma única vez (idempotência por `sync_uid` determinístico do estorno).
- **INV-2 (PDV não contabiliza)**: nenhum `movimento_estoque` de `saida_venda`/`estorno` é gerado ou
  empurrado pelo PDV após a atualização.
- **INV-3 (fonte única de cadastro)**: nenhum cadastro `fornecedor`/`forma_pagamento`/`destinacao` tem
  origem/edição no PDV após a atualização.
- **INV-4 (estoque = Σ movimentos, na nuvem)**: entrada/ajuste/saída/estorno todos como movimentos
  oficiais na nuvem; `saldo_publicado` reflete a soma e republica.
- **INV-5 (idempotência)**: RPCs de entrada/inventário/destinar e a migração são idempotentes
  (identidade estável + `on conflict do nothing` / guardas).
- **INV-6 (offline de venda)**: venda/cancelamento/consulta funcionam sem internet; entrada/inventário
  exigem a retaguarda.

## Transições de estado do `pedido` (estoque_status)

```
rascunho ──concluir venda──▶ pronta ──(nuvem incorpora)──▶ incorporada
incorporada ──cancelar no PDV (re-sync)──▶ cancelado ──(nuvem estorna)──▶ cancelada_estornada
pronta ── itens ausentes no sync ──▶ (nuvem espera; incorpora quando chegam — fase 1 / 0013)
```
