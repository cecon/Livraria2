# ADR-0035: Publicação da nuvem pelo Dokploy

Data: 2026-09-27. Status: aceita e implantada inicialmente.
Complementa a [ADR-0034](0034-governanca-pdv-cloud.md).

## Contexto

O GitHub publicava imagens, mas a aplicação era atualizada diretamente no Docker
Swarm da VM. O Dokploy não gerenciava a Livraria. Clonar o repositório, construir
imagens e publicar são etapas diferentes; clone não comprova redução do tempo.

## Decisão

1. Dokploy gerencia web, API e migrador no projeto Livraria, serviço Livraria-cloud.
   Fonte Git: `cecon/Livraria2`, branch `main`, `apps/nuvem/compose.dokploy.yml`.
   O clone fornece o Compose; o workflow `web-images` constrói as imagens no GitHub.
2. Depois das três imagens, o job `deploy` chama `scripts/deploy-dokploy.py`, define
   `CLOUD_VERSION` com o SHA completo e solicita `compose.deploy`. Não usar `latest`
   para escolher produção. Webhook de push e Auto Deploy do provedor Git ficam
   desativados: o gatilho é o job, com `DOKPLOY_DEPLOY_ENABLED=true`.
3. O migrador usa sua conexão administrativa e encerra com código zero antes da
   API iniciar. A web aguarda a saúde da API. Os três componentes usam o mesmo SHA.
   Schema permanece compatível com os clientes instalados; migrations são imutáveis.
4. PostgreSQL permanece no serviço existente `livraria_db`, com o volume atual.
   O Compose não cria banco nem gerencia esse volume. A rede externa
   `livraria_cloud_internal` é attachable; banco tem alias `livraria-db` e API tem
   alias `api`, exigido pelas rewrites compiladas do Next. O proxy acessa o alias
   `livraria-cloud-web` em `dokploy-network`.
5. Segredos ficam no ambiente Dokploy, GitHub Secrets e Notion privado. Senha SSH
   não autentica na API Dokploy. Consultar o Notion para credenciais e IDs; não
   registrar chaves em scripts, ADRs, logs ou skills.
6. Atualizações do PDV permanecem no fluxo próprio. Deploy Cloud não publica
   instalador, altera SQLite do caixa ou exige release do PDV.

## Validação e reversão

Aceite HTTP e job GitHub verde comprovam a solicitação, não o fim da implantação.
Confirmar o registro correspondente em Deployments, migrador com saída zero,
imagens/SHA efetivos, saúde dos serviços e acesso público, conforme o
[procedimento](../deploy-dokploy.md). Mesmo `composeStatus=done` exige conferir
a saúde da web. Testar o fluxo afetado sem criar transações fictícias na loja.

Em falha, preservar logs e dados; corrigir a causa antes de repetir. Reverter
imagens para SHA conhecido e compatível com o schema não desfaz migrations nem
restaura banco. Suspender novos disparos e conferir execuções ativas antes de
fixar versão anterior. Reativar a automação depois de resolver a causa.

## Evidências e limites

- [PR #55](https://github.com/cecon/Livraria2/pull/55): Compose, integração e script.
- [PR #56](https://github.com/cecon/Livraria2/pull/56): alias da API compilado na web.
- Implantação inicial em 27/09/2026: imagens `7d0e182`, migrador com saída zero,
  web/API saudáveis, `/api/health` público 200 e login acessível.
- Rota autenticada de lançamento retornou 401 sem sessão, em vez do antigo 404.
  Isso não comprova inclusão/finalização autenticada na loja.
- Script exercitado contra a API real; Dokploy concluiu a implantação. O
  [run 36319683433](https://github.com/cecon/Livraria2/actions/runs/36319683433)
  publicou as imagens, mas pulou o job deploy: começou antes da habilitação da
  variável. O run seguinte estava em andamento nesta conferência. Verificar o
  resultado atual; configuração não é prova de execução completa.
- Conferência posterior em 27/09/2026: o
  [run 36319746157](https://github.com/cecon/Livraria2/actions/runs/36319746157)
  concluiu build-push e deploy com sucesso. Na VM, as três imagens usam
  `0f446f616f3306e2dbd221f10d375e8b320d542b`; migrador saiu com código zero,
  web/API estão saudáveis e `/api/health` público retornou 200.
- Serviços antigos web/API/migrador do Swarm ficaram com zero réplicas. O banco
  permaneceu ativo no mesmo volume. Não usar o stack antigo para atualizações.

## Consequências

Logs e execução ficam no Dokploy. O build não consome a VM; a transferência de
imagens permanece. O banco segue fora desse Compose. O build usa o SHA do workflow,
mas o clone busca main: não prometer pinagem do Compose ao mesmo commit. Mudanças
do Compose precisam manter compatibilidade durante a fila de publicação.
Runbook e skill de deploy são as instruções operacionais.
