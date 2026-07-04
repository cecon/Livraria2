# Implementation Plan: Cadastro de formas de pagamento (Crédito, Débito, PIX Igreja)

**Branch**: `main` (feature dir: `005-formas-pagamento`) | **Date**: 2026-06-27 (rev. 2026-07-04 — clarificações da sessão 2026-07-03 integradas) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-formas-pagamento/spec.md`

## Summary

Transformar as formas de pagamento — hoje um **enum fixo + colunas largas** (`pedido.val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale`) — em um **cadastro gerenciável** (`forma_pagamento`) com vínculo por linha (`pagamento_pedido`). Isso é o que permite as três frentes do spec:

1. **Renomear "Cartão" → "Crédito"** mantendo a mesma identidade, **adicionar Débito e PIX Igreja**, e manter Dinheiro/PIX/Ministério/Vale Presente — 7 formas semeadas, todas ativas (FR-002).
2. **CRUD do cadastro na UI** (criar/renomear/reordenar/ativar-desativar; excluir só formas não-de-sistema nunca usadas) — US2/FR-005..011.
3. **Migração sem prejuízo** (US3/FR-015..017): a coluna larga vira linhas em `pagamento_pedido`, com verificação de **Σ por venda** antes/depois + `foreign_key_check`, em transação única e idempotente. Em **falha da verificação**: rollback (dados intactos) e o app **bloqueia a abertura** com mensagem clara — sem modo degradado (FR-016a).

**Decisão central**: como o usuário pode **criar** formas novas (FR-005), uma tabela de colunas fixas não tem onde guardar o valor de uma forma inventada — então o modelo passa a ser **registro (`forma_pagamento`) + junção (`pagamento_pedido`)**, e as colunas `val_*` de `pedido` são **removidas** por rebuild atômico (mesmo padrão da `m004`/ADR-0012).

**Formas "de sistema"** (chave estável, não excluíveis/desativáveis): **Dinheiro** (âncora do troco) e os alvos do importador do legado — **Crédito, PIX, Ministério, Vale Presente**. **Débito, PIX Igreja** e futuras são livres. O comportamento (troco, mapeamento do legado) prende-se à **chave**, não ao rótulo, então renomear é seguro (FR-001a, FR-013, FR-018).

Mantém Hexagonal (domínio Rust puro, portas/adapters, comandos Tauri, UI React). **Sem novas dependências** (memória: projeto npm-only — não mexer no lockfile).

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI)

**Primary Dependencies**: Tauri 2; SeaORM (+ sea-orm-migration, sqlx-sqlite, tokio); serde; React + Vite + shadcn/ui — **sem novas deps**

**Storage**: SQLite local. **Duas tabelas novas**: `forma_pagamento` (cadastro) e `pagamento_pedido` (junção venda↔forma, valor em centavos). `pedido` **perde** `val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale` (rebuild). Migração `m006` boot-applied, idempotente por estado, transação única com verificação de Σ por pedido + `foreign_key_check`.

**Testing**: `cargo test` — domínio puro (validações de forma, `Pagamentos` como lista, troco por forma) sem DB; migração `m006` com SQLite temporário populado (Σ por venda antes/depois, idempotência ao reaplicar, `foreign_key_check`); repos (forma CRUD, em_uso) e relatórios dinâmicos; Vitest na UI (venda.ts parametrizado por formas, resumo dinâmico).

**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri 2; offline, mono-estação

**Project Type**: Desktop app (Rust core + React UI), arquitetura Hexagonal

**Performance Goals**: registrar venda dividida em ≥3 formas em 1 fluxo (SC-001); CRUD de forma com efeito no PDV < 1 min (SC-004); migração de base típica (milhares de vendas) em segundos no boot.

**Constraints**: offline; ≤ 300 linhas significativas/arquivo; migração idempotente por comando; **zero perda/duplicação** de valores (transação + Σ por venda); em falha da verificação, rollback + **app bloqueia abertura** com mensagem clara (FR-016a); FKs não enforced em runtime (memória) → checagem de "em uso" e verificação da migração são **explícitas via SQL**, não confiam no banco; unicidade de rótulo por comparação **normalizada** (caixa/acentos/trim — FR-010) incluindo bloqueio de reativação conflitante (FR-007); termos pt-BR exatos.

**Scale/Scope**: milhares de vendas; 7 formas iniciais + criadas pelo usuário; refatoração atravessa domínio → persistência → comandos → UI (PDV, relatórios, lista de vendas, importador do legado) + nova tela de cadastro; mono-usuário.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal & SOLID | `FormaPagamento` vira **struct de domínio puro** com validações puras (`pode_excluir`, `pode_desativar`, nome não-vazio); `Pagamentos` vira **lista pura** `Vec<Recebimento{forma_id, valor}>`; troco resolvido por chave de sistema na borda da aplicação. Nova porta `FormaPagamentoRepo`; migração isolada no adapter. UI não tem regra. | ✅ PASS |
| II. KISS & DRY / YAGNI | Junção é o **modelo mínimo** que suporta formas criadas pelo usuário (coluna larga não suportaria) — não é over-engineering, é requisito (FR-005). Armazenamento **esparso** (só valor ≠ 0). Reusa `PaymentRow`. Conceito de "forma de sistema" evita espalhar `match` por rótulo. | ✅ PASS |
| III. ≤300 linhas/arquivo | `pedido_repo.rs` (275) + escrita/leitura de junção passaria de 300 → extrair `pagamento_pedido_sql.rs`; `relatorios.rs` resumo dinâmico → helper se necessário; `Pdv.tsx` → extrair lista de formas; cadastro em componentes próprios (`FormasPagamentoLista.tsx`, `FormaPagamentoForm.tsx`); migração `m006` em módulo próprio com helpers. | ✅ PASS (verificável por hook) |
| IV. Migrations por comando & idempotência | `m006` boot-applied, **idempotente por estado** (detecta `forma_pagamento` existente / ausência de `val_*`), **transação única**, backfill + verificação de **Σ por pedido** e global + `foreign_key_check`; semeadura determinística das 7 formas. Importador segue idempotente (ADR-0006). | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | **ADR-0013** (cadastro de formas: registro+junção, remoção das colunas `val_*`, forma de sistema por chave, estratégia de migração `m006`). Hook de 300 linhas e skill `dinheiro-em-centavos` vigentes. | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Rótulos exatos: **Crédito, Débito, Dinheiro, PIX, PIX Igreja, Ministério, Vale Presente**. Chaves estáveis em snake_case (`credito`, `pix_igreja`…). "Cartão" → "Crédito" preserva identidade. | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking não aplicável. **Risco principal**: amplitude — a forma de pagamento toca domínio, persistência, comandos, UI e importador. Mitigado por: migração com verificação de Σ por venda (não só contagem), testes de migração sobre base populada, e troco/legado amarrados a **chave estável** (renomear não quebra).

## Project Structure

### Documentation (this feature)

```text
specs/005-formas-pagamento/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões (base do ADR-0013)
├── data-model.md        # Phase 1 — esquema forma_pagamento/pagamento_pedido + passos da m006
├── quickstart.md        # Phase 1 — validação ponta a ponta (migração + CRUD + venda + relatório)
├── contracts/
│   └── tauri-commands.md # Phase 1 — comandos invoke novos/alterados
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas sobre a 004

