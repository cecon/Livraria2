# Theme Review: monitoramento online e catalogo inativo

- Theme reference: `docs/references/theme/components/table/recent-orders-table.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `monitoramento de vendas e turnos, catalogo inativo tema visual WowDash` (ferramenta indisponivel; consultadas as referencias locais)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

As listas de vendas e turnos reutilizam os componentes de tabela e botao WowDash em
`packages/ui`, com dados reais dos PDVs, atualização automatica e colunas ajustadas para
celular. O cadastro conserva o padrao de tabela, formulario e navegacao existente e
separa ativos de inativos. Foram verificados contraste, rótulos de controles, estado
vazio e ausencia de rolagem horizontal no celular. A indisponibilidade do AgentMemory
nao substituiu a consulta da documentacao e dos componentes locais do tema.
