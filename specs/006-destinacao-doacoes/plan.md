# Implementation Plan: Destinação de estoque para doações (contabilidade de fundos)

**Branch**: `006-destinacao-doacoes` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-destinacao-doacoes/spec.md`

## Summary

Adicionar **destinação do valor das vendas** para livros doados (Missões, Espaço…), sem tocar no fluxo do PDV. O modelo central: **"Loja" é a destinação padrão do sistema e o saldo livre (físico − carimbos) é o resíduo que pertence a ela**; carimbos (`destinacao_saldo`) são a camada contábil por cima do estoque físico único. Consequências diretas:

1. **Zero migração de dados**: estoque atual e compras normais já são livre = Loja. A migração `m007` só cria tabelas novas e colunas tolerantes — sem rebuild, sem backfill, sem verificação anti-perda (contraste deliberado com a `m006`).
2. **Carimbo tem prioridade de venda**: a venda consome carimbos na ordem do cadastro (**Loja sempre primeiro** — a própria Loja é carimbável, ex. "10 para cobrir custos") e por último o saldo livre. Perdas de inventário fazem o **inverso** (livre primeiro), protegendo o compromisso com o doador.
3. **Alocação gravada na venda** (`alocacao_venda`, uma linha por carimbo consumido, inclusive Loja): fonte única do relatório por período, do detalhe da venda e do estorno exato. O consumo do livre não gera linha — o valor da Loja no relatório é derivado (total − Σ demais).

A feature carrega também uma história só de UI no PDV (US5): estado de **"Caixa livre"** quando não há itens e **confirmação animada** na conclusão da venda (com total/troco, auto-dispensada e nunca bloqueante) — frontend puro, zero comandos novos, zero cliques a mais.

A entrada acontece por um novo **tipo de nota "Doação"** na tela de Lançamentos existente (doador opcional, destinação padrão da nota, rateio por item em quantidades), entrando no razão a **custo zero**. Para estoque **já existente**, a **transferência de destinação** (US4) move carimbos entre Livre e destinações sem tocar no físico, com registro auditável (`transferencia_destinacao`). Cadastro de destinações é um clone estrutural do cadastro de formas de pagamento (005), com a ordem da lista definindo a ordem de baixa.

Mantém Hexagonal (domínio Rust puro, portas/adapters, comandos Tauri, UI React). **Sem novas dependências** (memória: projeto npm-only — não mexer no lockfile).

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sea-orm-migration, sqlx-sqlite, tokio); serde; React + Vite + shadcn/ui — **sem novas deps**

**Storage**: SQLite local. **Tabelas novas**: `destinacao` (cadastro), `destinacao_saldo` (carimbo por livro × destinação), `alocacao_venda` (item de venda × destinação, qtd + valor em centavos), `item_lancamento_destinacao` (rateio do item da nota) e `transferencia_destinacao` (destinar estoque existente — US4). `lancamento_entrada` ganha colunas tolerantes `tipo` ('compra' default | 'doacao'), `doador`, `padrao_json`. Migração `m007` no migrator padrão (estilo `m005`), idempotente, semeia "Loja" (`de_sistema=1`).

**Testing**: `cargo test` — domínio puro (`ratear_percentual` com sobra à primeira, `validar_rateio_item`, `alocar_venda` carimbos em ordem→livre, `alocar_perda` inversa, estornos) sem DB; repos com SQLite temporário (consumo em venda/ajuste/contagem, estorno de venda devolve ao carimbo certo, guard de cancelamento de doação, relatório fecha com o total); Vitest na UI (rateio no editor, badges no detalhe).

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: lançar doação de 220 un. com rateio em < 2 min (SC-001); relatório por destinação de qualquer período em segundos (SC-003); PDV sem passo adicional (SC-002).

**Constraints**: offline; ≤ 300 linhas significativas/arquivo; migração idempotente por comando; consumo de saldos e gravação de alocações **na mesma transação** da venda/nota (invariante: Σ carimbos de um livro ≤ estoque físico); FKs não enforced em runtime (memória) → guards de "em uso"/"saldo íntegro" explícitos via SQL; unicidade de nome normalizada (caixa/acentos/trim — mesma regra da 005); dinheiro em centavos; termos pt-BR exatos ("Destinação", "Doação", "Loja", "Missões").

**Scale/Scope**: poucas destinações (< 10); doações esporádicas (dezenas/ano); alocações na ordem de grandeza dos itens de venda; toca domínio → persistência → comandos → UI (Lançamentos, detalhe de venda, relatórios, nova tela de cadastro); mono-usuário.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | Regras puras em `domain/destinacao.rs` (rateio percentual + sobra, validação de rateio por item, alocação livre→carimbos em ordem, inverso para estorno) testáveis sem DB. Nova porta `DestinacaoRepo` (+ extensão das portas de compras/estoque para rateio/alocação); consumo transacional fica nos adapters. UI não tem regra. | ✅ PASS |
| II. KISS & DRY / YAGNI | "Livre como resíduo da Loja" elimina migração de dados e carimbo redundante — é o modelo mínimo. Alocação só para carimbo consumido; livre não gera linha (esparso, como `pagamento_pedido`). Sem cadastro de doadores (texto livre), sem multi-almoxarifado físico (YAGNI — a demanda é contábil, não de localização). Cadastro reusa a estrutura da 005 (tela, guards, normalização). | ✅ PASS |
| III. ≤300 linhas/arquivo | Consumo/alocação em `destinacao_sql.rs` próprio (não incha `pedido_repo`/`estoque_sql`); CRUD em `destinacao_repo.rs`; casos de uso em `application/destinacoes.rs`; UI em componentes novos (`DestinacoesLista`, `RateioDestinacao`, editor de doação separado do `LancamentoEditor` se necessário). | ✅ PASS (verificável por hook) |
| IV. Migrations por comando & idempotência | `m007` no migrator padrão: `CREATE TABLE IF NOT EXISTS` + `ALTER` tolerante a "duplicate column" + seed de "Loja" com `WHERE NOT EXISTS`. Re-aplicável sem efeito duplo. Sem backfill (resíduo). Importador do legado intocado (vendas antigas = Loja por definição). | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | **ADR-0014** (destinação como resíduo + carimbos: por que saldo denormalizado + alocação esparsa, guard de cancelamento por saldo íntegro). Hook de 300 linhas e skills `dinheiro-em-centavos` / `entidade-orm-fora-do-dominio` vigentes. | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Vocabulário do usuário: "Destinação", "Doação", "Doador", "Loja" (o default, nome dado pelo usuário), "Missões", "Espaço". PDV inalterado (SC-002) — nenhuma mudança de comportamento visível ao operador. Valores `R$` em centavos. | ✅ PASS |

**Resultado**: nenhuma violação. **Risco principal**: espalhamento do consumo de saldos por três caminhos de saída (venda, ajuste, contagem) — mitigado por um único helper transacional (`consumir_carimbos`) compartilhado, com testes de repo cobrindo os três caminhos + estornos.

## Project Structure

### Documentation (this feature)

```text
specs/006-destinacao-doacoes/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (base do ADR-0014)
├── data-model.md        # Phase 1 — esquema destinacao/saldo/rateio/alocacao + m007
├── quickstart.md        # Phase 1 — validação ponta a ponta (doação → venda → relatório → estornos)
├── contracts/
│   └── tauri-commands.md # Phase 1 — comandos invoke novos/alterados
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas sobre a 005

