# Deploy da nuvem no Dokploy

Decisao: [ADR-0035](adr/0035-deploy-cloud-dokploy.md).
Skill: [deploy-nuvem-livraria](../.claude/skills/deploy-nuvem-livraria/SKILL.md).
Aplicacao: https://livraria.c3bot.com. Painel: https://livrariapainel.c3bot.com.
Credenciais e IDs: Notion privado, `vmLivraria` → `dockploy livraria`.

Projeto Livraria, servico Livraria-cloud, Compose `apps/nuvem/compose.dokploy.yml`.
O Dokploy clona `https://github.com/cecon/Livraria2.git`, branch `main`.
As imagens continuam sendo construidas no GitHub; o clone fornece o Compose.

O workflow web-images publica web, API e migrador com o mesmo SHA e depois
solicita o deploy pela API do Dokploy. Nao habilitar webhook de push diretamente:
ele pode disparar antes de as imagens estarem prontas.
O Auto Deploy do provedor Git tambem fica desligado. Isso nao desativa o job
GitHub: para suspender novos disparos, usar `DOKPLOY_DEPLOY_ENABLED=false` e
conferir jobs/deploys ja em andamento. Alterar a variavel nao cancela execucao ativa.

Variaveis GitHub: DOKPLOY_URL, DOKPLOY_COMPOSE_ID e
DOKPLOY_DEPLOY_ENABLED=true. Segredo GitHub: DOKPLOY_API_KEY.
O segredo deve ser armazenado somente no ambiente seguro e no Notion privado.
Nao imprimir `compose.one.env`, inspect completo ou respostas contendo credenciais.

No Dokploy: CLOUD_VERSION aponta para o SHA publicado; DATABASE_URL e
MIGRATOR_DATABASE_URL preservam usuarios e permissoes diferentes. API_JWT_SECRET,
LLM_ENCRYPTION_KEY e LLM_ALLOWED_BASE_URLS preservam a configuracao existente.

PostgreSQL permanece no servico Swarm livraria_db e no volume existente.
A rede externa overlay livraria_cloud_internal deve ser attachable; o banco
participa dela com alias livraria-db. O Compose nao cria nem remove banco/volume.
API possui alias `api` nessa rede, exigido pelas rewrites compiladas do Next.
`NUVEM_API_URL` da web aponta para `http://cloud-api:3001`.
O migrador termina antes da API; a web espera a saude da API.
O proxy usa o alias livraria-cloud-web na rede dokploy-network.
`MIGRATOR_SLEEP_SECONDS=0` permite o encerramento do migrador. Healthchecks:
API `/api/v1/health`; web `/api/health`. Nao repetir mudancas de rede do banco a
cada publicacao: atualizar rede do servico Swarm pode reiniciar sua tarefa.
Nao executar `down -v`, fresh volumes, nem o antigo `apps/nuvem/web/stack.yml`
como procedimento de atualizacao. Backup fica em armazenamento protegido, fora do Git.

Validar o resultado na aba Deployments, a saude da API e os fluxos autenticados
afetados. O workflow confirma a solicitacao, nao o fim do deploy.
Para reverter a aplicacao, definir CLOUD_VERSION para o SHA anterior e publicar
novamente. Nao reverter migrations automaticamente; servidor deve permanecer
compativel com migrations aditivas. Publicacao do PDV continua independente.

## Publicacao normal

1. Conferir `origin/main`, trabalho local, testes relevantes, SHA em producao e
   execucoes ativas. Usar checkout isolado se houver alteracoes de outra tarefa.
   Integrar a mudanca a main; codigo apenas local nao sera publicado.
2. O workflow dispara pelos caminhos definidos em `.github/workflows/web-images.yml`.
   Documentacao/skills isoladamente nao exigem imagens. Para publicar manualmente
   a main: `gh workflow run web-images.yml --ref main`.
3. Identificar o run pelo SHA com `gh run list --workflow web-images.yml` e
   acompanhar com `gh run view <run-id>`. `build-push` publica as tres imagens;
   `deploy` solicita a publicacao apenas depois de sucesso.
4. Conferir o registro correspondente em Deployments no Dokploy. Pode estar na
   fila ou falhar depois de o GitHub terminar. Mesmo `composeStatus=done` requer
   conferir saude da web e versoes efetivas.
5. Confirmar saida zero do migrador, SHA das tres imagens, API e web healthy,
   saude publica, login e fluxo afetado. Nao criar transacoes ficticias na loja.

## Publicacao de imagens existentes

`scripts/deploy-dokploy.py` recebe pelo ambiente `DOKPLOY_URL`, `DOKPLOY_API_KEY`,
`DOKPLOY_COMPOSE_ID` e `GITHUB_SHA` completo. Preserva as demais variaveis,
altera `CLOUD_VERSION` e solicita deploy. Nao constroi nem verifica a existencia
das imagens e nao espera o fim da implantacao. Verificar as tres tags antes de
executar manualmente, e nao disputar com outro deploy ou job de publicacao.

O clone busca main, enquanto as imagens usam o SHA do workflow. Alteracoes do
Compose devem ser compativeis com imagens na fila; nao prometer que a configuracao
foi clonada do mesmo commit das imagens.

## Diagnostico e rollback

- Build falhou: conferir etapa e erro; nao publicar mistura de SHAs.
- Solicitacao falhou: conferir HTTPS, chave API, ID e permissao. Senha SSH nao
  autentica no Dokploy. Preservar segredos ao coletar diagnostico.
- Deploy falhou: ler logs do registro correto, migrador e healthchecks. Falha de
  checksum exige investigar, sem editar o registro de migration para forcar sucesso.
- Web com `EAI_AGAIN api`: conferir alias na nova rede; nao apontar para API antiga.
- Saude 200 comprova resposta; 401 sem sessao comprova exigencia de autenticacao,
  nao inclusao/finalizacao de lancamento ou sincronizacao completa.

Antes de rollback, suspender novos disparos e conferir jobs/deploys ativos.
Escolher SHA conhecido, disponivel nas tres imagens e compativel com o schema.
Definir CLOUD_VERSION ou usar o script com GITHUB_SHA anterior, publicar e verificar.
Nao reverter schema nem restaurar backup automaticamente. Reativar a automacao
apos corrigir a causa. Se falhar, preservar dados e evidencias antes de tentar de novo.

## Registro de conclusao

Informar SHA, run GitHub, registro Dokploy, resultado das migrations, saude da API
e web e quais fluxos autenticados foram ou nao verificados. Registrar limitacoes
e versao disponivel para reversao. Nao confundir publicacao Cloud com release PDV.
