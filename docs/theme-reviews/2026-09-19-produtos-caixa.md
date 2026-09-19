# Theme Review: Produtos e caixa atual do PDV

- Theme reference: `docs/references/theme/app/(dashboard)/basic-table/page.tsx`
- Theme reference: `docs/references/theme/app/(dashboard)/calendar/components/add-event.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `Produtos caixa tema visual WowDash`; consulta tentada, integração desabilitada, sem resultados.

## Validacoes

- [x] AgentMemory recall (tentativa; indisponibilidade não bloqueante)
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

Shell e menu atuais preservados. Produtos disponível com caixa fechado. Lista responsiva,
campos rotulados e diálogo com rolagem usam componentes compartilhados. Confirmação inicial
foca Cancelar. Quantidade e carrinho preservados ao cadastrar; navegação conserva pagamentos.
Botão primário usa o token de contraste do tema também em modo escuro.

Validação reproduzível em `apps/pdv/tests/produtos-ui.cjs` com Chromium e IPC simulado:
1440x960 e 390x844, claro/escuro, cancelar/criar/editar/contar e voltar à venda.
Teste separado do fechamento confirma Caixa fechado, seleção de operador ao abrir e ausência
de menu Turno. Credenciais não persistidas. A gravação real foi testada em PostgreSQL isolado.