```text
src-tauri/src/
├── migration/
│   └── mod.rs                        # ALTERADO — + mod m007_destinacoes (estilo m005: CREATE IF NOT EXISTS,
│                                     #   ALTERs tolerantes em lancamento_entrada, seed "Loja")
├── domain/
│   └── destinacao.rs                 # NOVO — Destinacao {id,nome,de_sistema,ativa,ordem}; validações puras
│                                     #   (nome, pode_excluir/desativar/reordenar); ratear_percentual (sobra à
│                                     #   primeira); validar_rateio_item (Σ = qtd); alocar_venda (carimbos em
│                                     #   ordem, Loja 1º → livre); alocar_perda (livre → carimbos) e inversos
├── application/
│   ├── ports_destinacao.rs           # NOVO — trait DestinacaoRepo (CRUD, em_uso, saldos) + tipos de alocação
│   ├── destinacoes.rs                # NOVO — casos de uso CRUD com guards (Loja protegida, nome normalizado,
│   │                                 #   excluir só sem uso) + relatório por período
│   └── lancamentos.rs                # ALTERADO — nota tipo 'doacao': doador, padrão da nota, rateio por item
│                                     #   (validação Σ), finalizar a custo zero + carimbos; cancelar com guard
├── adapters/persistencia/
│   ├── entities/destinacao.rs        # NOVO (SeaORM: destinacao, destinacao_saldo, alocacao_venda,
│   │                                 #   item_lancamento_destinacao — módulos pequenos)
│   ├── destinacao_repo.rs            # NOVO — SeaDestinacaoRepo (CRUD, em_uso, saldos por livro)
│   ├── destinacao_sql.rs             # NOVO — helpers transacionais: criar carimbos (finalizar doação),
│   │                                 #   consumir_carimbos (venda/ajuste/contagem), devolver (estornos),
│   │                                 #   transferir (US4), gravar/ler alocacao_venda, relatório por período
│   ├── lancamento_repo.rs / lancamento_sql.rs # ALTERADO — tipo/doador/padrão; finalizar doação a custo zero
│   │                                 #   chama destinacao_sql na MESMA transação; cancelar com guard de saldo
│   ├── pedido_repo.rs                # ALTERADO — registrar: consome carimbos + grava alocações na transação
│   │                                 #   da venda; cancelar: devolve pelos registros de alocação
│   ├── estoque_repo.rs / inventario_repo.rs # ALTERADO — ajuste negativo / diferença de contagem consomem
│   │                                 #   carimbos na mesma ordem (helper compartilhado)
│   └── relatorio_repo.rs             # ALTERADO — detalhe da venda inclui alocações por item
├── commands_destinacao.rs            # NOVO — CRUD destinações + transferir/saldos/histórico (US4)
│                                     #   + relatorio_destinacoes(inicio, fim)
├── commands_lancamento.rs            # ALTERADO — criar nota com tipo/doador/padrão; rateio do item
└── lib.rs                            # ALTERADO — registra handlers novos

src/ (UI React)
├── routes/
│   ├── Destinacoes.tsx               # NOVO — tela de cadastro (clone estrutural de FormasPagamento.tsx)
│   ├── Lancamentos.tsx               # ALTERADO — "Nova nota": escolha Compra | Doação
│   ├── ListaVendas.tsx               # ALTERADO — detalhe da venda exibe distribuição por destinação (badges)
│   └── Relatorios.tsx                # ALTERADO — visão "Por destinação" com intervalo de datas
├── components/
│   ├── DestinacoesLista.tsx          # NOVO — lista/reordena/ativa/exclui (padrão FormasPagamentoLista)
│   ├── DestinacaoForm.tsx            # NOVO — criar/renomear
│   ├── LancamentoEditor.tsx          # ALTERADO — modo doação: esconde custo, mostra doador + destinação padrão
│   ├── RateioDestinacao.tsx          # NOVO — editor de rateio do item (quantidades por destinação + validação)
│   ├── DestinarEstoque.tsx           # NOVO — dialog no livro (Pesquisa): saldos + transferência + histórico (US4)
│   ├── Pdv.tsx / CarrinhoItens.tsx   # ALTERADO — estado "Caixa livre" quando sem itens (US5, só frontend)
│   ├── VendaConcluida.tsx            # NOVO — confirmação animada de conclusão (total/troco; auto-dispensa,
│   │                                 #   descartada por bipagem — nunca bloqueia a próxima venda) (US5)
│   └── ItensNotaTabela.tsx           # ALTERADO — coluna de destinação (badges) quando nota é doação
├── lib/
│   ├── ipc_destinacoes.ts            # NOVO — bindings (CRUD, relatório)
│   ├── ipc_compras.ts                # ALTERADO — criar nota com tipo/doador/padrão; item com rateio
│   └── types.ts                      # ALTERADO — Destinacao, RateioItem, AlocacaoVenda, LancamentoDetalhe.tipo
└── components/AppSidebar.tsx         # ALTERADO — entrada para o cadastro de destinações

docs/adr/0014-destinacao-doacoes.md   # NOVO — resíduo + carimbos, alocação esparsa, guard de cancelamento
```

