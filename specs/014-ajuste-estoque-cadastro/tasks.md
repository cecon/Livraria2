# Tasks: Ajustar estoque a partir do cadastro do livro

**Input**: Design documents from `specs/014-ajuste-estoque-cadastro/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ajuste-estoque.md ✅, quickstart.md ✅

**Tests**: incluídos só onde a constituição exige ou o risco pede — regra de domínio (`validar_ajuste`,
quality gate 2), guarda SQL da nuvem (concorrência) e mapeamento de erro do adapter.

**Organization**: por user story (US1, US2), cada uma testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1/US2 nas fases de história; Setup/Foundational/Polish sem label

## Contexto de estrutura (do plan.md)

- Já existe: `AjusteEstoque.tsx` (usado na Pesquisa), `registrarAjuste` em `lib/nuvem/movimentos.ts`
  (insert de `movimento_estoque` tipo `ajuste`, origem `escritorio`), `listarSaldos` em
  `lib/nuvem/estoque.ts` (`vw_saldo_livro`), `ErroDominio::EstoqueNegativo` e `MotivoObrigatorio` em
  `crates/livraria-domain/src/erros.rs`, ponte WASM em `apps/escritorio/lib/dominio.ts`.
- `apps/escritorio/app/cadastro/page.tsx` tem 249 linhas — extrair o `LivroForm` antes de crescer.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: registro da decisão de arquitetura

- [X] T001 Criar **ADR-0026** em `docs/adr/0026-ajuste-sem-saldo-negativo.md` (contexto: FR-012 da 014;
  decisão: regra pura `estoque::validar_ajuste` no domínio + guarda `BEFORE INSERT` na nuvem só para o
  ajuste manual (`tipo='ajuste' and origem='escritorio' and referencia='ajuste_manual'`), travando a
  linha do livro; consequências: DRY parcial justificado, Pesquisa também passa a recusar negativo,
  estorno de nota e inventário não afetados, risco residual com venda concorrente aceito;
  alternativas: RPC, só cliente, só SQL, filtro por motivo, trava na venda — ver `research.md` D1/D2)
  e adicionar a linha no índice `docs/adr/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: regra de domínio, ponte WASM, guarda na nuvem e adapters — usados por US1 e US2

**⚠️ CRITICAL**: nenhuma história começa antes desta fase

