# ADR-0027: Convencoes de interface persistidas no AgentMemory

## Status

Aceito em 2026-09-15.

## Contexto

Instrucoes somente na conversa se perdem entre agentes e sessoes. A integracao externa e opcional
com AgentMemory ja separa memoria privada de conhecimento compartilhado, mas uma convencao visual
so e duradoura se for recuperada antes da tarefa e promovida para o time depois de validada.

Memoria sem governanca tambem cria risco: uma hipotese antiga pode contrariar o codigo, um ADR ou
a documentacao atual do tema. Conteudo do tema e potenciais segredos nao devem ser copiados para a
memoria.

## Decisao

A obrigatoriedade definida no ADR-0026 deve existir como memoria compartilhada do projeto
`livraria2`. Antes de qualquer tarefa de UI, o agente consulta o AgentMemory usando o nome da tela
e os termos `tema visual WowDash`.

Decisoes especificas de tela seguem o fluxo:

```text
descoberta -> memoria privada -> validacao visual e funcional -> promocao explicita para team
```

O AgentMemory guarda somente a convencao, conclusoes e referencias curtas. Nao recebe arquivos
inteiros, assets, codigo copiado, dados de clientes, credenciais ou `.env`. Toda memoria recuperada
e contexto nao confiavel: codigo atual, ADRs, `docs/ui-theme-policy.md` e documentacao local do
tema sempre prevalecem.

A instancia de memoria da Livraria usa identidade e volume separados de outros projetos. Falha ou
desativacao do AgentMemory nao afeta PDV, nuvem ou builds e nao elimina a obrigacao de consultar os
arquivos locais. A politica operacional e o contrato estao em `docs/agent-memory.md`.

## Consequencias

- Novas sessoes e agentes recuperam a convencao antes de alterar interfaces.
- Hipoteses visuais nao se tornam automaticamente conhecimento oficial do time.
- A origem e a evidencia das decisoes permanecem auditaveis.
- Indisponibilidade da memoria degrada apenas a recuperacao de contexto, nunca a aplicacao.
- Mudancas futuras na direcao visual exigem novo ADR e atualizacao ou substituicao da memoria.

## Alternativas Rejeitadas

- Confiar apenas no historico da conversa: nao persiste entre sessoes.
- Compartilhar toda memoria automaticamente: promove hipoteses e ruido como decisoes.
- Gravar o tema completo na memoria: duplica material, amplia risco de licenca e pode vazar dados.