```text
src-tauri/src/
├── migration/
│   ├── mod.rs                        # ALTERADO — `pub mod m006;`
│   └── m006.rs                       # NOVO — cria forma_pagamento + pagamento_pedido, semeia 7 formas,
│                                     #   backfill val_* → linhas, verifica Σ por pedido + global, rebuild
│                                     #   de `pedido` sem val_*, foreign_key_check (espelha m004)
├── domain/
│   ├── pagamento.rs                  # ALTERADO — FormaPagamento vira struct {id,chave,rotulo,de_sistema,ativa,ordem}
│   │                                 #   + ChaveSistema (dinheiro/credito/pix/ministerio/vale) p/ troco+legado
│   │                                 #   + validações puras (pode_excluir/pode_desativar/nome); Turno intacto
│   └── pedido.rs                     # ALTERADO — Pagamentos vira Vec<Recebimento{forma_id,valor}>; pago()=Σ;
│                                     #   troco(dinheiro_forma_id) recebe a forma de sistema "Dinheiro"
├── application/
│   ├── ports.rs                      # ALTERADO — + trait FormaPagamentoRepo; PedidoRelatorio.recebimentos dinâmico
│   ├── formas_pagamento.rs           # NOVO — casos de uso CRUD (criar/renomear/ativar/reordenar/excluir c/ guards)
│   ├── venda.rs                      # ALTERADO — PagamentosInput vira lista {formaId|chave, valor}; resolve dinheiro
│   └── relatorios.rs                 # ALTERADO — ResumoVendas dinâmico (Vec por forma, ordenado) + subtotal
├── adapters/persistencia/
│   ├── entities/forma_pagamento.rs   # NOVO
│   ├── entities/pagamento_pedido.rs  # NOVO
│   ├── entities/pedido.rs            # ALTERADO — remove val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale
│   ├── forma_pagamento_repo.rs       # NOVO — SeaFormaPagamentoRepo (listar/ativas/criar/renomear/ativa/reordenar/excluir/em_uso/por_chave)
│   ├── pagamento_pedido_sql.rs       # NOVO — escrita/leitura das linhas de pagamento (mantém pedido_repo < 300)
│   ├── pedido_repo.rs                # ALTERADO — grava/lê via pagamento_pedido_sql
│   ├── relatorio_repo.rs             # ALTERADO — vendas() junta pagamento_pedido + forma_pagamento
│   └── mod.rs                        # ALTERADO — chama crate::migration::m006::aplicar(db) após m004,
│                                     #   propagando Err (FR-016a — boot não segue em falha)
├── adapters/legado/
│   ├── mapeamentos.rs / mdb_importer.rs # ALTERADO — Pagamentos por chave (de_legado_metodo → chave → forma_id)
├── commands.rs                       # ALTERADO — registrar_venda (payload de pagamentos por lista); relatorio_vendas dinâmico
├── commands_formas.rs                # NOVO — listar/criar/renomear/ativar/reordenar/excluir formas
└── lib.rs                            # ALTERADO — registra handlers de formas; captura falha da m006 no setup
                                      #   e expõe `estado_boot` ao frontend (FR-016a)

src/ (UI React)
├── routes/
│   ├── FormasPagamento.tsx           # NOVO — tela de cadastro (ou aba dentro de Cadastro/Configurações)
│   └── ListaVendas.tsx               # ALTERADO — recebimentos dinâmicos por venda
├── components/
│   ├── Pdv.tsx                       # ALTERADO — carrega formas ativas via IPC; PaymentRow por forma; troco na forma Dinheiro
│   ├── PaymentRow.tsx                # ALTERADO (mínimo) — recebe forma genérica
│   ├── ErroMigracao.tsx              # NOVO — tela de bloqueio quando a m006 falha no boot (FR-016a):
│   │                                 #   mensagem clara, sem navegação/PDV; gate em App.tsx
│   ├── RelatoriosViews.tsx           # ALTERADO — resumo e linhas por forma dinâmicos
│   ├── FormasPagamentoLista.tsx      # NOVO — lista/reordena/ativa/exclui
│   └── FormaPagamentoForm.tsx        # NOVO — criar/renomear
├── lib/
│   ├── ipc.ts                        # ALTERADO — bindings de formas; payload de venda; ResumoVendas dinâmico
│   ├── venda.ts                      # ALTERADO — Pagamentos parametrizado pelas formas carregadas (sem FormaKey fixo)
│   └── types.ts                      # ALTERADO — remove FORMAS_PAGAMENTO/FormaKey fixo; + FormaPagamento, Recebimento
└── (App.tsx / navegação)             # ALTERADO — rota/entrada para o cadastro de formas; gate de boot:
                                      #   consulta `estado_boot` e renderiza ErroMigracao em falha (FR-016a)

docs/adr/0013-cadastro-formas-pagamento.md  # NOVO — registro+junção, remoção das val_*, forma de sistema, m006
```

