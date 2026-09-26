# Migrador do Cloud

Aplica `apps/nuvem/migrations/*.sql` no PostgreSQL indicado por `DATABASE_URL`.
Registra versao e SHA-256 em `public.livraria_schema_migrations`; recusa alteracao
em arquivo ja aplicado. Arquivos SQL existentes nao devem ser editados ou apagados.

A imagem usa o cliente PostgreSQL. Nenhum token de fornecedor externo e necessario.
Credenciais ficam no ambiente seguro. O Compose usa o servico `db`.
As migrations da API em `apps/nuvem/api/sql` possuem fluxo separado; este migrador
nao as aplica. Atualizacoes do servidor devem preceder a distribuicao dos PDVs.
