# Contrato — Sincronização: venda push-only + fechamento que desce

Base: `src-tauri/src/adapters/persistencia/replica_mapa.rs` (specs de recurso, `ORDEM_DEPENDENCIA`,
`pull_only`) e `replica_sync.rs` (push/pull por cursor `sincronizado_em`).

## Classificação de recurso
| Recurso | Direção | Observação |
|---|---|---|
| `pedido`, `item_pedido`, `pagamento_pedido`, `alocacao_venda` | **push_only** (NOVO) | Sobem; **não descem** (nem próprios nem de outros PDVs). |
| `turno_operacao` | **bidirecional** | Sobe (inclui `maquina`); **fechamento desce** (status `encerrado`, LWW). |
| `livro` | pull | Traz `saldo_publicado` (base do saldo operacional). |
| `fornecedor`, `forma_pagamento`, `destinacao` | pull_only | (feature 012, inalterado). |

## Regra de push (inalterada)
- Envia linhas com `sincronizado_em IS NULL`, na `ORDEM_DEPENDENCIA` (turno antes de pedido).
- **Ao confirmar o envio de um `pedido`**: setar `sincronizado_em = agora` **e** `ja_sincronizado = 1`
  (persistente). O cancelamento zera `sincronizado_em` mas **não** `ja_sincronizado`.

## Regra de pull (NOVO)
- **Ignora** recursos `push_only` (não baixa vendas).
- Aplica `livro.saldo_publicado` (como hoje) e `turno_operacao` (LWW por `atualizado_em`).

## Aplicar fechamento vindo da nuvem + reconciliação (FR-019/FR-024)
Ao aplicar um `turno_operacao` puxado com `status='encerrado'`:
1. Marca o turno local como `encerrado`.
2. Se existir **pedido local do turno com `sincronizado_em IS NULL`** (pendente):
   - Cria um **novo turno** (`aberto`, mesma `maquina`, operador corrente, novo `sync_uid`).
   - `UPDATE pedido SET turno_uid = <novo> WHERE turno_uid = <fechado> AND sincronizado_em IS NULL`.
   - O turno fechado **permanece fechado**; as pendentes sobem sob o novo turno. Nenhuma venda perdida.

## Invariantes
- Após o pull, um PDV **nunca** contém venda que não produziu (SC-003).
- `saldo_publicado` continua descendo sem baixar vendas (FR-005).
