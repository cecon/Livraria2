# Nuvem Web via API

T016-T019 estao implementadas e continuam opt-in. Nenhuma configuracao ou SQL de
producao foi alterada durante a implementacao.

## Contrato

- GET /api/v1/admin/livros: pagina de 500, cursor UUID after e next=null no fim.
- POST /api/v1/admin/livros: novo UUID fornecido pelo cliente, centavos inteiros.
- PUT /api/v1/admin/livros/:uid: modifica sem alterar UUID; estoque inicial proibido.
- DELETE /api/v1/admin/livros/:uid: exclusao logica com tombstone, preservando historico.

Todas exigem JWT individual de admin, revalidado no banco a cada chamada.
Operador, dispositivo, token expirado e usuario desativado nao escrevem catalogo.
Duplicacao de codigo retorna 409: nao ha fusao automatica de produtos ou estoque.
Criacao e movimento saldo_inicial ficam na mesma transacao, incluindo diario.
Nao usar Prisma Migrate; baseline/triggers existentes continuam sendo autoridade.

## Ativacao de Teste

1. Aplicar baseline e SQL experimental SOMENTE no banco isolado.
2. API: DATABASE_URL, API_JWT_SECRET, API_OPERATIONS_ENABLED=true.
3. Web: `NUVEM_API_URL` apontando a API; usar flags individuais no modo hibrido.
4. Entrar novamente: JWT individual fica no cookie HttpOnly `nuvem_usuario` por 8 horas.
5. Verificar cadastro, pesquisa, renomeacao, preco e exclusao; confirmar diario por PDV.

O proxy Next nunca expoe JWT ao JavaScript e nao aceita mutacao de outra origem.
No proxy reverso, preservar Host e sobrescrever x-forwarded-proto com protocolo real.
Nao publicar a API experimental diretamente na internet via HTTP; usar TLS ou rede privada.
Sessao expirada exige novo login; nao existe refresh de usuario nesta entrega.

## Modo API-only

`API_ONLY_MODE=true` ativa todos os modulos administrativos e autentica somente
pela API NestJS. O middleware valida o JWT individual no banco antes de liberar
cada tela; identidade e troca de senha tambem nao usam Supabase. A sessao web dura
8 horas e deixa de valer imediatamente se o usuario for desativado.

O migrador inclui o schema aditivo da API, mas so o aplica com
`APPLY_API_MIGRATIONS=true`. A imagem `livraria2-nuvem-api` e publicada junto das
imagens web. A ativacao exige `NUVEM_DATABASE_URL` e `API_JWT_SECRET` no host; esses
segredos ficam somente na Memoria do Projeto.

As chamadas de senha usam `extensions.crypt`, conforme o schema real do Supabase.
Hashes SHA-256 legados continuam autenticando e sao convertidos para bcrypt no
primeiro login bem-sucedido pela API.

Para rollback durante a homologacao, voltar `API_ONLY_MODE=false` e manter as
variaveis Supabase. Isso troca o caminho da aplicacao sem desfazer gravacoes validas.
Os fallbacks legados so devem ser removidos depois da janela observada em producao.

Flag e lida em runtime via /api/catalogo/config; navegador memoriza modo por carregamento.
Alterar flag exige reiniciar web e recarregar navegador. Desabilitar volta ao legado;
isso e rollback de codigo, nao desfaz os dados validamente gravados pela API.
Atualizacao de codigo conserva UUID e historico; deletados nao sao recriados por PUT.
Reenvio de criacao com mesmo UUID/codigo retorna conflito, sem repetir estoque inicial.
Uma resposta perdida nao deve ser repetida cegamente: confira o catalogo antes de cadastrar.

## Validacao

Testes mock de cliente/proxy: npm run test:api -w livraria-escritorio.
Build web precisa das variaveis publicas Supabase; placeholders so em testes sem dados reais.
API_TEST_DATABASE=isolated-local habilita testes PostgreSQL protegidos por URL local explicita.
API_WEB_E2E=true adiciona proxy Next real na porta 3004, apos build web.
API_NATIVE_E2E=true inclui Rust real contra API na porta 3003.
Os dois servidores efemeros sao encerrados ao terminar; nao tocam producao.

O modo API-only foi validado em Docker com login normalizado, sessao, identidade,
troca de senha e os dez grupos administrativos contra PostgreSQL isolado. Ainda falta
ativar producao e concluir a janela de observacao antes de encerrar T020.

Em 2026-09-15, uma copia local somente-leitura da origem foi restaurada em PostgreSQL
17. A normalizacao encontrou 11 usuarios, 3 fora do padrao e nenhuma colisao. Depois
das migrations, a API publicou 517 eventos iniciais para 517 produtos e os dez grupos
administrativos responderam HTTP 200. A origem nao foi modificada.

## Ativacao de producao em 2026-09-15

- PR 25 mergeado na `main`; imagens web, migrador e API publicadas com sucesso.
- Watchtower executado manualmente: web e migrador atualizados sem falha.
- `0019_usuario_minusculo` aplicada: 11 usuarios, nenhum fora do padrao.
- Migrations `api_001_protocolo_catalogo` e `api_002_ingestao_vendas` aplicadas.
- API iniciada na rede privada Docker; saude 200 e consulta de autenticacao 401
  controlada confirmaram conexao com o PostgreSQL.
- Web ativada com `API_ONLY_MODE=true`; pagina protegida e dez grupos administrativos
  responderam HTTP 200. Dominio publico respondeu 200 no login e 307 para login sem sessao.
- Chave JWT registrada somente na pagina restrita `API NestJS - producao` no Notion.

Durante a janela de observacao, o rollback continua sendo `API_ONLY_MODE=false` no
container web. Nao remover os fallbacks Supabase antes de confirmar uso real dos
operadores e sincronizacao de pelo menos um PDV.
Limite desta entrega: consulta cliente ate 100 paginas (50 mil produtos), sem truncar silenciosamente.
Em futuras edicoes, concorrencia entre admins ainda segue ultimo commit; nao ha ETag/versionamento.
