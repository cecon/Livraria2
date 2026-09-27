# Migrations PostgreSQL da nuvem

Esta pasta e o historico oficial aplicado pelo migrador no deploy Dokploy.
Cada arquivo possui checksum registrado em `livraria_schema_migrations`.
Nao editar SQL ja aplicado: mudancas exigem nova migration numerada.

O runner aplica arquivos em ordem, recusa divergencias de checksum e preserva
os registros anteriores. As roles de compatibilidade das migrations historicas
nao habilitam nenhum servico externo. PostgreSQL permanece no volume existente.

`apps/nuvem/api/sql` contem fixtures/bootstrap usados nos testes isolados;
nao e um segundo historico aplicado automaticamente em producao.

Ver [deploy](../../../docs/deploy-dokploy.md) e [migrador](../migrator/README.md).
