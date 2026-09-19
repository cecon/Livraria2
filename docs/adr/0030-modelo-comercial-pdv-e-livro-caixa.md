# ADR-0030: Modelo comercial do PDV e livro-caixa

## Status

Em implementacao. Livro-caixa local, sincronizacao API e acompanhamento na nuvem estao
implementados em branch, sem publicacao. A renomeacao comercial das tabelas segue pendente.

## Contexto

O PDV armazena produtos em `livro`, vendas em `pedido`, linhas em `item_pedido`
e recebimentos em `pagamento_pedido`. Esses nomes refletem a origem do sistema,
mas nao o modelo comercial desejado. `turno_operacao` guarda a abertura e o
fechamento. A trilha local de sangrias e suprimentos e o protocolo API para
turnos e movimentos foram adicionados na etapa atual.

## Decisao

- O modelo-alvo usa `produto`, `venda`, `venda_item`, `venda_pagamento`,
  `turno_operacao` e `caixa_movimento`. `produto` pode representar livro ou outro
  item vendavel; atributos bibliograficos passam a ser opcionais ou especializados.
- `venda_item` conserva codigo, descricao, quantidade e preco em centavos como
  snapshot da transacao. `venda_pagamento` conserva a forma e o valor em centavos.
- `caixa_movimento` registra sangria e suprimento vinculados ao turno, com UUID,
  operador, motivo, instante e valor positivo em centavos. O saldo esperado e
  abertura + vendas em dinheiro + suprimentos - sangrias.
- O turno novo do PDV guarda `pdv_uid`, referencia ao ID estavel da maquina
  (`maquina_pdv.uid` local, `nuvem_pdv.uid` na nuvem). Apenas um turno pode
  estar aberto por maquina. `pedido.turno_uid` guarda o ID do turno; a venda
  e seus itens, pagamentos e vinculo ao turno sao gravados na mesma transacao.
- Turnos historicos sem ID de maquina permanecem nulos: o nome textual antigo
  nao e prova de identidade e nao autoriza backfill automatico.
- A migracao para novos nomes sera transacional e verificara contagens, chaves,
  totais e relacionamentos antes de trocar as leituras e escritas. Nao manteremos
  duas tabelas gravaveis para o mesmo fato nem apagaremos historico para renomear.
- O contrato de sincronizacao da nuvem deve aceitar e confirmar movimentos de
  caixa por UUID antes de disponibilizar essa funcao em uma release. Turnos e
  movimentos offline precisam de reenvio idempotente e conciliacao explicita.
- A nuvem precisa receber o turno antes de aceitar a venda que o referencia;
  sem esse fluxo a FK rejeita a venda. A migracao de nuvem entra antes do novo
  cliente, e o cliente nao deve ser publicado antes do envio de turnos.
- O indicador de pendencias inclui turnos e movimentos ainda nao confirmados;
  o painel da nuvem mostra somente eventos efetivamente recebidos.

## Etapas

1. Criar o livro-caixa local e integrar sangria/suprimento ao fechamento, com testes.
2. Adicionar API, persistencia e outbox de movimentos/turnos na nuvem; testar
   offline, repeticao, conflito e reconexao.
3. Migrar `livro` para `produto` e `pedido` para `venda` com os itens/pagamentos
   na mesma transacao; atualizar adapters, relatorios e contratos de replica.
4. Validar em copia de banco real, comparar totais e publicar somente apos
   rollback/backup documentados.

## Consequencias

O PDV ganha trilha auditavel de dinheiro sem perder vendas existentes. A troca
de nomes das tabelas e um trabalho coordenado com a nuvem, nao um alias cosmetico
nem um `ALTER TABLE RENAME` isolado.
