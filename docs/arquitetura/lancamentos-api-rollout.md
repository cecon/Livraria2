# Lancamentos de entrada via API

`API_LANCAMENTOS_ENABLED=false` mantem a tela no caminho legado. Com a chave
ligada, listagem, rascunhos, itens, finalizacao, cancelamento e exclusao usam o
proxy do web e a API NestJS com identidade individual de administrador.

Finalizar uma nota e gerar todos os movimentos de entrada acontece em uma unica
transacao. Cancelar gera todos os estornos e altera o status na mesma transacao.
Cada movimento recebe uma referencia estavel da nota e do item; repetir a mesma
finalizacao ou cancelamento nao duplica o saldo.

Quantidades e custos sao validados como inteiros seguros, e valores monetarios
continuam em centavos. Somente rascunhos aceitam edicao ou exclusao. Produtos e
fornecedores excluidos ou inativos nao podem ser associados a novos itens.

## Ativacao e reversao

1. Publicar a API com os endpoints `/api/v1/admin/lancamentos`.
2. Definir `NUVEM_API_URL` e `API_LANCAMENTOS_ENABLED=true` no web.
3. Homologar criacao, edicao, finalizacao e cancelamento com uma nota de teste.
4. Para reverter, desligar a chave e reiniciar somente o web.

A chave permanece desligada por padrao. Este bloco nao exige migration e nao
altera o ambiente de producao durante o desenvolvimento.
