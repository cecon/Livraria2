# Retaguarda web do Cloud

Next.js com acesso aos dados exclusivamente pela API NestJS da nuvem.
NUVEM_API_URL e configuracao do servidor; tokens de pessoas e dispositivos
sao encaminhados somente aos endpoints autorizados. O navegador nao recebe
credencial do banco nem SDK de acesso direto a ele.

Na raiz: `npm ci`, `npm run dev -w livraria-escritorio`,
`npm run test:api -w livraria-escritorio` e `npm run build -w livraria-escritorio`.

Interfaces seguem `docs/ui-theme-policy.md`. Imagens seguem ADR-0038, com upload
pela API e arquivos no PostgreSQL; a remocao de integracoes antigas nao muda esse contrato.

A publicacao usa imagens por SHA no Dokploy. Nao usar a stack antiga como deploy.
Ver [runbook oficial](../../../docs/deploy-dokploy.md).
