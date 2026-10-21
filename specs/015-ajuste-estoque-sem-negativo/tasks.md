# Tasks: Ajuste manual de estoque sem saldo negativo

**Input**: `specs/015-ajuste-estoque-sem-negativo/` (spec.md, plan.md)

## Phase 1: User Story 1 - Ajuste não deixa o estoque negativo (P1) 🎯 MVP

- [X] T001 [US1] Em `apps/nuvem/api/src/admin/stock.service.ts`, dentro da transação de `persist`,
  quando `type === "ajuste"`, para cada item novo (não reenvio) com `quantity < 0`: somar
  `movimento_estoque.qtd` não excluídos do livro e, se `saldo + quantity < 0`, lançar
  `ConflictException("O estoque ficaria negativo (atual: N)")`
- [X] T002 [US1] Em `apps/nuvem/api/tests/admin-stock.cjs`, cobrir: recusa 409 com a mensagem e sem
  movimento; ajuste que zera aceito; ajuste positivo aceito com saldo negativo; reenvio do mesmo
  `sync_uid` aceito
- [X] T003 [P] [US1] Em `apps/nuvem/retaguarda/components/AjusteEstoque.tsx`, nova prop opcional
  `onRecusado?: () => void`, chamada quando a API recusa (formulário continua aberto)
- [X] T004 [US1] Ligar `onRecusado` a `recarregarSaldo` em `apps/nuvem/retaguarda/app/cadastro/LivroForm.tsx`
  e a `carregarBase` em `apps/nuvem/retaguarda/app/pesquisa/page.tsx`

## Phase 2: User Story 2 - Quantidade exata e um envio só (P2)

- [X] T005 [P] [US2] Criar `apps/nuvem/retaguarda/lib/nuvem/ajuste.ts` com `lerQtdAjuste(texto):
  number | null` (`/^[+-]?\d+$/` após trim, zero → null) e teste em
  `apps/nuvem/retaguarda/lib/nuvem/__tests__/ajuste.test.ts`
- [X] T006 [US2] Em `AjusteEstoque.tsx`, usar `lerQtdAjuste` no lugar do `parseInt`; estado `enviando`
  desabilita "Aplicar"/"Cancelar" e ignora cliques repetidos; botões `type="button"`

## Phase 3: Polish

- [X] T007 Rodar `npm run test:api -w livraria-escritorio`, `npm run build:api` e a integração da API
  com Postgres em Docker (como `.github/workflows/nuvem-api.yml`)
- [X] T008 Conferir ≤ 300 linhas nos arquivos tocados

## Dependencies

T001 → T002. T003 → T004. T005 → T006. US1 e US2 são independentes (T003 e T006 tocam o mesmo
arquivo: fazer em sequência).
