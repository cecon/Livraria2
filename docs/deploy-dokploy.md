# Deploy da nuvem no Dokploy

Projeto Livraria, servico Livraria-cloud, Compose `apps/nuvem/compose.dokploy.yml`.
O Dokploy clona `https://github.com/cecon/Livraria2.git`, branch `main`.
As imagens continuam sendo construidas no GitHub; o clone fornece o Compose.

O workflow web-images publica web, API e migrador com o mesmo SHA e depois
solicita o deploy pela API do Dokploy. Nao habilitar webhook de push diretamente:
ele pode disparar antes de as imagens estarem prontas.

Variaveis GitHub: DOKPLOY_URL, DOKPLOY_COMPOSE_ID e
DOKPLOY_DEPLOY_ENABLED=true. Segredo GitHub: DOKPLOY_API_KEY.
O segredo deve ser armazenado somente no ambiente seguro e no Notion privado.

No Dokploy: CLOUD_VERSION aponta para o SHA publicado; DATABASE_URL e
MIGRATOR_DATABASE_URL preservam usuarios e permissoes diferentes. API_JWT_SECRET,
LLM_ENCRYPTION_KEY e LLM_ALLOWED_BASE_URLS preservam a configuracao existente.

PostgreSQL permanece no servico Swarm livraria_db e no volume existente.
A rede externa overlay livraria_cloud_internal deve ser attachable; o banco
participa dela com alias livraria-db. O Compose nao cria nem remove banco/volume.
O migrador termina antes da API; a web espera a saude da API.
O proxy usa o alias livraria-cloud-web na rede dokploy-network.

Validar o resultado na aba Deployments, a saude da API e os fluxos autenticados
afetados. O workflow confirma a solicitacao, nao o fim do deploy.
Para reverter a aplicacao, definir CLOUD_VERSION para o SHA anterior e publicar
novamente. Nao reverter migrations automaticamente; servidor deve permanecer
compativel com migrations aditivas. Publicacao do PDV continua independente.
