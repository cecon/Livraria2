# Vendas do escritorio via API

`API_VENDAS_ENABLED=false` mantem a gravacao legada. Com a chave ligada, a API
valida turno aberto, produtos, formas, itens, pagamentos e troco antes de gravar
pedido, itens, recebimentos e baixa de estoque em uma unica transacao.

Precos e pagamentos sao inteiros de centavos. O preco efetivamente cobrado e
preservado no item mesmo que o catalogo tenha outro valor. A numeracao global e
por turno e atribuida sob bloqueio, evitando duplicidade entre vendas concorrentes.

O rollout exige API publicada antes do web. Para reverter, desligue apenas
`API_VENDAS_ENABLED` e reinicie o web. A chave segue desligada por padrao.
