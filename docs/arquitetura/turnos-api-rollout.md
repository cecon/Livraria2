# Turnos administrativos via API

`API_TURNOS_ENABLED=false` preserva o caminho legado. Com a chave ligada, o
administrador consulta, abre e encerra apenas os seus turnos pela API NestJS.

A abertura usa bloqueio transacional para impedir dois turnos simultaneos do
mesmo operador. O fechamento calcula no servidor os recebimentos em dinheiro,
somando o caixa inicial, e grava esperado, conferido e diferenca como inteiros
de centavos. Repetir o mesmo fechamento e idempotente; um valor diferente apos
o encerramento retorna conflito.

Para ativar, publique primeiro a API e depois ligue a chave somente no web. A
reversao consiste em desligar `API_TURNOS_ENABLED` e reiniciar o web. A chave
permanece desligada por padrao e nenhuma migration nova e necessaria.
