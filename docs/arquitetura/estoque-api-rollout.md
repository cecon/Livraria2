# Estoque administrativo via API

`API_ESTOQUE_ENABLED=false` mantem saldos, extratos, ajustes, inventario e
divergencias no caminho legado durante a transicao. Com a chave ligada, o web
usa somente o proxy de mesma origem e o JWT individual do administrador.

Endpoints NestJS em `/api/v1/admin/estoque`:

| Endpoint | Operacao |
| --- | --- |
| `/saldos` | GET dos saldos derivados |
| `/livros/:uid/movimentos` | GET do extrato completo |
| `/ajustes` | POST de ajuste avulso |
| `/contagens` | POST atomico do lote do inventario |
| `/divergencias` | GET das divergencias abertas |
| `/divergencias/:uid` | PUT para resolver ou ignorar |

Quantidades e custos trafegam como inteiros seguros; custos continuam em
centavos. Contagens validam todos os produtos antes de gravar e usam uma unica
transacao. UUIDs de movimento repetidos com o mesmo conteudo sao aceitos sem
duplicar estoque; reutilizacao com conteudo diferente retorna conflito.

As mutacoes exigem administrador individual. O proxy recusa origem externa,
rotas fora da lista e corpos excessivos, e nao repassa detalhes internos da API.
Falha de configuracao nao ativa o caminho legado silenciosamente.

## Ativacao e reversao

1. Publicar e validar primeiro a API NestJS compativel.
2. Definir `NUVEM_API_URL` e `API_ESTOQUE_ENABLED=true` somente no web.
3. Conferir saldo, extrato, ajuste, inventario e divergencias com um usuario de teste.
4. Para reverter, definir `API_ESTOQUE_ENABLED=false` e reiniciar somente o web.

Nenhuma migration nova e necessaria neste bloco. A chave permanece desligada
por padrao e nao deve ser habilitada em producao antes da homologacao conjunta.
