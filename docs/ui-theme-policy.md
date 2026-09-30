# Politica de Uso do Tema

Decisoes arquiteturais: [ADR-0026](adr/0026-tema-wowdash-referencia-visual-obrigatoria.md) e
[ADR-0027](adr/0027-convencoes-de-interface-no-agentmemory.md).

## Referencia por produto (ADR-0040)

Por pedido explicito de 30/09/2026, a retaguarda usa o seed Able Pro 9.2.2 em
`docs/references/theme/able-pro/seed`, com guia em
`docs/references/theme/documentation/able-pro.md`. O PDV conserva sua referencia
anterior. Para Cloud, consultar esses arquivos e componentes locais em
`apps/nuvem/retaguarda/interface`; nao usar WowDash nem UI do PDV.

## Regra

As referencias por produto dentro de `docs/references/theme` sao obrigatorias. Sua documentacao oficial local esta em `docs/references/theme/documentation`.

Esta regra vale para telas novas, manutencao, responsividade, revisoes visuais e componentes
compartilhados. A indisponibilidade do AgentMemory nao altera essa obrigacao.
Se qualquer um dos dois diretorios de referencia estiver ausente, a tarefa de UI deve parar ate
que o material seja restaurado; nao e permitido substituir a referencia por suposicao.

## Fluxo Antes de Editar UI

1. Consulte `memory_recall` usando o nome da tela e o tema do produto (Able Pro para a retaguarda).
2. Leia o guia do produto em `docs/references/theme/documentation`.
3. Procure uma pagina equivalente no seed do tema correspondente.
4. Procure componentes equivalentes no mesmo tema.
5. Verifique os componentes da propria aplicacao; interfaces independentes seguem ADR-0032.
   `packages/ui` ainda existente e legado em transicao, nao destino de novos componentes.
6. Implemente a adaptacao e valide em desktop e smartphone, nos modos claro e escuro.
7. Copie `docs/theme-reviews/TEMPLATE.md` para um novo arquivo nessa pasta, preencha as
   referencias e marque as validacoes antes de publicar a branch.

## Hooks

Execute `npm run hooks:install` uma vez por clone. O `pre-commit` verifica se o tema esta
disponivel quando houver arquivos de UI no commit. O `pre-push` compara a branch com
`origin/main` e exige um relatorio de tema novo e completo antes de permitir a publicacao.

O verificador considera UI em `apps/pdv`, `apps/nuvem/retaguarda` e `packages/ui`. Testes e mudancas
apenas de backend/documentacao nao exigem relatorio.
Execute manualmente com `npm run theme:check`; os testes do guardrail usam `npm run theme:test`.

## Como Adaptar

- Preserve a hierarquia, densidade, espacamento, tipografia, cores, estados e comportamento
  responsivo demonstrados pelo tema.
- Mantenha componentes separados por produto; nao imponha pacote de UI compartilhado.
- Use Lucide para icones e os tokens existentes do projeto.
- Adapte textos, rotas, permissoes, dados e interacoes ao dominio da Livraria.
- Mantenha estados de carregamento, vazio, erro, sucesso, foco e desabilitado.
- Confirme que tabelas, formularios, menus, dialogos e acoes continuam utilizaveis no celular.

## O Que Nao Copiar

- Regras de negocio, autenticacao, chamadas de API ou dados ficticios do tema.
- Dependencias desnecessarias ou componentes duplicados dentro da mesma aplicacao.
- Paginas inteiras sem adequacao ao fluxo real e aos requisitos de acessibilidade.
- Segredos, licencas, arquivos completos ou assets do tema para o AgentMemory.

## Memoria

Decisoes visuais ainda em avaliacao ficam em memoria privada. Depois de verificadas na tela real,
podem ser promovidas para memoria de equipe com a origem do requisito ou arquivo relacionado.
O codigo, esta politica e a documentacao local do tema sempre prevalecem sobre memorias antigas.

## Referencia legada do PDV em 27/09/2026

O material WowDash versionado e minimo e contem placeholders; isso nao comprova fidelidade
visual completa ao WowDash. Declare essa limitacao, preserve os padroes existentes e
nao invente validacoes. Memoria indisponivel nao bloqueia a tarefa.
