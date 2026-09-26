# Atualizacao do PDV

1. Atualizar e validar primeiro a API, incluindo `/sync/referencias/:resource`.
2. Provisionar a maquina pela retaguarda, com credencial propria.
3. Instalar o PDV e validar recebimento de catalogo, operadores, formas e destinacoes.
4. Testar venda offline, reconexao, recibo e estoque sem duplicacao.

O PDV usa exclusivamente a API. Paginas sao aplicadas atomicamente. Vendas e
cancelamentos possuem reenvio idempotente. Nao existe modo hibrido de sincronizacao.
Nao reutilizar o cursor de um dispositivo antigo em um SQLite vazio.
Credenciais e dados operacionais nunca sao armazenados neste repositorio.