**Structure Decision**: Desktop Hexagonal (mesma das 001–005). A novidade estrutural é a **camada de saldos carimbados** ao lado do razão de movimentos: o razão continua sendo a verdade do estoque físico; `destinacao_saldo` é a verdade do carimbo; `alocacao_venda` é a verdade do relatório. Os três são atualizados na mesma transação de cada operação (venda, nota, ajuste, contagem), com um único helper de consumo para não duplicar a regra de ordem.

**Sequenciamento recomendado** (idealmente commits separados): (a) `m007` + domínio puro (`destinacao.rs`) com testes verdes; (b) cadastro completo (porta, repo, casos de uso, comandos, tela — US3); (c) nota de doação (entrada + carimbos + cancelamento — US1); (d) consumo na venda/ajuste/contagem + estorno de venda (FR-011..014); (e) transferência de destinação (US4); (f) relatório + detalhe da venda (US2); (g) caixa livre + confirmação animada no PDV (US5, independente — pode ir a qualquer momento); (h) ADR-0014.

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável. O ponto de atenção é a **consistência transacional** dos três registros (razão físico, carimbo, alocação) nos quatro fluxos de escrita (venda, nota de doação, ajuste, contagem) e seus estornos — coberto por helper único de consumo/devolução e testes de repo dedicados por fluxo, incluindo o invariante Σ carimbos ≤ estoque físico.
