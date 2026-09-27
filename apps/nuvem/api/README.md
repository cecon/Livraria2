# API da nuvem

API NestJS/Prisma em producao, parte do Cloud. PostgreSQL e o banco oficial.
Web e PDV usam somente a API autenticada; nao ha acesso externo direto ao banco.

## Desenvolvimento e verificacao

Na raiz: `npm ci`, `npm run db:generate -w @livraria/nuvem-api`,
`npm run build:api`. Configurar DATABASE_URL e API_JWT_SECRET no ambiente seguro.
`npm run dev -w @livraria/nuvem-api` inicia a API. Nao versionar segredos.

`npm run test:integration -w @livraria/nuvem-api` exige API_TEST_DATABASE=isolated-local
 e DATABASE_URL apontando exclusivamente para 127.0.0.1:55439/livraria_test.
Os testes recriam o schema; nunca executar contra o banco da loja.

## Contratos

Prefixo `/api/v1`. Saude: `/health`. Pessoas autenticam em `/auth/login`;
PDVs possuem tokens proprios com renovacao. O servidor verifica identidade,
atividade e perfil nas operacoes protegidas.

`/sync/catalogo` entrega o catalogo incremental. `/sync/referencias/:resource`
entrega usuario, forma_pagamento ou destinacao em paginas de ate 500 registros,
com `after` UUID e `proximo`. Exige dispositivo ativo; nunca registrar o corpo,
que inclui hashes necessarios a autenticacao offline. Vendas completas usam
recibos idempotentes; nao enviar itens de uma venda como fatos independentes.

Imagens seguem ADR-0038. Deploy e migrations: [runbook](../../../docs/deploy-dokploy.md).