**Structure Decision**: Desktop Hexagonal (mesma das 001–004). A maior amplitude é a troca do modelo de pagamento (coluna larga → registro+junção), concentrada na **migração `m006`** (rebuild atômico de `pedido` + backfill verificado) e na propagação `Pagamentos struct → lista` por domínio/aplicação/adapters/UI. O domínio permanece puro: a forma é identificada por `forma_id`/`chave` opacos; troco e legado dependem de **chave de sistema**, não de rótulo. Arquivos grandes são divididos (Princípio III).

**Sequenciamento recomendado** (idealmente commits separados): (a) `m006` + tabelas + backfill + remoção das `val_*` + testes de migração **verdes**; (b) domínio/portas/repos (Pagamentos lista, FormaPagamentoRepo); (c) comandos + IPC; (d) UI do PDV/relatórios/lista; (e) tela de cadastro (US2); (f) importador do legado por chave.

## Complexity Tracking

> Sem violações de Constitution Check. Tabela não aplicável. O risco de amplitude é mitigado por: migração em transação única com verificação de **Σ por venda** (mais forte que contagem) e `foreign_key_check`; testes de migração sobre base populada (incluindo vendas do legado); e amarração de troco/legado à **chave estável** das formas de sistema, de modo que renomear/reordenar não altera comportamento nem valores históricos.
