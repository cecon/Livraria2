# Implementation Plan: Destinação de estoque para doações (contabilidade de fundos)

**Branch**: `006-destinacao-doacoes` | **Date**: 2026-07-04 (rev. pós-clarify: sem nota de doação) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-destinacao-doacoes/spec.md`

## Summary

Adicionar **destinação do valor das vendas** para livros doados (Missões, Espaço…), sem tocar no fluxo do PDV nem no lançamento de entrada. O modelo central: **"Loja" é a destinação padrão do sistema e o saldo livre (físico − carimbos) é o resíduo que pertence a ela**; carimbos (`destinacao_saldo`) são a camada contábil por cima do estoque físico único. Pontos-chave:

1. **Fluxo em dois passos, reusando o que existe**: livros doados entram pelo **lançamento normal** (custo digitado, ex. R$ 0,00); a destinação é definida depois pela **transferência** ("Destinar estoque": livre → Missões etc.) — único mecanismo de criação de carimbos, auditável em `transferencia_destinacao`. Zero mudança em `lancamento_entrada`.
2. **Carimbo tem prioridade de venda**: a venda consome carimbos na ordem do cadastro (**Loja sempre primeiro** — a própria Loja é carimbável, ex. "10 para cobrir custos") e por último o saldo livre. Perdas, ajustes negativos e estornos de entrada fazem o **inverso** (livre primeiro), protegendo o compromisso com o doador — e dispensando qualquer guard extra no cancelamento de lançamentos.
3. **Alocação gravada na venda** (`alocacao_venda`, uma linha por carimbo consumido, inclusive Loja): fonte única do relatório por período, do detalhe da venda e do estorno exato. O consumo do livre não gera linha — o valor da Loja no relatório é derivado (total − Σ demais). Estorno é retroativo no relatório; cancelamento de venda ganha janela de **5 dias** (FR-011).
4. **Zero migração de dados**: estoque atual e compras normais já são livre = Loja. `m007` só cria as 4 tabelas novas e semeia "Loja" — sem rebuild, sem backfill, sem ALTERs.

A feature carrega também uma história só de UI no PDV (US4): estado de **"Caixa livre"** quando não há itens e **confirmação animada** na conclusão da venda (com total/troco, auto-dispensada e nunca bloqueante) — frontend puro, zero comandos novos, zero cliques a mais.

Cadastro de destinações é um clone estrutural do cadastro de formas de pagamento (005), com a ordem da lista definindo a ordem de baixa dos carimbos. Mantém Hexagonal (domínio Rust puro, portas/adapters, comandos Tauri, UI React). **Sem novas dependências** (memória: projeto npm-only — não mexer no lockfile).

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sea-orm-migration, sqlx-sqlite, tokio); serde; React + Vite + shadcn/ui — **sem novas deps**

**Storage**: SQLite local. **Tabelas novas**: `destinacao` (cadastro), `destinacao_saldo` (carimbo por livro × destinação), `transferencia_destinacao` (criação/remanejo de carimbos — US1) e `alocacao_venda` (item de venda × destinação, qtd + valor em centavos). **Nenhuma alteração em tabelas existentes.** Migração `m007` no migrator padrão (estilo `m005`), idempotente, semeia "Loja" (`de_sistema=1`).

**Testing**: `cargo test` — domínio puro (`alocar_venda` carimbos em ordem→livre, `alocar_perda` inversa, `validar_transferencia`, `pode_cancelar_venda` 5 dias, estornos) sem DB; repos com SQLite temporário (transferência com guards, consumo em venda/ajuste/contagem/estorno de lançamento, estorno de venda devolve ao carimbo certo, relatório + posição fecham com o total); Vitest na UI (tela de transferência, badges no detalhe, caixa livre/animação).

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: registrar doação completa (entrada normal + destinar) em < 3 min (SC-001); uma transferência em < 30 s (SC-006); relatório por destinação + posição atual em segundos (SC-003); PDV sem passo adicional (SC-002).

**Constraints**: offline; ≤ 300 linhas significativas/arquivo; migração idempotente por comando; consumo de saldos e gravação de alocações **na mesma transação** de cada fluxo (invariante: Σ carimbos de um livro ≤ estoque físico); FKs não enforced em runtime (memória) → guards de "em uso"/"saldo suficiente" explícitos via SQL; unicidade de nome normalizada (caixa/acentos/trim — mesma regra da 005); dinheiro em centavos; termos pt-BR exatos ("Destinação", "Destinar estoque", "Loja", "Missões", "Caixa livre").

**Scale/Scope**: poucas destinações (< 10); transferências esporádicas (dezenas/ano); alocações na ordem de grandeza dos itens de venda; toca domínio → persistência → comandos → UI (detalhe do livro na Pesquisa, detalhe de venda, relatórios, nova tela de cadastro, PDV visual); mono-usuário.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | Regras puras em `domain/destinacao.rs` (alocação venda/perda com as duas ordens, validação de transferência, janela de 5 dias) testáveis sem DB. Nova porta `DestinacaoRepo`; consumo transacional fica nos adapters. UI não tem regra. | ✅ PASS |
| II. KISS & DRY / YAGNI | Sem nota de doação: entrada reusa o lançamento normal e a transferência é o **único** mecanismo de carimbo (uma origem para auditar). "Livre como resíduo da Loja" elimina migração de dados. Alocação só para carimbo consumido (esparso, como `pagamento_pedido`). Sem cadastro de doadores, sem multi-almoxarifado físico, sem drill-down na posição (YAGNI). Cadastro reusa a estrutura da 005. | ✅ PASS |
| III. ≤300 linhas/arquivo | Consumo/alocação/transferência em `destinacao_sql.rs` próprio; CRUD em `destinacao_repo.rs`; casos de uso em `application/destinacoes.rs`; UI em componentes novos (`DestinacoesLista`, `DestinarEstoque`, `VendaConcluida`). | ✅ PASS (verificável por hook) |
| IV. Migrations por comando & idempotência | `m007` no migrator padrão: só `CREATE TABLE IF NOT EXISTS` + seed de "Loja" com `WHERE NOT EXISTS` — nenhum ALTER, nenhum backfill. Re-aplicável sem efeito duplo. Importador do legado intocado (vendas antigas = Loja por definição). | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | **ADR-0014** (destinação como resíduo + carimbos com prioridade de venda; transferência como origem única; estorno de entrada como perda; janela de 5 dias). Hook de 300 linhas e skills `dinheiro-em-centavos` / `entidade-orm-fora-do-dominio` vigentes. | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Vocabulário do usuário: "Destinação", "Destinar estoque", "Loja" (o default, nome dado pelo usuário), "Missões", "Espaço", "Caixa livre". PDV e lançamentos inalterados em fluxo. Valores `R$` em centavos. | ✅ PASS |

**Resultado**: nenhuma violação. **Risco principal**: espalhamento do consumo de saldos pelos caminhos de saída (venda, ajuste, contagem, estorno de lançamento) — mitigado por um único helper transacional (`consumir_carimbos`, com modo venda/perda) compartilhado, com testes de repo cobrindo cada caminho + estornos e o invariante Σ carimbos ≤ físico.

## Project Structure

### Documentation (this feature)

```text
specs/006-destinacao-doacoes/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1–D9 (base do ADR-0014)
├── data-model.md        # Phase 1 — esquema destinacao/saldo/transferencia/alocacao + m007
├── quickstart.md        # Phase 1 — validação ponta a ponta (entrada → destinar → venda → relatório)
├── contracts/
│   └── tauri-commands.md # Phase 1 — comandos invoke novos/alterados
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas sobre a 005

