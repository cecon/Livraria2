# Theme Review: relatorio de estoque

- Theme reference: `docs/references/theme/components/table/stock-report-table.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `relatorio de estoque tabela WowDash ordenacao PDF Excel WhatsApp` (recall executado; integracao desativada nesta sessao)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

O relatorio usa a tabela e os botoes compartilhados de WowDash, com cabecalhos
ordenaveis, paginacao e linhas densas. No celular, codigo, categoria e preco sao
mostrados sob o titulo para evitar rolagem horizontal. Os botoes geram PDF e XLSX
na API protegida pela sessao; o compartilhamento envia o PDF pelo menu nativo
quando disponivel e baixa o arquivo como alternativa. Foram conferidos foco,
rotulos de botao, estados vazio e escuro e ausencia de overflow no celular.
