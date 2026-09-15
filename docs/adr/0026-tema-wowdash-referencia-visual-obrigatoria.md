# ADR-0026: Tema WowDash como referencia visual obrigatoria

## Status

Aceito em 2026-09-15.

## Contexto

PDV e nuvem possuem fluxos diferentes, mas precisam apresentar uma linguagem visual coerente.
Sem uma referencia explicita, cada tela pode introduzir estruturas, espacamentos, cores e
comportamentos responsivos diferentes. O repositorio possui o tema WowDash completo em
`docs/references/theme` e sua documentacao em `docs/references/theme/documentation`.

O tema e uma referencia de interface, nao uma fonte de regras de negocio ou uma dependencia de
execucao. Os componentes compartilhados do produto continuam centralizados em `packages/ui`,
conforme ADR-0020.

## Decisao

Toda criacao, alteracao ou revisao de interface do PDV e da nuvem deve usar o tema WowDash local
como referencia visual obrigatoria.

Antes de editar uma tela, o agente ou desenvolvedor deve:

- Ler `docs/ui-theme-policy.md` e a secao aplicavel da documentacao do tema.
- Localizar no tema uma pagina e os componentes equivalentes ao fluxo em desenvolvimento.
- Reutilizar primeiro `packages/ui` e os padroes da Livraria ja adaptados.
- Adaptar textos, rotas, permissoes, dados e interacoes ao dominio real da Livraria.
- Validar desktop e smartphone, modos claro e escuro, acessibilidade e estados completos.

Nao devem ser copiados do tema regras de negocio, autenticacao, chamadas de API, dados ficticios
ou dependencias duplicadas. Se os diretorios de referencia estiverem ausentes, a tarefa de UI
fica bloqueada ate a restauracao do material; nao se substitui a referencia por suposicao.

## Consequencias

- PDV e nuvem passam a compartilhar uma direcao visual verificavel.
- Revisoes de UI podem comparar a implementacao com exemplos concretos do tema.
- `packages/ui` permanece a fonte executavel dos componentes; o tema permanece referencia.
- Alteracoes visuais exigem verificacao em smartphone, mesmo quando a demanda nasce no desktop.
- Hooks locais exigem disponibilidade do tema no commit e um relatorio de conformidade no push.
- O material de referencia deve ser tratado com cuidado para nao versionar segredos como
  `.env.local` nem enviar seu conteudo integral para servicos de memoria.

## Alternativas Rejeitadas

- Criar uma linguagem visual propria tela a tela: aumenta divergencia e retrabalho.
- Copiar paginas completas do tema: mistura exemplos com regras reais e duplica componentes.
- Usar o tema apenas como inspiracao opcional: nao produz consistencia verificavel.
