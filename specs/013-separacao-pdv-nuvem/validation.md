# Validacao da separacao PDV e nuvem

Validacao consolidada em 2026-09-15.

## Estrutura

- O PDV esta isolado em `apps/pdv`, com React/Tauri, dominio Rust e SQLite local.
- A nuvem esta isolada em `apps/nuvem`, com web Next.js, API NestJS e migrator.
- Os contratos compartilhados estao em `packages/contratos`.
- Nao existem os antigos caminhos executaveis `src`, `src-tauri` ou `apps/escritorio` na raiz.

## Integracao

- A API cobre autenticacao, catalogo, referencias, usuarios, PDVs, estoque, entradas, turnos,
  vendas e relatorios.
- O web administrativo usa exclusivamente a API NestJS.
- O navegador nao possui cliente Supabase, credenciais publicas ou fallback direto ao banco.
- O PDV publica e recebe alteracoes pela API com UUIDs, cursores, confirmacao e reenvio
  idempotente.
- Valores monetarios permanecem inteiros em centavos.

## Verificacoes

- Testes Vitest do web: passaram.
- Build de producao do web: passou com todas as rotas ativas.
- Build TypeScript da API: passou.
- Imagens Docker do web e da API: passaram.
- As 14 telas protegidas passaram em navegador real no desktop e smartphone, em modo claro e
  escuro, sem overflow horizontal ou controles sem nome acessivel.
- Login com identificador em maiusculas foi normalizado e aceito.
- Navegacao completa nao perdeu mais a sessao por limite compartilhado entre usuarios.
- Os testes e builds devem ser repetidos pelo workflow da `main`.

As evidencias da decisao definitiva estao no ADR-0028. Nao ha chave de runtime para reativar o
acesso direto do frontend ao banco; rollback operacional usa uma imagem anterior e uma decisao
explicita de arquitetura.
