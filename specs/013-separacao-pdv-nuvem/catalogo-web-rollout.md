# Catalogo Web via API

T016 e experimental e opt-in. Nenhuma configuracao/SQL de producao foi alterada.

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
3. Web: NUVEM_API_URL apontando a API; API_CATALOGO_ENABLED=true em runtime.
4. Entrar novamente: JWT individual fica no cookie HttpOnly nuvem_usuario, 15 minutos.
5. Verificar cadastro, pesquisa, renomeacao, preco e exclusao; confirmar diario por PDV.

O proxy Next nunca expoe JWT ao JavaScript e nao aceita mutacao de outra origem.
No proxy reverso, preservar Host e sobrescrever x-forwarded-proto com protocolo real.
Nao publicar a API experimental diretamente na internet via HTTP; usar TLS ou rede privada.
Sessao expirada exige novo login; nao existe refresh de usuario nesta entrega.

Modo permanece HIBRIDO: login tambem abre sessao legado para saldo, inventario,
notas, formas, operadores e demais fluxos ainda nao migrados (T017).
Nao remover configuracao Supabase/conta de servico enquanto esses fluxos a exigirem.
API habilitada indisponivel resulta em erro controlado, nunca escrita legado alternativa.

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

Login completo com Supabase real, navegador autenticado e proxy publico ainda precisam
de homologacao antes de T020. Teste do proxy usa JWT individual emitido pela API real.
Limite desta entrega: consulta cliente ate 100 paginas (50 mil produtos), sem truncar silenciosamente.
Em futuras edicoes, concorrencia entre admins ainda segue ultimo commit; nao ha ETag/versionamento.
