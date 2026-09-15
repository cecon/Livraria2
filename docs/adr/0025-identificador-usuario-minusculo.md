# ADR-0025: identificador de usuario em minusculas

## Status

Aceito em 2026-09-15.

## Contexto

O identificador `usuario` era comparado de forma sensivel a maiusculas no
PostgreSQL e no SQLite. Pessoas autenticavam com grafias diferentes das usadas
no cadastro e recebiam erro mesmo com a senha correta. O nome de exibicao nao
tem essa restricao; somente o identificador de acesso e afetado.

## Decisao

Identificadores de usuario sao aparados e convertidos para minusculas em todas
as entradas: login, cadastro, administracao, sincronizacao e persistencia. Os
bancos normalizam registros existentes por migration idempotente. PostgreSQL
usa trigger e constraint para impedir gravacoes futuras fora do padrao.

Antes de alterar dados, cada migration procura contas distintas que resultariam
no mesmo identificador. Se houver colisao, ela interrompe sem modificar dados;
a escolha de qual identidade preservar exige decisao humana.

No SQLite, referencias textuais historicas de pedido e turno sao atualizadas na
mesma transacao. Na nuvem, relacionamentos usam UUID e nao mudam.

## Consequencias

- `Adm`, `ADM` e `adm` autenticam a mesma conta.
- Novos usuarios sao armazenados e exibidos em minusculas.
- Nome pessoal continua preservando maiusculas e acentos.
- Rollout requer executar a verificacao de colisao antes da migration de nuvem.