- [X] T002 Adicionar `ErroDominio::AjusteSemQuantidade` (mensagem "informe a quantidade do ajuste
  (ex.: -2 ou 3)", código `AJUSTE_SEM_QUANTIDADE`) em `crates/livraria-domain/src/erros.rs`, incluindo
  o caso no teste `codigos_estaveis`
- [X] T003 Implementar `pub fn validar_ajuste(saldo_atual: i64, delta: i64, motivo: &str) -> Result<i64,
  ErroDominio>` em `crates/livraria-domain/src/estoque.rs` na ordem do `data-model.md` (delta 0 →
  `AjusteSemQuantidade`; motivo vazio/espaços → `MotivoObrigatorio`; `saldo+delta < 0` →
  `EstoqueNegativo`; senão `Ok(saldo+delta)`), com testes no `mod tests`: positivo, zera (aceito),
  negativo (recusado), delta 0, motivo só espaços, precedência delta 0 sobre motivo vazio
- [ ] T004 Expor `validar_ajuste_estoque(saldo_atual: f64, delta: f64, motivo: &str) -> Result<JsValue,
  JsError>` em `crates/livraria-domain-wasm/src/lib.rs`, retornando `{ ok, erro?, novoSaldo? }` no
  padrão de `ValidacaoOut` (contrato §2). **Não dá para compilar o WASM nesta máquina** (Smart App
  Control): commitar T002–T004, dar push da branch, aguardar o workflow `build-wasm`
  (`.github/workflows/wasm.yml`) commitar `packages/domain` de volta e fazer `git pull`; conferir que
  `packages/domain/index.d.ts` tem `validar_ajuste_estoque`. T011 depende deste passo
- [X] T005 [P] Criar migração idempotente `apps/nuvem/migrations/0016_ajuste_sem_saldo_negativo.sql`:
  função `guarda_ajuste_sem_saldo_negativo()` (plpgsql) que, se `new.tipo = 'ajuste' and new.origem =
  'escritorio' and new.referencia = 'ajuste_manual'`, faz `perform 1 from livro where sync_uid = new.livro_uid for update`, soma
  `movimento_estoque.qtd` não excluídos do livro e, se `saldo + new.qtd < 0`, executa `raise exception
  'ESTOQUE_NEGATIVO' using detail = saldo::text, errcode = 'P0001'`; `drop trigger if exists
  trg_ajuste_sem_saldo_negativo on movimento_estoque` + `create trigger … before insert … for each row`
- [X] T006 [P] Criar `apps/nuvem/tests/0016_ajuste_sem_saldo_negativo.sql` no padrão de
  `tests/0013_*.sql` (fixtures com uuid `00000000-0016-…`, transação com rollback): ajuste +2 aceito;
  ajuste que zera aceito; ajuste manual que deixaria −1 recusado com `ESTOQUE_NEGATIVO` e `detail` =
  saldo; **não** bloqueados: ajuste negativo sem `referencia` (estorno de nota), `contagem` com
  `referencia='inventario'`, ajuste de `origem='pdv'` e `saida_venda`
- [X] T007 [P] Registrar a `0016` na tabela de `apps/nuvem/migrations/README.md` (conteúdo + status
  "a aplicar em homologação, depois produção")
- [X] T008 [P] Adicionar `saldoLivro(livroUid: string): Promise<number>` em
  `apps/escritorio/lib/nuvem/estoque.ts` (lê `vw_saldo_livro` com `.eq("livro_uid", livroUid)
  .maybeSingle()`; retorna 0 se não houver linha)
- [X] T009 [P] Em `apps/escritorio/lib/nuvem/movimentos.ts`, fazer `registrarAjuste` gravar
  `referencia: "ajuste_manual"` no insert e retornar `{ error?: string; saldoAtual?: number }`: erro do
  Postgres com `message` `ESTOQUE_NEGATIVO` vira "O estoque ficaria negativo (atual: N)" e
  `saldoAtual = N` (do `details`); demais erros seguem `error.message`. Exportar a função pura de
  tradução (`traduzirErroAjuste(error) -> { error, saldoAtual? }`) para teste. Não alterar
  `lancamentoCancelar` em `lancamento.ts` (estorno de nota fica fora da guarda)
- [X] T010 [P] Criar `apps/escritorio/lib/nuvem/__tests__/movimentos.test.ts` (vitest, padrão de
  `estoque.test.ts`): `traduzirErroAjuste` com `ESTOQUE_NEGATIVO` + details "3" → mensagem "O estoque
  ficaria negativo (atual: 3)" e `saldoAtual` 3; erro genérico mantém a mensagem e vem sem
  `saldoAtual`
- [X] T011 Atualizar `apps/escritorio/components/AjusteEstoque.tsx` (contrato §5): novas props
  `saldoAtual: number` e `onSaldoAtualizado?: (n: number) => void`; a quantidade só é aceita se o
  texto (após trim) casar com `/^[+-]?\d+$/` — senão "Informe a quantidade (ex.: -2 ou 3)" sem
  chamar o domínio (substitui o `parseInt`, que aceita "2,5" e "-2abc"); ao aplicar, chamar `validar_ajuste_estoque` via `dominio()` de
  `@/lib/dominio` e mostrar a mensagem pt-BR do código (`AJUSTE_SEM_QUANTIDADE` → "Informe a
  quantidade (ex.: -2 ou 3)", `MOTIVO_OBRIGATORIO` → "Motivo é obrigatório", `ESTOQUE_NEGATIVO` → "O
  estoque ficaria negativo (atual: N)") sem enviar; estado `enviando` desabilita "Aplicar" e
  "Cancelar" durante o envio; em erro do servidor, toast e formulário continua aberto com os valores;
  se o retorno trouxer `saldoAtual`, chamar `onSaldoAtualizado(saldoAtual)` (venda concorrente)
- [X] T012 Em `apps/escritorio/app/pesquisa/page.tsx`, passar `saldoAtual={est(detalhe)}` ao
  `AjusteEstoque` (FR-011/FR-012 — Pesquisa passa a recusar negativo) depende de T011

**Checkpoint**: regra no domínio testada, guarda pronta para homologação, componente de ajuste com
saldo e trava de envio — a Pesquisa já funciona com a regra nova

---

## Phase 3: User Story 1 - Ajustar o estoque ao alterar um livro (Priority: P1) 🎯 MVP

**Goal**: na tela "Alterar livro", ver o estoque atual e ajustá-lo sem sair da tela

**Independent Test**: livro com estoque 5 → "Alterar livro" mostra 5 → ajustar −2 "quebra" → tela
mostra 3; lista do Cadastro e Pesquisa mostram 3; extrato tem o ajuste (quickstart §2, itens 1–5, 7)

### Implementation for User Story 1

- [X] T013 [US1] Extrair `LivroForm` de `apps/escritorio/app/cadastro/page.tsx` para
  `apps/escritorio/components/LivroForm.tsx` (export nomeado, mesmas props e comportamento; mover
  `centsInput` junto) e importar na página — sem mudança visual
- [X] T014 [US1] Em `apps/escritorio/components/LivroForm.tsx`, quando `editando`: estado `saldo`
  carregado por `saldoLivro(inicial.sync_uid)` ao montar; campo "Estoque atual" mostra o número (não
  "—", continua desabilitado) e, ao lado, `<AjusteEstoque livroUid={inicial.sync_uid}
  saldoAtual={saldo} onAjustado={recarregarSaldo} onSaldoAtualizado={setSaldo} />`. Em "Novo livro"
  nada muda (sem ajuste)
- [X] T015 [US1] Em `apps/escritorio/app/cadastro/page.tsx`, ao voltar do formulário por "Cancelar"
  (hoje `onCancelar` só fecha), chamar `carregar()` para a lista refletir ajustes feitos (SC-002) — e
  nada além disso: o "Cancelar" só descarta o estado do `LivroForm`, sem reverter o ajuste já gravado
  (FR-007)

**Checkpoint**: US1 entregue — ajuste pelo cadastro funcionando e consistente nas três telas

---

## Phase 4: User Story 2 - Não perder edições do cadastro ao ajustar (Priority: P2)

**Goal**: ajustar o estoque não salva nem descarta edições pendentes do livro

**Independent Test**: editar o preço sem salvar → ajustar +1 → preço digitado continua e o livro só
muda ao clicar "Alterar"; cancelar a edição mantém o ajuste no extrato (quickstart §2, item 6)

### Implementation for User Story 2

- [X] T016 [US2] Em `apps/escritorio/components/LivroForm.tsx`, garantir que `recarregarSaldo` só
  atualiza o estado `saldo` (não chama `onSalvo`, não reinicializa `form`, não remonta o componente) e
  que o `AjusteEstoque` fica fora de qualquer `<form>`/submit do livro (botões `type="button"`), para
  que "Aplicar" e Enter no ajuste não disparem "Alterar"

**Checkpoint**: US1 + US2 — ajuste independente das edições do cadastro

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T017 [P] Rodar `scripts/check-file-size.sh` e confirmar ≤ 300 linhas significativas em
  `LivroForm.tsx`, `cadastro/page.tsx`, `AjusteEstoque.tsx`, `estoque.rs`, `lib.rs` (wasm)
- [X] T018 [P] Rodar `cargo test -p livraria-domain` e `npm test` (raiz) — tudo verde
- [ ] T019 Aplicar `0016` em homologação **duas vezes** (idempotência) e rodar
  `apps/nuvem/tests/0016_ajuste_sem_saldo_negativo.sql` (token de acesso no Notion — nunca no repo)
- [ ] T020 Validar no navegador (desktop e celular) os cenários do `quickstart.md` §2 (1–12), medindo o
  alinhamento do "Estoque atual" + botão de ajuste com os demais campos do formulário; cronometrar
  "Aplicar" → saldo atualizado (meta < 2 s, plan.md); conferir com um usuário de perfil não-admin que
  Cadastro e Pesquisa oferecem o ajuste aos mesmos usuários (FR-010)
- [ ] T021 Atualizar a constituição/CLAUDE.md só se algo divergir do plano; marcar no `README.md` das
  migrações a `0016` como aplicada após produção

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sem dependências
- **Foundational (T002–T012)**: T003 depende de T002; T004 depende de T003; T011 depende de T004 e
  T009; T012 depende de T011. T005–T010 são independentes entre si e do domínio
- **US1 (T013–T015)**: depende da Foundational (T008, T011); T014 depende de T013
- **US2 (T016)**: depende de US1 (T014)
- **Polish (T017–T021)**: depois de US2; T019 pode ser feito assim que T005/T006 estiverem prontos

### User Story Dependencies

- **US1 (P1)**: independente após a Foundational — é o MVP
- **US2 (P2)**: refina o `LivroForm` de US1 (mesmo arquivo); testável separadamente pelo cenário de
  edição pendente

### Parallel Opportunities

- Em paralelo com a cadeia do domínio (T002→T003→T004): T005, T006, T007 (nuvem), T008, T009, T010
  (adapters do escritório)
- T017 e T018 em paralelo no Polish

---

## Parallel Example: Foundational

```text
Cadeia A (domínio):  T002 → T003 → T004
Cadeia B (nuvem):    T005 + T006 + T007
Cadeia C (adapters): T008 + T009 + T010
Junção:              T011 (precisa de T004 e T009) → T012
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 (ADR) → Foundational completa (T002–T012)
2. US1 (T013–T015) → validar quickstart §2 itens 1–5 e 7
3. Aplicar `0016` em homologação (T019) antes de publicar o escritório — sem a guarda, a regra só vale
   no cliente

### Incremental Delivery

1. Foundational: a Pesquisa já ganha a recusa de saldo negativo
2. US1: ajuste no "Alterar livro" (MVP)
3. US2: blindagem das edições pendentes
4. Polish: guardrails, testes, homologação, validação visual desktop/celular

---

## Notes

- Ordem de publicação: migração `0016` na nuvem **antes** do escritório novo (a guarda não quebra o
  escritório atual — ele só passa a ver a mensagem do Postgres em casos negativos)
- Dinheiro não está envolvido; quantidades são inteiras
- Commit por tarefa ou por grupo lógico; `/speckit-implement` marca `[x]` ao concluir
