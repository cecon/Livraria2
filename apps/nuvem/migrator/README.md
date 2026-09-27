# Migrador da nuvem

Imagem PostgreSQL 16 com bash e coreutils. Executa `run-migrations.sh` usando
DATABASE_URL do ambiente seguro e as migrations oficiais copiadas no build.
Nao requer CLI, conta ou chave de provedor externo.

O Compose Dokploy fornece MIGRATOR_DATABASE_URL como DATABASE_URL e
MIGRATOR_SLEEP_SECONDS=0. O migrador deve terminar com codigo zero antes da API.
A web aguarda a saude da API. A imagem usa o mesmo SHA da web e API.

Checksums impedem alteracao silenciosa de migrations aplicadas. Preservar arquivos
SQL, volume e ledger existentes. Nunca restaurar ou recriar o banco para publicar.
Procedimento: [deploy Dokploy](../../../docs/deploy-dokploy.md).
