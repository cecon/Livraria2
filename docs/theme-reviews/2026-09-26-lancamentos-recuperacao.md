# Theme Review: carregamento de lancamentos

- Theme reference: `docs/references/theme/app/(dashboard)/input-forms/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `tema visual WowDash lancamentos erro carregamento rotas Next` (servico disabled)

## Validacoes

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Adaptacao

A referencia versionada contem apenas placeholders. Foram preservados os componentes
PageHeader, ContentPanel e Button da aplicacao e o padrao existente de erro da tela LLM.
O editor agora apresenta carregamento, erro e tentativa novamente, em vez de retornar null.
Teste de navegador com respostas simuladas verificou 404, mensagem acessivel, nova tentativa
e abertura do rascunho nos quatro cenarios, sem excecoes e sem overflow horizontal.

## Roteamento e publicacao

O encaminhamento generico passou de afterFiles para fallback para preservar os handlers
dinamicos autenticados. 52 testes passaram. A versao de producao foi compilada na VM
sobre a base ja publicada (7187eaa), incluindo apenas os ajustes de rota e carregamento.
Imagem: livraria-escritorio:fix-routes-20260926. Atualizacao concluida em 26/09/2026 16:48 UTC.
A consulta publica sem sessao ao detalhe voltou a retornar 401 com mensagem do proxy,
em vez de 404 por rota ausente. Nenhuma nota foi criada ou finalizada para testar.

## Confirmacao de titulo inativo

Ao adicionar um titulo inativo, confirmacao nativa pergunta se deve ativa-lo e inclui-lo.
Cancelar nao envia a inclusao; confirmar envia `reativar: true`. Erros preservam os campos
e sao apresentados via toast. Usa o mesmo mecanismo de confirmacao ja adotado para excluir
e cancelar notas. Chromium validou cancelar/confirmar nos quatro cenarios de tela/tema.
53 testes web e 43 testes com PostgreSQL isolado passaram, incluindo permissao administrativa,
recusa sem consentimento, rollback da ativacao se a inclusao falha e entrada idempotente.
A ativacao explicita no lancamento pode ocorrer antes de haver estoque positivo; isso permite
preparar o rascunho de entrada conforme a solicitacao do usuario. Finalizacao continua explicita.

Detalhes: memoria consultada, servico indisponivel; Chromium em 1280px e 390px;
acessibilidade verificada por alert/status, botoes nomeados e navegacao de retorno.
