# Theme Review - Maquinas PDV

- Theme reference: `docs/references/theme/app/(dashboard)/users-list/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `nomenclatura navegacao maquinas PDV WowDash Livraria`

## Evidencias obrigatorias

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptação

A nomenclatura da rota de dispositivos foi alterada de Caixas para Máquinas no menu e no cabeçalho.
A gestão segue a referência `users-list`: breadcrumb, ação primária no cabeçalho, painel de formulário
e listagem administrativa com ações por ícones. Em telas pequenas, a tabela mantém apenas nome,
operador, situação e ações essenciais sem largura mínima que force a página a transbordar.

As credenciais são apresentadas em um painel próprio somente após cadastro, troca de operador ou
renovação. O token não é persistido no navegador. Foram previstos estados claro/escuro, títulos nos
botões de ícone e mensagens sem depender apenas de cor.
