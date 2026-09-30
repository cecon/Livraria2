# ADR-0040: Retaguarda baseada no seed Able Pro

Data: 2026-09-30. Status: aceita por pedido explicito do responsavel.
Substitui a referencia WowDash somente para a retaguarda. PDV permanece separado.

## Decisao

Migrar a retaguarda para apps/nuvem/retaguarda, em pasta propria, usando o seed
TypeScript Able Pro 9.2.2 fornecido pelo responsavel. Adaptar a base visual MUI ao
Next.js existente: a versao Vite do seed nao substitui o servidor de cookies,
proxies autenticados, handlers de imagens e OAuth/MCP.

Paleta e tipografia provem dos arquivos reais do seed. Layout, navegacao, cards,
formularios, tabelas e dialogos usam MUI e componentes locais. A retaguarda deixa
de consumir o pacote de interface do PDV. Nao copiar autenticacao ou dados demo.
MUI 5.18 e usado dentro da mesma versao principal do seed, com suporte a React 19;
o cache SSR segue a integracao oficial para Next 15.

Migrar todas as rotas, clientes API, validacoes e operacoes existentes. Preservar
URLs publicas, contratos, centavos, identidade, imagens, permissoes e estoque.
A pasta anterior e retirada; workspace, Docker, CI, testes e runbooks passam a
usar o caminho novo. Existe um unico frontend de producao do Cloud.

## Validacao

Inventario de rotas e cenarios em docs/retaguarda-able-pro.md. Testes de contrato
API e proxies, build, navegacao real, operacoes em PostgreSQL isolado e revisao
visual desktop/celular/claro/escuro sao necessarios antes da publicacao.
Nao criar transacoes ficticias na loja para testar a interface. Publicacao segue
Dokploy, com verificacao da imagem, migrador, saude e MCP. Mudancas visuais nao
exigem alterar o PDV nem o banco oficial.
