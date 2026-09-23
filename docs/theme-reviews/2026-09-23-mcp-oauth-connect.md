# Theme Review: conexão MCP OAuth

- Theme reference: `docs/references/theme/app/(dashboard)/input-forms/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `conexão MCP OAuth tema visual WowDash` — ferramenta `memory_recall` indisponível nesta sessão; validação feita por política local, referência do tema e tela existente do Escritório.

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

A tela pública `/ia/conectar` foi restaurada como página do web da nuvem para evitar o loop em que o OAuth voltava para a própria API. A estrutura usa um cartão centralizado com hierarquia curta, campos `Input`, rótulos `Label`, botão primário `Button`, estado de erro com `role="alert"`, foco nativo nos campos e texto curto para explicar o acesso temporário.

A rota continua pública apenas para carregar o formulário do conector; a autorização real exige usuário e senha e envia os parâmetros OAuth para `/api/ia/oauth/authorize`. O teste pelo domínio público confirmou que a página renderiza em vez de retornar 404 ou redirecionar, e que o MCP segue respondendo com desafio OAuth.
