---
name: deploy-nuvem-livraria
description: Publicar, verificar ou reverter a nuvem da Livraria pelo Dokploy e diagnosticar a integracao GitHub/GHCR. Use para deploy da web, API e migrador da Livraria; nao para release do PDV.
---

# Deploy da nuvem Livraria

Localize o checkout `cecon/Livraria2` do workspace. Leia, a partir da raiz,
`AGENTS.md`, `docs/adr/0035-deploy-cloud-dokploy.md` e `docs/deploy-dokploy.md`.
Esses arquivos versionados sao a fonte operacional; nao fixe caminho de worktree
ou copie o runbook para esta skill. Se faltarem, consulte a main remota antes de
concluir que o procedimento nao existe.

## Fluxo

- Execute dentro do pedido autorizado. Pedido de deploy autoriza sua execucao;
  consulta de status ou documentacao nao autoriza nova publicacao. Nao pedir
  novamente autorizacao ja concedida na sessao.
- Confira branch, trabalho local, SHA publicado e execucoes em andamento. Preserve
  alteracoes de outras tarefas; use checkout isolado quando necessario.
- GitHub constroi tres imagens com o mesmo SHA. Dokploy clona main para obter
  `apps/nuvem/compose.dokploy.yml` e usa essas imagens; nao faz build na VM.
- O job `deploy` de `web-images` chama `scripts/deploy-dokploy.py` depois de
  `build-push`. Auto Deploy Git permanece desligado; nao criar webhook de push
  concorrente. Confira `DOKPLOY_DEPLOY_ENABLED` no GitHub.
- Para imagens existentes, use o script com os valores de ambiente do runbook.
  Verifique as tres tags antes. Nunca usar `latest` ou anunciar commit apenas local.
- PostgreSQL existente fica fora do Compose. Preserve volume, usuarios, permissoes
  e segredos; nao crie outro banco para completar um formulario do painel.
- Migrador termina antes da API; web aguarda API saudavel. Preserve o alias `api`
  exigido pelas rewrites compiladas e `livraria-cloud-web` usado pelo proxy.
- Credenciais e IDs ficam no Notion privado, `vmLivraria` → `dockploy livraria`.
  Nao gravar credenciais nesta skill, Git ou logs. Filtre respostas/inspect para
  mostrar somente status, nomes e revisoes. SSH e API Dokploy sao acessos distintos.

## Verificacao e recuperacao

Aceite HTTP e GitHub verde confirmam solicitacao. Acompanhe o registro correto no
Dokploy, saida zero do migrador, imagens/SHA e saude efetivos da API e web. Confirme
a URL publica e o fluxo afetado com acesso autorizado. Nao use transacoes ficticias
na loja; explique quando apenas saude e autenticacao foram verificadas.

Se falhar, preserve diagnostico e dados. Investigue antes de repetir; se depender
de credencial ou decisao ausente, informe o bloqueio concreto. Em rollback
autorizado, suspenda novos disparos, confira execucoes ativas e siga o runbook com
SHA conhecido e compativel com o schema. Nao restaurar banco ou desfazer migrations
automaticamente. Nao alterar o updater do PDV.

Conclua com SHA, resultado real e limites. Nao declarar automacao comprovada apenas
porque o gatilho foi configurado: diferencie configuracao, aceite e implantacao.
