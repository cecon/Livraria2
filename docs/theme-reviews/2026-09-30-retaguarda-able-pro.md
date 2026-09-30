# Theme Review: retaguarda completa Able Pro

- Theme reference: `docs/references/theme/able-pro/seed/layout/Dashboard/index.tsx`
- Documentation: `docs/references/theme/documentation/able-pro.md`
- AgentMemory query: `tema retaguarda UI Able Pro migracao telas autenticacao catalogo estoque lancamentos`

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

Pedido explícito do responsável em 30/09/2026 substitui a referência visual do
Cloud pelo seed Able Pro TypeScript 9.2.2 fornecido. Fontes reais consultados:
Dashboard, MainCard, AuthWrapper/AuthCard, paleta, tipografia e overrides de tabela.
Guia do fornecedor no pacote era um redirecionamento; não alegamos acesso ao
manual completo remoto. Integração de cache SSR conferida na documentação MUI.

Retaguarda movida para `apps/nuvem/retaguarda`, com interface MUI própria e URLs
preservadas. Menu 280px/90px, cabeçalho 74px, Inter e paleta do seed. Dados,
autenticação e regras permanecem da Livraria; nenhuma integração de demonstração.
Tons da paleta foram ajustados em textos/ações para contraste. PDV não foi alterado.

## Evidencias

`tests/browser-layout.cjs` percorreu as 14 telas principais em 1440px/390px e nos
dois temas, usando as imagens Docker compiladas contra PostgreSQL isolado:
56 combinações sem erros JavaScript/HTTP, sem overflow da página e sem violações
detectadas pelo Axe para WCAG A/AA. Isso não substitui avaliação humana completa.
Menu móvel/Escape, menu recolhido, alternância de tema e seletores foram exercitados.

`tests/browser-flows.cjs` verificou formulários, envio/renderização real de capa,
livro novo sem saldo, ativação com saldo zero, desativação, ativação confirmada ao
adicionar ao lançamento, entrada de 30 unidades a R$ 10, saldo 30, inventário,
fornecedor, diálogo LLM e cadastro de máquina em desktop/celular.
`tests/browser-admin.cjs` verificou login, usuários, formas, destinações, PDF/XLSX,
logout e proteção do MCP. Não foram usados dados nem transações reais da loja.

Screenshots e relatório `accessibility.json` ficam na pasta local de evidências
`able-pro`, configurada por `UI_TEST_OUTPUT`; a rotina é reproduzível conforme
`docs/retaguarda-able-pro.md`. Inspeção visual incluiu painel claro/escuro,
login, listagem de livros e lançamento no celular. Testes funcionais não comprovam
instalação em produção: conferir o deploy separadamente antes de anunciá-lo.
