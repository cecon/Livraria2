# ADR-0028: Web da nuvem exclusivamente pela API NestJS

## Status

Aceito em 2026-09-15. Substitui, para o web administrativo, o acesso direto descrito nos
ADRs 0015 e 0019.

## Contexto

Durante a migracao para a arquitetura separada, cada modulo do web podia alternar entre a API
NestJS e consultas diretas ao Supabase. Essa duplicidade cumpriu a janela de homologacao, mas
mantinha duas autenticacoes, dois caminhos de regra de negocio e configuracoes que podiam colocar
uma tela em uma versao diferente das demais.

Manter paginas duplicadas, endpoints de configuracao e fallbacks sem uso aumentava o risco de uma
nova imagem restaurar acidentalmente problemas ja corrigidos.

## Decisao

O web em `apps/nuvem/web` usa exclusivamente a API NestJS em `apps/nuvem/api` para autenticacao e
dados administrativos. Sao removidos:

- clientes Supabase do frontend e suas dependencias;
- credenciais Supabase e conta compartilhada no ambiente do web;
- chaves por modulo e endpoints que informavam se a API estava habilitada;
- implementacoes alternativas nos modulos de catalogo, referencias, usuarios, estoque, entradas,
  turnos, vendas e relatorios;
- paginas e endpoints sem consumidor, incluindo o alias `/operadores`.

O PostgreSQL hospedado continua sendo a persistencia da nuvem e o migrator continua aplicando o
schema. Essa infraestrutura nao autoriza acesso direto do navegador. Falhas da API devem aparecer
como falhas controladas; nao acionam outro caminho de gravacao.

Rollback operacional passa a ser feito com uma imagem anterior conhecida e exige nova decisao de
arquitetura caso seja necessario reintroduzir outro contrato. Nao existe chave de runtime para
ressuscitar o caminho removido.

## Consequencias

- Todas as telas observam a mesma autenticacao, autorizacao e regra de negocio.
- A limitacao da API identifica sessoes autenticadas separadamente, sem agregar todos os usuarios
  no IP interno do container web.
- O bundle do navegador deixa de conter SDK e configuracao do Supabase.
- O deploy do web exige apenas `NUVEM_API_URL`; API e migrator mantem suas configuracoes proprias.
- A disponibilidade do administrativo passa a depender explicitamente da API.
- Novas funcionalidades devem nascer no contrato da API, sem consultas diretas no web.

## Alternativas Rejeitadas

- Preservar fallbacks desligados: continuam envelhecendo e podem ser reativados sem validacao.
- Manter paginas como redirecionamentos: aumenta a superficie sem atender um fluxo real.
- Migrar apenas os modulos mais usados: perpetua duas arquiteturas e sessoes incompativeis.
