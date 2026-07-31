# Contract — RPCs da nuvem (entrada, inventário, destinar) + edição de cadastro

Todas `SECURITY DEFINER`, transacionais, **idempotentes**, exigem admin ativo (padrão da 010 —
`_exige_admin`). Todas afetam `movimento_estoque`/`transferencia_destinacao` na nuvem e **republicam**
via o trigger `0012` (bump de `livro.sincronizado_em`). Migração: `0014_entrada_inventario_destinar.sql`.

## `lancar_entrada(p_admin, p_fornecedor_uid, p_nota, p_itens jsonb)`

- **Entrada**: `p_itens = [{ livro_uid|codigo, qtd>0, custo_unit_centavos? }]`.
- **Efeito**: por item, cria `movimento_estoque` `tipo='entrada'`, `qtd = +qtd`, referência = nota;
  atualiza custo médio se informado. Republica o saldo.
- **Idempotência**: `sync_uid` determinístico por (nota, item) → `on conflict do nothing`.
- **Erros (pt-BR)**: não-admin; item sem produto conhecido; qtd ≤ 0.

## `ajustar_inventario(p_admin, p_sessao, p_itens jsonb)`

- **Entrada**: `p_itens = [{ livro_uid|codigo, contado>=0 }]`.
- **Efeito**: por item, calcula `delta = contado − saldo_oficial_atual` e cria `movimento_estoque`
  `tipo='ajuste'`, `qtd = delta` (pode ser ±). Republica.
- **Idempotência**: identidade por (sessão, item); re-enviar a mesma contagem não duplica ajuste
  (regrava o alvo, não acumula) — guarda por sessão.
- **Erros**: não-admin; item desconhecido; contagem negativa.

## `destinar_estoque(p_admin, p_livro_uid, p_de, p_para, p_qtd)`

- **Efeito**: move `qtd` entre "livre" e uma destinação (ou entre destinações) via
  `transferencia_destinacao` compensatória (mesma mecânica da 006, agora na nuvem). Não altera o saldo
  total; altera os saldos por destinação. Republica os saldos por destinação para o PDV.
- **Idempotência**: identidade determinística por (livro, de, para, referência da operação).
- **Erros**: não-admin; saldo de origem insuficiente; destinação inexistente/inativa.

## Edição de cadastro (autoridade na nuvem)

Reusar o padrão da 010 (RPC ou rota server que escreve no Postgres): `criar/editar/desativar` para
`fornecedor`, `forma_pagamento`, `destinacao`. O PDV **não** chama estas — só lê o resultado pelo sync.

## Contrato do PDV — cancelamento como fato

- Ao cancelar, o PDV grava `pedido.cancelado=1`, `cancelado_em`, `atualizado_em=now()`,
  **`sincronizado_em=NULL`** e **não** gera `estorno` local.
- O push envia o `pedido` (recurso mutável, LWW). A nuvem, via `trg_pedido_estoque_cancelamento`,
  estorna e republica. Idempotente (estorno com `sync_uid` determinístico).

## Contrato do PDV — lista de vendas do turno aberto (dashboard)

- `dashboard_do_turno()` (ou equivalente) retorna as vendas do turno **aberto**: `numero`,
  `total_centavos`, hora, `situacao` (ativa/cancelada). 100% local (pedido + turno). Sem indicadores de
  estoque. Estado vazio quando não há turno aberto.
