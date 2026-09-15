# Baseline de adocao do ORM

Conferencia somente leitura em 2026-09-14:

- Introspeccao real: 17 modelos, preservando nomes e tipos.
- Livro: 14 colunas confirmadas, preco em bigint de centavos.
- 9 gatilhos e 16 politicas encontrados pelo information_schema/pg_policies.
- Ledger existente: 18 entradas e 18 arquivos SQL reconciliados.
  0014_turno_maquina e 0015_turno_padrao_backfill estavam ausentes da main e foram
  recuperados do migrator instalado, conferindo seus hashes com o ledger.
  Nenhuma divergencia de hash apos reconhecer LF/CRLF.

## Autoridade de migrations

O ledger livraria_schema_migrations e o SQL historico continuam como baseline.
Prisma e usado como ORM sobre banco existente, sem Prisma Migrate neste marco.
Isso evita reconstruir ou perder views, gatilhos, RLS e constraints que Prisma
nao representa integralmente. Nenhuma migration foi marcada/aplicada na producao.
db:baseline:check apenas verifica arquivos e ledger.

Schemas experimentais ficam em api/sql, fora do migrator automatico. Sua aplicacao
foi testada somente no PostgreSQL isolado. Antes da ativacao: revisar privilegios
da credencial dedicada da API e politicas, ensaiar rollback e integrar o adapter PDV.

Nao executar db push, migrate reset ou marcar migrations como aplicadas para
resolver divergencias. A introspeccao gera apenas schema, nunca dados ou senhas.
Campo senha_hash e ignorado pelo Prisma Client; autenticacao usa verificacao crypt
parametrizada e nunca devolve hashes.
