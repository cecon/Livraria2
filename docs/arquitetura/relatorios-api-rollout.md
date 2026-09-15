# Relatorios e painel via API

`API_RELATORIOS_ENABLED=false` preserva as consultas legadas. Com a chave
ligada, painel, vendas, estoque e destinacoes sao agregados pela API NestJS e o
navegador recebe apenas o resultado final.

Todos os valores monetarios e quantidades passam por verificacao de inteiro
seguro. O proxy permite somente os quatro relatorios conhecidos e seus filtros
declarados. A ativacao exige API publicada; a reversao desliga a chave e reinicia
somente o web. Nenhuma migration foi adicionada e a chave segue desligada.
