# Theme Review - Recuperacao de falha de carregamento

- Theme reference: `docs/references/theme/components/layout/dashboard-breadcrumb.tsx`
- Theme reference: `docs/references/theme/app/(dashboard)/users-list/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `estado de erro recuperavel WowDash Livraria`

## Evidencias obrigatorias

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

Os estados de falha de Venda, Turnos e Inventario usam o painel administrativo, as cores semanticas e o componente de botao
compartilhado. O aviso possui `role="alert"`, texto persistente e comando explicito para repetir o
carregamento. A composicao permanece em uma coluna e respeita a largura do smartphone.

Falhas transitorias de leitura sao repetidas automaticamente. Sessao expirada limpa o cookie local,
abre o login e preserva a rota de origem para retorno apos a autenticacao.
Se a indisponibilidade durar mais que as tentativas imediatas, o painel repete o carregamento a cada
cinco segundos e informa a contagem regressiva com uma regiao acessivel.
