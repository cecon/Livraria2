# Referencias administrativas: etapa API

Endpoints experimentais NestJS, sob `/api/v1/admin`:

| Recurso | Operacoes |
| --- | --- |
| `fornecedores` | GET paginado, POST, PUT `/:uid`, DELETE `/:uid` |
| `formas` | GET paginado, POST, PUT `/:uid`, DELETE `/:uid` |
| `formas/:uid/ativa` | PUT `{ "ativa": true }` |
| `formas/reordenar` | PUT `{ "uids": ["UUID"] }` |

Todas as operacoes exigem JWT de usuario administrador individual. Tokens
de dispositivo nao podem administrar referencias. POST recebe `sync_uid`
gerado pelo cliente. PUT preserva identidade e nao restaura registros excluidos.
GET retorna `{ items, next }`, com paginas de ate 500 e cursor UUID `after`.

Fornecedores usam nome normalizado unico. Exclusoes sao logicas para preservar
referencias historicas, repetiveis e removem o registro das listagens ativas.
As formas preservam `chave` e `de_sistema`; formas de sistema podem ser
renomeadas, mas nao desativadas nem excluidas. Clientes nao podem criar formas
de sistema. A reordenacao exige todos os UUIDs nao excluidos, sem repeticao,
com limite de 500 formas. Lista incompleta retorna conflito, exigindo recarga.

As mutacoes de formas usam transacao com bloqueio da tabela para proteger
a composicao da lista. Uma falha desfaz toda a reordenacao. Esse bloqueio e
adequado a cadastros pequenos, mas nao deve ser reutilizado para catalogo ou
vendas de alto volume.

Nao ha nova migration nesta etapa: os modelos Prisma existentes preservam
schema, constraints e relacionamentos. Campos de sincronizacao legados sao
mantidos, mas ainda nao existe diario API de referencias nem confirmacao por
PDV. Nao afirmar que estes cadastros ja foram entregues ao caixa pelo protocolo
novo; a sincronizacao desses dados continua hibrida.

## Validacao e proxima etapa

Build API e 26 testes de integracao passaram em PostgreSQL local isolado,
incluindo os seis cenarios de referencias. Os testes usam triggers reais e
simulam falha na reordenacao para conferir rollback integral.

As telas web continuam no caminho legado nesta entrega. T017b deve introduzir
chave experimental independente, proxy de mesma origem com cookie HTTP-only,
tratamento de erros nas telas e testes web/API antes de qualquer ativacao.
Nao houve atualizacao de producao nem alteracao do Docker operacional.
