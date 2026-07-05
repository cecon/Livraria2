# Tasks: Destinação de estoque para doações (contabilidade de fundos)

**Input**: Design documents from `specs/006-destinacao-doacoes/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D9), data-model.md, contracts/tauri-commands.md, quickstart.md

**Tests**: testes de domínio (sem UI/DB) e de repo (SQLite temporário) são **obrigatórios** — quality gate da constituição (Princípio I e Fluxo de Desenvolvimento). Ficam `#[cfg(test)]` no próprio módulo, como no restante do projeto.

**Organization**: tarefas agrupadas por user story; cada fase é um incremento testável de forma independente. Limite de 300 linhas significativas por arquivo vigia todas as tarefas (hook `scripts/check-file-size.sh`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (Destinar estoque), US2 (Apuração), US3 (Cadastro), US4 (PDV visual)

---

## Phase 1: Setup (migração e entidades)

**Purpose**: schema novo no lugar, idempotente, antes de qualquer código de negócio.

- [x] T001 Adicionar módulo `m007_destinacoes` em src-tauri/src/migration/mod.rs (estilo `m005`): `CREATE TABLE IF NOT EXISTS` para `destinacao`, `destinacao_saldo`, `transferencia_destinacao`, `alocacao_venda` + índices + seed "Loja" (`de_sistema=1, ordem=0`) com `INSERT … WHERE NOT EXISTS (de_sistema=1)`; registrar no vetor `migrations()` — sem ALTERs (data-model.md)
- [x] T002 [P] Criar entities SeaORM em src-tauri/src/adapters/persistencia/entities/destinacao.rs (módulos: destinacao, destinacao_saldo, transferencia_destinacao, alocacao_venda) e registrar em entities/mod.rs
- [x] T003 Teste de idempotência da m007 em src-tauri/src/migration/mod.rs (`#[cfg(test)]`, SQLite temporário): aplicar 2× converge sem erro, seed "Loja" não duplica

---

## Phase 2: Foundational (domínio puro + porta + repo base)

**Purpose**: regras e acesso a dados que TODAS as stories usam. ⚠️ Bloqueia as fases 3+.

- [x] T004 [P] Criar src-tauri/src/domain/destinacao.rs: `Destinacao {id, nome, de_sistema, ativa, ordem}` + validações puras (nome não-vazio; `pode_excluir(em_uso)`, `pode_desativar`, `pode_reordenar` — Loja: nunca) + testes inline
- [x] T005 [P] Criar src-tauri/src/domain/alocacao.rs: `alocar_venda(carimbos_ordenados, livre, qtd)` (carimbos em ordem, Loja 1º → livre), `alocar_perda(livre, carimbos_ordenados, qtd)` (inverso), `validar_transferencia(origem_saldo, qtd)`, inversos de estorno + testes inline cobrindo fronteiras (qtd > carimbos, qtd > total, carimbo zerado)
- [x] T006 [P] Adicionar `pode_cancelar_venda(data_venda, hoje)` (≤ 5 dias corridos) em src-tauri/src/domain/pedido.rs + testes inline (dia 5 permite, dia 6 bloqueia)
- [x] T007 Criar src-tauri/src/application/ports_destinacao.rs: trait `DestinacaoRepo` (listar, listar_ativas, criar, renomear, definir_ativa, reordenar, excluir, em_uso, saldos_livro, transferir, transferencias_livro, relatorio_periodo, posicao_atual) + tipos (`SaldoLivro`, `Alocacao`, `LinhaRelatorio`); registrar em application/mod.rs
- [x] T008 Criar src-tauri/src/adapters/persistencia/destinacao_repo.rs: `SeaDestinacaoRepo` com CRUD + `em_uso` (existe em destinacao_saldo qtd>0 OU alocacao_venda OU transferencia_destinacao) + testes com SQLite temporário; registrar em persistencia/mod.rs
- [x] T009 Criar src-tauri/src/commands_destinacao.rs com comandos base `destinacoes_listar`, `destinacoes_listar_ativas`, `destinacao_criar` (contrato em contracts/tauri-commands.md) e registrar em src-tauri/src/lib.rs
- [x] T010 [P] Criar src/lib/ipc_destinacoes.ts (bindings base) e adicionar `Destinacao` em src/lib/types.ts

**Checkpoint**: `cargo test` verde; app abre com m007 aplicada; criar/listar destinação funciona via console.

---

## Phase 3: User Story 1 — Definir destino de estoque (Priority: P1) 🎯 MVP

**Goal**: transferir quantidades de um livro entre Livre e carimbos (inclusive Loja), com guards, histórico auditável e sem tocar no estoque físico. Único mecanismo de criação de carimbos.

**Independent Test**: livro com estoque 80 livre → transferir 50 para Missões (físico 80, livre 30, Missões 50); 10 de Missões → Livre (40/40); transferir 100 de Livre com só 40 → bloqueado com o disponível na mensagem; histórico registra tudo (quickstart cenário 2).

- [x] T011 [US1] Criar src-tauri/src/adapters/persistencia/destinacao_sql.rs com `transferir(txn, livro_id, de, para, qtd, motivo)` (guards: de ≠ para, origem com saldo — livre = estoque − Σ carimbos, destino ativo; upsert/decremento em destinacao_saldo com remoção de linhas qtd=0 + registro em transferencia_destinacao), `saldos_livro`, `transferencias_livro` + testes SQLite temporário (incl. invariante Σ carimbos ≤ estoque)
- [x] T012 [US1] Criar src-tauri/src/application/destinacoes.rs: caso de uso `transferir` (valida via domain/alocacao.rs e delega à porta) + `saldos_livro`/`historico` + testes com fakes da porta
- [x] T013 [US1] Adicionar comandos `destinacao_transferir`, `destinacao_saldos_livro`, `destinacao_transferencias_livro` em src-tauri/src/commands_destinacao.rs (+ lib.rs); erro `saldo_insuficiente` com disponível na mensagem
- [x] T014 [P] [US1] Adicionar bindings de transferência em src/lib/ipc_destinacoes.ts e tipos `SaldoLivro`/`Transferencia` em src/lib/types.ts
- [x] T015 [US1] Criar src/components/DestinarEstoque.tsx: dialog com saldos do livro (livre + carimbos), form de transferência (origem/destino/qtd/motivo) e histórico — validação de saldo com mensagem clara
- [x] T016 [US1] Adicionar ação "Destinar estoque" no detalhe do livro em src/routes/Pesquisa.tsx (abre o dialog)

**Checkpoint**: US1 completa — dá para carimbar o caso dos 220 (entrada normal + 10 Loja / 210 Missões) de ponta a ponta.

---

## Phase 4: User Story 2 — Apurar valores por destinação (Priority: P2)

**Goal**: venda consome carimbos (Loja 1º → livre) gravando alocações; perdas/estornos de entrada consomem na ordem inversa; estorno de venda (≤ 5 dias) devolve ao carimbo certo; relatório por período + posição atual; distribuição visível no detalhe da venda.

**Independent Test**: livro com Loja 1 + Missões 210, vender 2 × R$ 50 → relatório do dia: R$ 50 Loja / R$ 50 Missões; detalhe da venda: 1 un. Loja · 1 un. Missões; posição atual: Missões 209; cancelar no mesmo dia restaura tudo; cancelar venda com > 5 dias é bloqueado (quickstart cenários 3–7).

- [x] T017 [US2] Adicionar em src-tauri/src/adapters/persistencia/destinacao_sql.rs: `consumir_carimbos(txn, livro_id, qtd, modo)` (modo Venda: carimbos em ordem → livre, retorna alocações; modo Perda: livre → carimbos), `devolver_alocacoes(txn, pedido_numero)` e `gravar_alocacoes(txn, …)` + testes SQLite temporário dos dois modos e do estorno
- [x] T018 [US2] Integrar consumo na venda em src-tauri/src/adapters/persistencia/pedido_repo.rs: `registrar` chama consumir_carimbos (modo Venda) + grava alocacao_venda (valor = qtd × preço do item) na MESMA transação dos movimentos; testes: venda na fronteira (Loja 1 + Missões 210, vende 2), livro sem carimbo (zero linhas)
- [x] T019 [US2] Cancelamento de venda: guard dos 5 dias (domain `pode_cancelar_venda`) aplicado na camada de aplicação do comando existente `excluir_pedido` (src-tauri/src/commands.rs, erro `venda_antiga`) e devolução pelas alocações em pedido_repo `cancelar`; testes: cancela dia 5 ok, dia 6 bloqueia, carimbo Loja restaurado
- [x] T020 [P] [US2] Ajuste negativo consome modo Perda em src-tauri/src/adapters/persistencia/estoque_repo.rs (mesma transação do movimento) + testes (livre primeiro, carimbo protegido)
- [x] T021 [P] [US2] Diferença negativa de contagem consome modo Perda em src-tauri/src/adapters/persistencia/inventario_repo.rs + testes (quickstart cenário 6)
- [x] T022 [P] [US2] Estorno de lançamento de entrada consome modo Perda em src-tauri/src/adapters/persistencia/lancamento_sql.rs (`aplicar_cancelamento`) + teste (entrada 10, carimba 8, cancela → 2 do livre + 8 do carimbo, sem erro)
- [x] T023 [US2] Relatório em destinacao_sql.rs: `relatorio_periodo(inicio, fim)` (especiais por Σ alocações com `pedido.cancelado = 0`; Loja = total − Σ demais) e `posicao_atual()` (Σ destinacao_saldo por destinação) + caso de uso em application/destinacoes.rs + testes (Σ linhas = total; estorno retroativo)
- [x] T024 [US2] Comando `relatorio_destinacoes({inicio, fim})` em src-tauri/src/commands_destinacao.rs (+ lib.rs), resposta com `linhas` + `posicaoAtual` (contrato)
- [x] T025 [US2] Detalhe da venda com alocações por item em src-tauri/src/adapters/persistencia/relatorio_repo.rs (consolidando carimbo Loja + livre numa entrada "Loja") + exposição no comando de detalhe existente
- [x] T026 [P] [US2] Bindings `relatorioDestinacoes` + tipos (`RelatorioDestinacoes`, `AlocacaoVenda`) em src/lib/ipc_destinacoes.ts e src/lib/types.ts
- [x] T027 [US2] Visão "Por destinação" em src/routes/Relatorios.tsx (via src/components/RelatoriosViews.tsx se necessário p/ limite de linhas): intervalo de datas, linhas com qtd/R$, total e seção "Posição atual"
- [x] T028 [US2] Distribuição por destinação (badges) no detalhe da venda em src/routes/ListaVendas.tsx + mensagem clara para erro `venda_antiga` no cancelamento

**Checkpoint**: ciclo completo doação → destino → venda → relatório fecha com o caixa; estornos consistentes.

---

## Phase 5: User Story 3 — Gerenciar o cadastro de destinações (Priority: P3)

**Goal**: tela de cadastro completa (criar, renomear, reordenar, ativar/desativar, excluir) com Loja protegida e guards de uso — ordem da lista = ordem de baixa.

**Independent Test**: criar "Missões"/"Espaço", renomear com conflito normalizado (bloqueia), inverter ordem (muda a ordem de baixa na próxima venda), desativar (some das transferências, saldos continuam consumíveis), excluir usada (bloqueia e oferece desativar) — quickstart cenários 1 e 7.

- [ ] T029 [US3] Completar src-tauri/src/application/destinacoes.rs: `renomear`, `definir_ativa`, `reordenar`, `excluir` com guards (Loja protegida via domain; unicidade `nome_norm` entre ativas incl. bloqueio de reativação conflitante — reusar normalização de src-tauri/src/domain/texto.rs; excluir só sem uso) + testes com fakes
- [ ] T030 [US3] Adicionar comandos `destinacao_renomear`, `destinacao_definir_ativa`, `destinacao_reordenar`, `destinacao_excluir` em src-tauri/src/commands_destinacao.rs (+ lib.rs)
- [ ] T031 [P] [US3] Completar bindings do CRUD em src/lib/ipc_destinacoes.ts
- [ ] T032 [P] [US3] Criar src/components/DestinacoesLista.tsx (lista com reordenação, ativar/desativar, excluir→oferece desativar; Loja fixa no topo) e src/components/DestinacaoForm.tsx (criar/renomear) — padrão FormasPagamentoLista/FormaPagamentoForm da 005
- [ ] T033 [US3] Criar src/routes/Destinacoes.tsx e adicionar entrada no menu em src/components/AppSidebar.tsx + rota em src/App.tsx

**Checkpoint**: gestão completa sem alteração de código para destino novo.

---

## Phase 6: User Story 4 — Caixa livre e confirmação de venda no PDV (Priority: P3)

**Goal**: estado "Caixa livre" quando a venda está vazia e confirmação animada (total/troco) na conclusão — frontend puro, zero cliques a mais, nunca bloqueia a bipagem.

**Independent Test**: PDV vazio mostra "Caixa livre"; bipar item remove; concluir pagamento mostra animação com total/troco e volta ao caixa livre; bipar durante a animação dispensa e inicia a próxima venda; sem ação, auto-dispensa em segundos (quickstart cenário 8).

- [ ] T034 [P] [US4] Estado "Caixa livre" na área de itens em src/components/CarrinhoItens.tsx (informe visível de relance quando lista vazia; some ao adicionar item)
- [ ] T035 [P] [US4] Criar src/components/VendaConcluida.tsx: confirmação animada com total e troco (props), auto-dispensa por timeout e por callback de dispensa
- [ ] T036 [US4] Integrar em src/components/Pdv.tsx: ao concluir `registrar_venda`, exibir VendaConcluida, limpar venda, manter foco no campo de código; qualquer bipagem/tecla dispensa a animação e inicia a próxima venda

**Checkpoint**: ciclo venda → confirmação → caixa livre → próxima venda sem cliques.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T037 [P] Escrever docs/adr/0014-destinacao-doacoes.md (resíduo + carimbos com prioridade de venda; transferência como origem única; estorno de entrada como perda; janela de 5 dias; base: research.md D1–D9) e listar no docs/adr/README.md se existir índice
- [ ] T038 Validação manual completa do quickstart.md (cenários 1–8 + regressão) em cópia da base real
- [ ] T039 [P] Testes Vitest de UI (padrão de src/lib/venda.test.ts): DestinarEstoque (validação de saldo e mensagens), distribuição por destinação no detalhe da venda, estado "Caixa livre" e VendaConcluida (auto-dispensa e dispensa por bipagem) em src/components/*.test.tsx
- [ ] T040 Gates finais: `cargo test` completo, `npm run build` + Vitest, `bash scripts/check-file-size.sh` (≤300 linhas), revisão de termos pt-BR ("Destinação", "Destinar estoque", "Loja", "Livre", "Caixa livre")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** → bloqueia todas as stories
- **US1 (Phase 3)**: após Foundational — primeira entrega de valor (carimbos existem)
- **US2 (Phase 4)**: após Foundational; testes de ponta a ponta ficam melhores com US1 pronta (criar carimbos pela UI), mas o código é independente (repos podem semear saldos nos testes)
- **US3 (Phase 5)**: após Foundational; independe de US1/US2 (o criar básico já existe do Foundational)
- **US4 (Phase 6)**: só frontend do PDV — independe de todas; pode ser feita a qualquer momento após Setup
- **Polish (Phase 7)**: após as stories desejadas

### Within Stories

- Domínio → SQL/repo → caso de uso → comando → IPC → UI
- T017 (consumir_carimbos) bloqueia T018–T022; T023 bloqueia T024; T024/T025 bloqueiam T026–T028

### Parallel Opportunities

- Phase 2: T004, T005, T006 em paralelo (arquivos de domínio distintos); T010 em paralelo com T007–T009
- Phase 4: T020, T021, T022 em paralelo (repos distintos) após T017
- Phase 5: T031 e T032 em paralelo após T030
- Phase 6: T034 e T035 em paralelo; US4 inteira em paralelo com qualquer outra fase
- T037 (ADR) em paralelo com qualquer momento após o desenho estabilizar

## Parallel Example: Phase 4 (após T017)

```text
Task: T020 ajuste negativo modo Perda em estoque_repo.rs
Task: T021 contagem negativa modo Perda em inventario_repo.rs
Task: T022 estorno de lançamento modo Perda em lancamento_sql.rs
```

## Implementation Strategy

**MVP = Phases 1–3 (US1)**: com m007 + domínio + cadastro básico + transferência, o responsável já carimba o caso dos 220 — mesmo antes do relatório, os saldos ficam corretos e auditáveis desde o primeiro dia (as vendas ainda não consomem carimbo até a US2, então convém emendar a US2 logo em seguida).

**Entrega incremental recomendada**: (1–2) fundação → (3) US1 destinar → (4) US2 consumo+relatório ← *a partir daqui a feature cumpre a promessa* → (5) US3 gestão completa → (6) US4 polish do PDV → (7) ADR + validação. Commits separados por fase (sequenciamento do plan.md).

**Nota sobre consumo antes da US2**: entre US1 e US2, vendas de livros carimbados baixariam só o físico (carimbo ficaria "inflado"). Por isso US1 e US2 devem ir para produção **juntas** — a separação é de implementação/teste, não de release.