```text
src-tauri/src/
├── migration/
│   └── mod.rs                        # ALTERADO — + mod m007_destinacoes (estilo m005: CREATE IF NOT
│                                     #   EXISTS × 4 + seed "Loja"; sem ALTERs)
├── domain/
│   ├── destinacao.rs                 # NOVO — Destinacao {id,nome,de_sistema,ativa,ordem}; validações puras
│   │                                 #   (nome, pode_excluir/desativar/reordenar); alocar_venda (carimbos em
│   │                                 #   ordem, Loja 1º → livre); alocar_perda (livre → carimbos);
│   │                                 #   validar_transferencia; inversos p/ estorno
│   └── pedido.rs                     # ALTERADO (mínimo) — pode_cancelar_venda(data_venda, hoje) ≤ 5 dias
├── application/
│   ├── ports_destinacao.rs           # NOVO — trait DestinacaoRepo (CRUD, em_uso, saldos, transferir,
│   │                                 #   relatório+posição) + tipos de alocação
│   ├── destinacoes.rs                # NOVO — casos de uso: CRUD com guards (Loja protegida, nome
│   │                                 #   normalizado, excluir só sem uso), transferir, relatório por período
│   └── venda.rs / (cancelamento)     # ALTERADO — guard dos 5 dias no cancelamento de venda
├── adapters/persistencia/
│   ├── entities/destinacao.rs        # NOVO (SeaORM: destinacao, destinacao_saldo, alocacao_venda,
│   │                                 #   transferencia_destinacao — módulos pequenos)
│   ├── destinacao_repo.rs            # NOVO — SeaDestinacaoRepo (CRUD, em_uso, saldos/histórico por livro)
│   ├── destinacao_sql.rs             # NOVO — helpers transacionais: consumir_carimbos (modo venda/perda),
│   │                                 #   devolver (estorno de venda), transferir, gravar/ler alocacao_venda,
│   │                                 #   relatório por período + posição atual
│   ├── pedido_repo.rs                # ALTERADO — registrar: consome carimbos + grava alocações na transação
│   │                                 #   da venda; cancelar: guard 5 dias + devolve pelas alocações
│   ├── estoque_repo.rs / inventario_repo.rs / lancamento_sql.rs # ALTERADO — ajuste negativo, contagem p/
│   │                                 #   baixo e estorno de lançamento consomem carimbos (modo perda)
│   └── relatorio_repo.rs             # ALTERADO — detalhe da venda inclui alocações por item
├── commands_destinacao.rs            # NOVO — CRUD destinações + transferir/saldos/histórico +
│                                     #   relatorio_destinacoes(inicio, fim) com posição atual
├── commands.rs                       # ALTERADO — venda_cancelar com erro 'venda_antiga'
└── lib.rs                            # ALTERADO — registra handlers novos

src/ (UI React)
├── routes/
│   ├── Destinacoes.tsx               # NOVO — tela de cadastro (clone estrutural de FormasPagamento.tsx)
│   ├── Pesquisa.tsx                  # ALTERADO — ação "Destinar estoque" no livro
│   ├── ListaVendas.tsx               # ALTERADO — detalhe da venda exibe distribuição por destinação
│   │                                 #   (badges); erro claro ao cancelar venda > 5 dias
│   └── Relatorios.tsx                # ALTERADO — visão "Por destinação" (período + posição atual)
├── components/
│   ├── DestinacoesLista.tsx          # NOVO — lista/reordena/ativa/exclui (padrão FormasPagamentoLista)
│   ├── DestinacaoForm.tsx            # NOVO — criar/renomear
│   ├── DestinarEstoque.tsx           # NOVO — dialog no livro: saldos + transferência + histórico (US1)
│   ├── Pdv.tsx / CarrinhoItens.tsx   # ALTERADO — estado "Caixa livre" quando sem itens (US4, só frontend)
│   └── VendaConcluida.tsx            # NOVO — confirmação animada de conclusão (total/troco; auto-dispensa,
│                                     #   descartada por bipagem — nunca bloqueia a próxima venda) (US4)
├── lib/
│   ├── ipc_destinacoes.ts            # NOVO — bindings (CRUD, transferir, saldos, relatório)
│   └── types.ts                      # ALTERADO — Destinacao, SaldoLivro, Transferencia, AlocacaoVenda
└── components/AppSidebar.tsx         # ALTERADO — entrada para o cadastro de destinações

docs/adr/0014-destinacao-doacoes.md   # NOVO — resíduo + carimbos com prioridade, transferência como origem
                                      #   única, estorno de entrada como perda, janela de 5 dias
```

