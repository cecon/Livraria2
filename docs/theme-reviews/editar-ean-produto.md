# Theme Review: edicao do codigo de barras no cadastro de livro

- Theme reference: `docs/references/theme/able-pro/seed/sections/auth/AuthCard.tsx`
- Documentation: `docs/references/theme/documentation/able-pro.md`
- AgentMemory query: `tema PDV SyncStatus status de sincronizacao rodape interface` e recall de cadastro de produto

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

Mudanca minima no formulario existente de `app/cadastro`: o campo "Codigo de barras (EAN/ISBN)"
deixa de ficar desabilitado na edicao e ganha texto de ajuda com o token `muted-foreground`,
o mesmo padrao de texto secundario ja usado na pagina, ligado ao campo por `aria-describedby`.
Nenhum componente ou layout novo.

Como foi verificado: contraste calculado pelos tokens de `app/globals.css` (claro #5B6B79 sobre
#FFFFFF ~5,4:1; escuro #BEC8D0 sobre #1D2630 ~9:1); o paragrafo fica no mesmo bloco do campo,
dentro da coluna `max-w-3xl` ja responsiva, e quebra linha sem largura fixa. Limite: a tela
nao foi renderizada localmente porque exige sessao e API; conferencia visual feita em
producao apos a publicacao.
