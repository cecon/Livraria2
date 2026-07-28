# Contract: Sync PDV and Saldo Local Simples

## Produto Published to PDV

The cloud publishes a sellable product snapshot:

```json
{
  "livro_uid": "uuid",
  "codigo": "string",
  "titulo": "string",
  "autor": "string|null",
  "preco_centavos": 1234,
  "ativo": true,
  "saldo_publicado": 10,
  "sincronizado_em": "2026-07-28T00:00:00Z"
}
```

Rules:

- `saldo_publicado` comes from official cloud stock.
- PDV must treat it as operational, not accounting.
- PDV must not create sales for unknown/unpublished products.

## Local Balance Formula

For each product:

```text
saldo_local = saldo_publicado - vendas_nao_sincronizadas + cancelamentos_nao_sincronizados
```

Definitions:

- `vendas_nao_sincronizadas`: sum of quantities sold locally and not yet confirmed by cloud sync.
- `cancelamentos_nao_sincronizados`: sum of quantities from local cancellations not yet confirmed by cloud sync.

## Sale Sync Payload

A synced sale must carry enough information for cloud stock processing:

- stable sale identity (`pedido.sync_uid`)
- `numero`, `turno`, `turno_uid` when available
- items referencing known products (`livro_uid` or resolvable `codigo`)
- payments
- completion marker (`estoque_status = 'pronta'` or equivalent)

Clients must not send official `saida_venda` movements for sales after this feature is active.

Implementation note:

- Local PDV can keep its local ledger rows for offline operation.
- The sync adapter must filter local `movimento_estoque.tipo = 'saida_venda'` out of the cloud push.
- Completed local sales are represented by `pedido.estoque_status = 'pronta'`.
- Legacy/local historical rows should not be changed to `pronta` during rollout; only new completed
  sales should carry the ready marker.

## Cancellation Sync Payload

A synced cancellation must carry:

- stable sale identity (`pedido.sync_uid`)
- `cancelado = true`
- `cancelado_em`

Clients must not send official `estorno_venda` movements for cancellations after this feature is active.

Implementation note:

- The cancellation fact is the mutable `pedido` row (`cancelado`, `cancelado_em`).
- The sync adapter must filter local sale reversal movements (`movimento_estoque.tipo = 'estorno'`)
  out of the cloud push.
- The cloud creates official `estorno_venda` rows linked to the original `saida_venda`.
