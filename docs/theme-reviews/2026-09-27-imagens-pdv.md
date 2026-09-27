# Theme Review: imagens no PDV

- Theme reference: `docs/references/theme/app/(dashboard)/input-forms/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `tema visual WowDash imagens cadastro pesquisa venda PDV retaguarda`

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

Referência local mínima com placeholders; preservado visual existente sem
alegar fidelidade integral ao tema. Campo de upload pertence ao PDV, com rótulo,
texto alternativo, erro anunciado e estado ocupado. Imagens usam object-contain
e fallback. Pesquisa recebe labels associados e coluna única no celular.

Playwright/Chromium com IPC simulado em 1440x900 e 390x900, claro/escuro:
listagem, envio, remoção, arquivo inválido, salvar com capa, venda e pesquisa.
Capturas inspecionadas e imagem decodificada, sem transbordamento do documento.
Tabela da venda conserva rolagem horizontal própria. Testes Rust independentes
verificam persistência real do cache SQLite e retomada após erro de rede.
Histórico e relatórios conferidos por build/análise estática, sem simular uma
venda real na loja. Capturas locais `imagens/pdv-*` nas visualizações da tarefa.
