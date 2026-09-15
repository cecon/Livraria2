# Theme Review - Configuracao inicial da maquina no PDV

- Theme reference: `docs/references/theme/app/auth/login/page.tsx`
- Theme reference: `docs/references/theme/components/auth/login-form.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `configuracao inicial maquina PDV tema visual WowDash` (servico indisponivel nesta sessao)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

O primeiro acesso do Tauri segue a composicao de autenticacao do WowDash: painel institucional em
telas largas, formulario contido e centralizado, campos altos, acao primaria integral e alternancia
de tema. No smartphone o painel lateral desaparece e a identidade visual passa para o cabecalho do
formulario. Foram reutilizados os componentes de `packages/ui`, os tokens compartilhados e icones
Lucide. A senha administrativa existe apenas durante a requisicao e a credencial da maquina fica no
cofre nativo do sistema operacional.

O AgentMemory nao estava disponivel nesta sessao; conforme a politica, prevaleceram a documentacao
local, os componentes do tema e os ADRs aceitos. A validacao visual usou 1440x900, 390x844 e ambos
os temas, sem overflow horizontal.
