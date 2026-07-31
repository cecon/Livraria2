# Implementation Plan: PDV de responsabilidade reduzida — fase 2 ("a nuvem manda")

**Branch**: `012-pdv-nuvem-manda` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-pdv-nuvem-manda/spec.md`

## Summary

Concluir a redução do PDV: ele deixa de ser **editor de cadastros** e **contador de estoque oficial**,
e passa a **consumir** o que a nuvem publica + **produzir fatos operacionais** (venda/cancelamento). A
nuvem (Postgres/RPC + escritório Next.js) vira a autoridade de: estoque oficial (já é — fase 1),
cadastros (fornecedor/forma de pagamento/destinação), **entrada de notas**, **inventário** e a
**operação de destinar estoque**. No PDV: (1) venda/cancelamento não geram mais `movimento_estoque`
oficial e o **cancelamento passa a subir** como fato (corrige o bug de produção); (2) cadastros ficam
somente-leitura; (3) entrada/inventário/destinar saem; (4) o dashboard vira a **lista de vendas do
turno aberto**. O PDV **continua offline-first** para vender e cancelar (saldo operacional derivado do
publicado + fatos locais não sincronizados).

## Technical Context

**Language/Version**: Rust (PDV core/adapters + `crates/livraria-domain` nativo/WASM); TypeScript +
React 19 (PDV UI Tauri; escritório Next.js 15 + `@livraria/ui`); Postgres (Supabase, RPC `plpgsql
SECURITY DEFINER`).

**Primary Dependencies**: sincronização (feature 007, `ORDEM_DEPENDENCIA`, `replica_mapa`/`replica_sync`);
estoque oficial na nuvem (fase 1: migrações `0011`/`0012`/`0013`, triggers de venda pronta/cancelamento,
`vw_produto_pdv`, republicação); `@livraria/domain`; retaguarda autenticada (features 008/010).

**Storage**: SQLite (réplica do PDV) — deixa de manter estoque oficial por venda/cancelamento; Postgres
(nuvem) — autoridade contábil (movimentos append-only) + cadastros (LWW) + eventos de entrada/inventário.

**Testing**: `cargo test` (domínio; conformância onde a mecânica existe dos dois lados); testes de
homologação SQL em `apps/nuvem/tests/` (idempotência de RPC/migração + republicação); `npm run build -w
apps/escritorio`; validação por viewport (as telas novas no celular, herdando a 011-escritório).

**Target Platform**: Desktop (Tauri, offline-first) + Web (Next.js, desktop+celular) + Postgres.

**Project Type**: Híbrido em workspace (`apps/*`, `packages/*`, `crates/*`, `src-tauri`, `src`).

**Performance Goals**: operação de balcão fluida (venda/cancelamento pontuais); republicação de saldo
chega ao PDV no ciclo de sync seguinte; telas da retaguarda usáveis no celular (< 2 min por tarefa).

**Constraints**: **offline-first do PDV** para venda/cancelamento (invariante); **≤300 linhas/arquivo**;
**migrations/RPC idempotentes**; pt-BR; dinheiro em centavos; nenhum segredo administrativo no cliente.

**Scale/Scope**: base pequena. Toca: PDV Rust (venda/cancelamento param de contabilizar), PDV React
(remoção de telas + dashboard novo), escritório Next.js (3 módulos novos: entrada, inventário, destinar
+ edição dos 3 cadastros), Postgres (RPCs + migração de eventos de entrada/inventário/destinar).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Hexagonal/SOLID**: ✅ As **regras** (janela de cancelamento, cálculo de saldo operacional,
  categorias, turno) seguem no domínio (`livraria-domain`). A **orquestração** vive nos adapters (RPC
  da nuvem; repositórios do PDV; rotas do escritório). Nenhuma regra nova nasce em UI/SQL sem porta.
- **II — KISS/DRY/YAGNI**: ✅ (melhora) — esta fase **remove** as trilhas de escrita do PDV (geração
  local de `saida_venda`/`estorno`, comandos de cadastro, telas de entrada/inventário/destinar),
  **reduzindo** a duplicação de mecânica que a fase 1 introduziu. A contabilidade passa a ter **uma**
  fonte (nuvem).
- **III — ≤300 linhas**: ✅ telas novas da retaguarda divididas em componentes; RPCs enxutas; reuso de
  `@livraria/ui` e das RPCs/triggers existentes.
- **IV — Idempotência por comando**: ✅ novas RPCs e migração idempotentes (`create or replace`/`if not
  exists`; eventos com `sync_uid`/identidade determinística; guardas de reprocessamento).
- **V — Guardrails/ADR**: registrar **ADR-0024** (PDV consumidor: cadastros somente-leitura +
  entrada/inventário/destinar na nuvem + cancelamento como fato). Hook de 300 linhas nos arquivos novos.
- **VI — pt-BR/domínio**: ✅ "entrada de nota", "inventário", "destinar", "turno", "carimbo",
  categorias 0–6, `R$` em centavos preservados.

**Invariante offline do PDV (Restrições Técnicas, constituição v2.0.0)**: ✅ **alinhado**. A constituição
foi **redefinida** (v2.0.0): o offline garante **venda/cancelamento/consulta** (saldo operacional =
`saldo_publicado − vendas não sincronizadas + cancelamentos não sincronizados`), e a **contabilidade
oficial** (baixa/estorno/entrada/inventário) é **responsabilidade da nuvem**. Logo, mover
entrada/inventário para a retaguarda (online) **não é mais um desvio** — é o que o invariante v2.0.0
prescreve (ADR-0023/0024). Venda/cancelamento no balcão seguem 100% offline.

**Resultado**: passa, **sem violações** (a tensão anterior foi resolvida pela redefinição do invariante
na constituição v2.0.0).

## Project Structure

### Documentation (this feature)

```text
specs/012-pdv-nuvem-manda/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/          # RPCs (entrada, inventário, destinar) + contrato do cancelamento do PDV
│                       #   + contrato da lista de vendas do turno
└── tasks.md            # (/speckit-tasks)
```

### Source Code (repository root)

```text
crates/livraria-domain/src/
├── pedido.rs                       # janela de cancelamento (reuso); saldo operacional (regra pura)
└── estoque.rs                      # (reuso) tipos de movimento

src-tauri/src/adapters/persistencia/
├── pedido_repo.rs                  # registrar: NÃO gera saida_venda nem decrementa `estoque`;
│                                   #   excluir_pedido: marca cancelado + `sincronizado_em=NULL`
│                                   #   (re-sync), sem estorno local
├── replica_mapa.rs                 # cadastros fornecedor/forma/destinação: pull-only (sem push);
│                                   #   remover specs de lancamento_entrada/item_lancamento (saem do sync)
└── (comandos)                      # remoção dos comandos de escrita de cadastro/entrada/inventário

crates/livraria-domain/src/sincronizacao.rs   # remover lancamento_entrada/item_lancamento do
                                              #   ORDEM_DEPENDENCIA + ajustar os testes de ordenação

src-tauri/src/migration/
├── m012.rs                         # DROP idempotente: item_lancamento, lancamento_entrada (entrada)
└── m013.rs                         # DROP idempotente: item_contagem, sessao_inventario (inventário)

src-tauri/src/
├── commands_dashboard.rs           # troca indicadores de estoque → lista de vendas do turno aberto
├── commands_formas.rs / *_fornec…  # comandos de escrita saem (ou viram no-op explícito)
src/components/
├── (remover/ocultar) FornecedorForm, FormaPagamentoForm, DestinacaoForm, DestinarEstoque,
│    InventarioScanner, telas de lançamento de entrada
└── ResumoCard.tsx → tela inicial = lista de vendas do turno

apps/nuvem/migrations/
├── 0014_lancar_entrada.sql        # RPC lancar_entrada (movimento 'entrada' +qtd) → republica
├── 0015_ajustar_inventario.sql    # RPC ajustar_inventario (movimento 'ajuste' = contado−saldo) → republica
└── 0016_destinar_estoque.sql      # RPC destinar_estoque (transferência livre↔carimbos) → republica

apps/escritorio/
├── app/cadastros/…                 # edição fornecedor/forma/destinação (autoridade)
├── app/entrada/…                   # lançar nota de entrada (novo)
├── app/inventario/…                # contagem/ajuste (novo, responsivo p/ balcão)
└── app/estoque/destinar/…          # destinar estoque (novo)
```

**Structure Decision**: workspace existente. As **regras** ficam no domínio; a **mecânica contábil**
concentra-se na nuvem (RPC/trigger). O PDV perde trilhas de escrita e ganha uma tela inicial mais
simples. As telas novas da retaguarda reusam `@livraria/ui` e o layout responsivo da 011-escritório.

## Complexity Tracking

*Sem violações a justificar.* A única tensão (entrada/inventário passando a exigir conexão) foi
**resolvida na fonte**: a constituição foi redefinida para **v2.0.0**, estabelecendo que a
contabilidade oficial de estoque e as funções de retaguarda vivem na nuvem, enquanto o offline do PDV
garante venda/cancelamento/consulta. Portanto não há desvio a rastrear — o design está alinhado ao
invariante vigente (ADR-0023/0024).
