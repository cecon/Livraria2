# Migracoes PostgreSQL do Cloud

Estes arquivos constroem e atualizam o banco oficial. Sao necessarios para instalacoes
novas, atualizacoes e testes; nao sao copias descartaveis.

O migrador em `apps/nuvem/migrator` aplica os arquivos em ordem e verifica checksums.
Preserve os SQL ja registrados. As migracoes adicionais da API estao em
`apps/nuvem/api/sql` e nao sao executadas automaticamente por esse migrador.

Identidades entre sistemas usam UUIDs. O PDV acessa apenas a API autenticada;
nao possui credenciais de acesso direto ao PostgreSQL.
