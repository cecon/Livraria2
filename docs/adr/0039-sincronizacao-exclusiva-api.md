# ADR-0039: Sincronizacao exclusivamente pela API

Data: 2026-09-27. Status: aceita por solicitacao do responsavel.
Complementa ADR-0032. Substitui o transporte e configuracao historicos da ADR-0015.

## Decisao

PDV recebe catalogo, usuarios, formas de pagamento e destinacoes exclusivamente
pela API da nuvem. Referencias exigem token de dispositivo ativo e usam paginacao
por UUID, sem cursor temporal. Cada pagina e aplicada em transacao no SQLite.
Nova tentativa consulta novamente as referencias e nao cria pendencias de envio.
IDs locais de referencias existentes sao preservados para manter relacionamentos.
Hashes de usuario servem a autenticacao offline e nao podem aparecer em logs/cache HTTP.

Remover sincronizador antigo, seed, leitura de sync.json, proxy externo, CLI do
migrador e conexao MCP descontinuada. Credenciais individuais da maquina continuam
em machine.json; a API permanece responsavel pela autorizacao.

Vendas, pagamentos, itens, turnos e caixa preservam o protocolo e os recibos da API.
Falha nunca apaga pendencias nem reenvia dados por outro provedor.
Imagens e cache offline permanecem conforme ADR-0038. SQL aplicado e imutavel.

## Publicacao e verificacao

Publicar e validar o endpoint na nuvem antes do cliente que depende dele.
Executar testes de autenticacao, paginacao, aplicacao atomica e reenvio de vendas.
Verificar imagem efetiva no Dokploy e release assinada do PDV separadamente.
A disponibilidade de uma release nao comprova sua instalacao em todas as maquinas.

Os planos 007 a 012 descreviam o transporte descontinuado e foram retirados;
o historico permanece no Git. Vetores de conformidade foram preservados junto
aos testes de dominio. A separacao restante de componentes de UI e outro trabalho.
