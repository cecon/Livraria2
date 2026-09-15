# Politica de Uso do Tema

Decisoes arquiteturais: [ADR-0026](adr/0026-tema-wowdash-referencia-visual-obrigatoria.md) e
[ADR-0027](adr/0027-convencoes-de-interface-no-agentmemory.md).

## Regra

O tema em `docs/references/theme` e a referencia visual obrigatoria para toda interface do PDV e
da nuvem. Sua documentacao oficial local esta em `docs/references/theme/documentation`.

Esta regra vale para telas novas, manutencao, responsividade, revisoes visuais e componentes
compartilhados. A indisponibilidade do AgentMemory nao altera essa obrigacao.
Se qualquer um dos dois diretorios de referencia estiver ausente, a tarefa de UI deve parar ate
que o material seja restaurado; nao e permitido substituir a referencia por suposicao.

## Fluxo Antes de Editar UI

1. Consulte `memory_recall` usando o nome da tela e `tema visual WowDash`.
2. Leia a secao aplicavel em `docs/references/theme/documentation/index.html`.
3. Procure uma pagina equivalente em `docs/references/theme/app`.
4. Procure componentes equivalentes em `docs/references/theme/components`.
5. Verifique primeiro o que ja existe em `packages/ui` e nos layouts compartilhados.
6. Implemente a adaptacao e valide em desktop e smartphone, nos modos claro e escuro.
7. Copie `docs/theme-reviews/TEMPLATE.md` para um novo arquivo nessa pasta, preencha as
   referencias e marque as validacoes antes de publicar a branch.

## Hooks

Execute `npm run hooks:install` uma vez por clone. O `pre-commit` verifica se o tema esta
disponivel quando houver arquivos de UI no commit. O `pre-push` compara a branch com
`origin/main` e exige um relatorio de tema novo e completo antes de permitir a publicacao.

O verificador considera UI em `apps/pdv`, `apps/nuvem/web`, `packages/ui` e nos caminhos legados
`apps/escritorio` e `src`. Testes e mudancas apenas de backend/documentacao nao exigem relatorio.
Execute manualmente com `npm run theme:check`; os testes do guardrail usam `npm run theme:test`.

## Como Adaptar

- Preserve a hierarquia, densidade, espacamento, tipografia, cores, estados e comportamento
  responsivo demonstrados pelo tema.
- Use `packages/ui` como fonte dos componentes compartilhados entre PDV e nuvem.
- Use Lucide para icones e os tokens existentes do projeto.
- Adapte textos, rotas, permissoes, dados e interacoes ao dominio da Livraria.
- Mantenha estados de carregamento, vazio, erro, sucesso, foco e desabilitado.
- Confirme que tabelas, formularios, menus, dialogos e acoes continuam utilizaveis no celular.

## O Que Nao Copiar

- Regras de negocio, autenticacao, chamadas de API ou dados ficticios do tema.
- Dependencias ou componentes duplicados quando ja houver equivalente em `packages/ui`.
- Paginas inteiras sem adequacao ao fluxo real e aos requisitos de acessibilidade.
- Segredos, licencas, arquivos completos ou assets do tema para o AgentMemory.

## Memoria

Decisoes visuais ainda em avaliacao ficam em memoria privada. Depois de verificadas na tela real,
podem ser promovidas para memoria de equipe com a origem do requisito ou arquivo relacionado.
O codigo, esta politica e a documentacao local do tema sempre prevalecem sobre memorias antigas.
