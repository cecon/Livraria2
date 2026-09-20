# Theme Review: Cadastro LLM e configurações do PDV

- Theme reference: `docs/references/theme/app/(dashboard)/users-list/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `cadastro LLM autenticacao maquina usuario turno tema visual WowDash`

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

AgentMemory retornou desabilitado; referência local consultada.

## Adaptacao

Retaguarda reutiliza ContentPanel, PageHeader e componentes compartilhados de
formulário/diálogo. Cabeçalho do card agrupa busca e cadastro, linhas com ações
responsivas. Diálogo Radix mantém foco e labels associados; status/erros são anunciados.
PDV utiliza Card WowDash na tela Configurações, com consulta e teste sem nova senha.

Playwright em navegador com backend simulado: cadastro Google, teste, edição sem
reexibir chave, layouts 1280x900 e 390x844, claro/escuro, sem overflow horizontal.
Consulta e teste no PDV validados nas mesmas quatro combinações. Integração real da
API validada separadamente em PostgreSQL isolado com provedor simulado.
