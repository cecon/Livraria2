# ADR-0029: Remover fila de divergencias de estoque

## Status

Aceita em 2026-09-15.

## Contexto

A tabela `divergencia_estoque` e a tela administrativa permitiam apenas marcar alertas como
resolvidos ou ignorados. Nenhuma das acoes corrigia saldo, produto ou venda. Isso duplicava
informacao ja representada no razao de movimentos e criava dados sem uso operacional.

## Decisao

- Remover a rota, navegacao, cliente web e endpoints administrativos de divergencias.
- Remover o modelo Prisma e a tabela `divergencia_estoque` por migration idempotente.
- Retirar `divergente` dos estados permitidos de `pedido.estoque_status`.
- Reprocessar pedidos antigos nesse estado antes de eliminar a tabela.
- Preservar a incorporacao idempotente de vendas, os movimentos `saida_venda`, os estornos e o
  saldo negativo no razao oficial.
- Manter pedidos com produto ainda desconhecido em `pronta`, aguardando item valido, sem criar
  uma fila paralela.
- Usar inventario, ajustes e extrato de movimentos para correcoes reais de estoque.

## Consequencias

O banco deixa de acumular alertas que nao possuem acao corretiva. Vendas e sincronizacao continuam
funcionando, e saldos negativos permanecem visiveis nas consultas oficiais. A exclusao dos registros
antigos de divergencia e intencional e nao altera pedidos nem movimentos de estoque.