**Structure Decision**: Desktop Hexagonal (mesma das 001–005). A novidade estrutural é a **camada de saldos carimbados** ao lado do razão de movimentos: o razão continua sendo a verdade do estoque físico; `destinacao_saldo` é a verdade do carimbo; `transferencia_destinacao` e `alocacao_venda` são as verdades de origem e consumo. Tudo atualizado na mesma transação de cada operação, com um único helper de consumo (duas ordens: venda e perda) para não duplicar regra.

**Sequenciamento recomendado** (idealmente commits separados): (a) `m007` + domínio puro (`destinacao.rs`, janela de 5 dias) com testes verdes; (b) cadastro completo (porta, repo, casos de uso, comandos, tela — US3); (c) transferência "Destinar estoque" (US1); (d) consumo na venda/ajuste/contagem/estorno de lançamento + estorno de venda com guard de 5 dias (FR-008..012); (e) relatório + posição atual + detalhe da venda (US2); (f) caixa livre + confirmação animada no PDV (US4, independente — pode ir a qualquer momento); (g) ADR-0014.

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável. O ponto de atenção é a **consistência transacional** entre físico, carimbos e alocações nos fluxos de escrita (transferência, venda, ajuste, contagem, estorno de lançamento) e seus estornos — coberto por helper único de consumo/devolução e testes de repo dedicados por fluxo, incluindo o invariante Σ carimbos ≤ estoque físico.
