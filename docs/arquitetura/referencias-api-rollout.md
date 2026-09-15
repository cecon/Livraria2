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

Builds API/web, 26 testes de integracao API e 20 testes web passaram. O teste
com Next, NestJS e PostgreSQL reais tambem percorre os dois recursos pelo proxy.
Os testes usam triggers reais e simulam falha na reordenacao para conferir
rollback integral.

As telas web usam o caminho legado com `API_REFERENCIAS_ENABLED=false`. Quando
a chave e ligada, fornecedores e formas passam integralmente pelo proxy de mesma
origem, com JWT individual em cookie HTTP-only. Falha de configuracao ou da API
e exibida e nao aciona gravacao silenciosa pelo cliente Supabase. O login passa
a exigir sessao individual da API quando catalogo ou referencias estiver ativo.

O rollout deve ligar a chave apenas depois de publicar API e web compativeis.
Rollback consiste em desliga-la e reiniciar somente o web; os campos legados de
sincronizacao foram mantidos. Nao houve atualizacao de producao nem alteracao do
Docker operacional nesta etapa.
