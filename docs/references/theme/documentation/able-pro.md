# Able Pro 9.2.2 — referencia da retaguarda

Fonte: pacote TypeScript fornecido pelo responsavel em 30/09/2026, pasta seed.
Documentacao indicada pelo fornecedor: https://phoenixcoded.gitbook.io/able-pro
O arquivo documentation.html do pacote e um redirecionamento, nao um manual local.
A consulta ao site nao retornou o manual nesta sessao; os fontes do seed foram consultados diretamente.
Integracao SSR consultada: https://mui.com/material-ui/integrations/nextjs/

## Referencias consultadas

- seed/themes/index.tsx, themes/typography.ts e themes/theme/default.ts: Inter, azul
  primario #4680FF, fundo #F8F9FA; paleta escura do proprio seed.
- seed/layout/Dashboard/index.tsx: Drawer, Header, conteudo responsivo e footer.
- seed/config.ts: menu 280px, modo reduzido 90px e cabecalho 74px.
- seed/components/MainCard.tsx: card com cabecalho, divisor, conteudo e borda.
- seed/themes/overrides/TableCell.ts: tabela com cabecalho e celulas MUI.
- seed/sections/auth/AuthWrapper.tsx e AuthCard.tsx: formulario centralizado.

A aplicacao adapta esses componentes para Next.js, preservando handlers server-side,
cookies e MCP. Nao importar autenticacao JWT de demonstracao, Firebase, Auth0,
Cognito, bancos ficticios ou menus de exemplos do template.

Usar componentes MUI da propria retaguarda. Tailwind permanece somente como
utilitario de disposicao nas telas de negocio; tokens e controles pertencem ao tema
Able Pro. Validar menu recolhido, celular, claro/escuro, foco, formularios,
dialogos, seletores, tabelas, imagens e estados de erro/carregamento/vazio.
