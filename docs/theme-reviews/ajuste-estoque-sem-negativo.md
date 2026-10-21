# Theme Review: ajuste de estoque no cadastro e na Pesquisa (spec 015)

- Theme reference: `docs/references/theme/able-pro/seed/components/MainCard.tsx`
- Documentation: `docs/references/theme/documentation/able-pro.md`
- AgentMemory query: `ajuste estoque cadastro Able Pro formulario` (recall executado via `npm run memory:recall`; integracao desativada nesta maquina, sem resultados)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

Sem mudanca de layout: o ajuste continua no painel "Estoque" (MainCard) do "Alterar livro" e no
detalhe da Pesquisa, com os botoes e campos da propria retaguarda. Mudou o comportamento:
quantidade so inteira exata, "Aplicar"/"Cancelar" desabilitados com o rotulo "Aplicando…" durante
o envio (trava sincrona contra clique duplo) e recusa de saldo negativo exibida no toast de erro
padrao ("O estoque ficaria negativo (atual: N)"), mantendo o formulario aberto e recarregando o
saldo.

Validado localmente (Postgres + API + retaguarda em `next start`) em 1280 px e 375 px, claro e
escuro: painel sem rolagem horizontal no celular (scrollWidth 375), estado desabilitado legivel nos
dois temas, toast visivel acima do conteudo. Acessibilidade: campos com `aria-label` ("Qtd (±)",
"Motivo"), quantidade com `inputMode="numeric"`, botoes `type="button"` (nao disparam o submit do
formulario do livro).
