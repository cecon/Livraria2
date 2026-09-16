# Theme Review: Shell e painel inicial do PDV

- Theme reference: `docs/references/theme/app/client-root.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `tela inicial PDV shell navegacao tema visual WowDash` (servico desativado
  nesta sessao; referencias locais prevaleceram conforme a politica)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

O PDV passou a usar a composicao do dashboard WowDash: sidebar com cabecalho e grupo de
navegacao, header superior com gatilho do menu e busca, fundo neutro, breadcrumb e cards com
hierarquia visual. A navegacao vira drawer com overlay no smartphone e pode ser recolhida no
desktop. Os componentes compartilhados, tokens verdes da Livraria, dados locais, sincronizacao e
selecao de operador foram preservados. Botoes de icone receberam nome acessivel, estados de foco
continuam nativos e os contrastes foram conferidos nos modos claro e escuro.

Tambem foram consultados `docs/references/theme/components/app-sidebar.tsx`,
`docs/references/theme/components/layout/header.tsx` e
`docs/references/theme/components/layout/dashboard-breadcrumb.tsx`.
