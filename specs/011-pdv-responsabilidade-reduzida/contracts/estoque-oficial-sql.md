# Contract: Estoque Oficial na Nuvem

## Migration

**File**: `apps/nuvem/migrations/0011_estoque_oficial_venda.sql`

The migration must be idempotent:

- `alter table ... add column if not exists`
- `create table if not exists`
- `create or replace function`
- `drop trigger if exists` before `create trigger`
- `create unique index if not exists`
- no historical reprocessing that changes current production balances

## Venda Pronta

### Input state

A sale is eligible for official stock processing when:

- `pedido.estoque_status = 'pronta'`
- `pedido.cancelado = false`
- sale has at least one item
- all items resolve to known/published products

### Output

For each item:

- insert one `movimento_estoque` with:
  - `tipo = 'saida_venda'`
  - `qtd = -item_pedido.qtd`
  - `pedido_uid = pedido.sync_uid`
  - `item_pedido_uid = item_pedido.sync_uid`
  - `referencia = pedido.numero`
- if resulting official saldo becomes negative, insert `divergencia_estoque(tipo='saldo_negativo')`
- if product is inactive, insert `divergencia_estoque(tipo='produto_inativo')`
- set pedido status to `incorporada` after successful movement generation

### Idempotency

Required uniqueness:

- one sale movement per `item_pedido_uid` for `tipo='saida_venda'`
- reprocessing the same ready sale does not create additional movement rows

## Cancelamento

### Input state

A cancellation is eligible for official stock reversal when:

- `pedido.cancelado = true`
- original sale was already incorporated
- original `saida_venda` movements exist

### Output

For each original sale movement:

- insert one `movimento_estoque` with:
  - `tipo = 'estorno_venda'`
  - `qtd = abs(original.qtd)`
  - `pedido_uid = pedido.sync_uid`
  - `item_pedido_uid = original.item_pedido_uid`
  - `movimento_origem_uid = original.sync_uid`
  - `referencia = pedido.numero`
- set pedido status to `cancelada_estornada`

### Idempotency

Required uniqueness:

- one reversal movement per `movimento_origem_uid`
- repeated cancellation sync does not duplicate reversal

## Divergencias

`divergencia_estoque` must be append-only for detection and resolvable by explicit admin action.

Minimum divergence types:

- `saldo_negativo`
- `produto_inativo`
- `venda_invalida`
- `processamento_estoque`

## Production Baseline

Before enabling automation:

- capture current saldo by product as `saldo_partida_producao`
- do not reprocess historical sales to mutate current saldo
- all subsequent official movements apply after the baseline

