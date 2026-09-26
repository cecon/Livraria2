# API do Cloud

Servidor NestJS com PostgreSQL, autenticacao de usuarios e dispositivos, permissoes,
catalogo, estoque oficial, vendas, turnos e relatorios. A web e o PDV usam esta API.

Na raiz: `npm run dev:api` e `npm run build:api`. Saude: `/api/v1/health`.
Operacoes exigem `API_OPERATIONS_ENABLED=true`, `DATABASE_URL` e `API_JWT_SECRET`
com pelo menos 32 bytes. Credenciais somente no ambiente seguro.

Usuarios recebem JWT individual. Dispositivos recebem credencial propria, revogavel.
A API valida identidade e perfil; ter acesso ao PDV nao concede administracao.

Catalogo usa paginas com sequencia e confirmacao apos commit local. Vendas chegam
com itens e pagamentos completos e sao aplicadas em transacao, com recibo idempotente.
`GET /api/v1/sync/referencias/:resource` entrega operadores, formas e destinacoes
somente a dispositivos autenticados. Hashes para verificacao offline nao sao publicos.

SQL existente e preservado por checksum. `db:validate`, `db:generate` e
`db:baseline:check` nao alteram dados. Nao executar reset/db push sobre o banco oficial.

`test:integration` exige `API_TEST_DATABASE=isolated-local` e um PostgreSQL descartavel:
porta 55439/container `livraria-separacao-db` ou porta 55440/container
`livraria-limpeza-test`, sempre em 127.0.0.1, banco `livraria_test`.
Para o segundo, definir `API_TEST_CONTAINER=livraria-limpeza-test`.
Os testes recriam o schema desse banco isolado.
