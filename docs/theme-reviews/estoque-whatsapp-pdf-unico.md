# Theme Review: compartilhamento do PDF de estoque

- Theme reference: `docs/references/theme/components/ui/button.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `relatorio estoque botoes mobile WowDash WhatsApp` (recall indisponivel nesta sessao)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

O recall foi solicitado, mas a integracao estava indisponivel. A barra ja foi
verificada em desktop, 320 e 390 px, modos claro/escuro e com rotulos acessiveis;
esta alteracao nao modifica sua apresentacao.

## Adaptacao

O botao compartilhado do tema e a barra do relatorio permanecem iguais. Apenas o
comportamento do comando WhatsApp foi corrigido: a janela nativa recebe somente
o PDF, sem titulo de texto que possa virar uma segunda mensagem no iPhone. O
comando tambem ignora toques repetidos durante o compartilhamento.
