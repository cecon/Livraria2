# Implementation Plan: Escritório — cancelar/reabrir venda com estorno fiel e uso no celular

**Branch**: `011-escritorio-cancelamento-responsivo` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-escritorio-cancelamento-responsivo/spec.md`

## Summary

Duas frentes independentes:
1. **Cancelar/reabrir venda no Escritório** com paridade do PDV: uma **RPC transacional na nuvem**
   (`cancelar_venda`, `SECURITY DEFINER`) faz, numa transação atômica e idempotente, o **estorno de
   estoque** + a **devolução de carimbos** de destinação + marca `pedido.cancelado`, respeitando a
   **janela de 5 dias** (regra única do domínio). O estorno tem **identidade determinística por pedido**
   (`sync_uid` = uuidv5 do pedido/livro), então cancelar concorrentemente no PDV e na nuvem converge
   para **um** estorno (idempotência **através do sync**). **Reabrir** = cancelar + abrir o clone no
   caixa do Escritório.
2. **Responsivo (base única)**: adaptar o layout atual da retaguarda com breakpoints — sidebar
   recolhível, grids de 4 col → 1–2, tabelas → cards no mobile — sem telas duplicadas, reusando
   `@livraria/ui`.

## Technical Context

**Language/Version**: Postgres (Supabase) — RPC `plpgsql SECURITY DEFINER`; Rust (PDV + domínio
`livraria-domain` nativo/WASM); TypeScript + React 19 (Escritório Next.js 15 + `@livraria/ui` shadcn).

**Primary Dependencies**: regra de domínio `pode_cancelar_venda` (janela 5 dias, já no WASM);
`@livraria/domain`; `movimento_estoque`/`alocacao_venda`/`transferencia_destinacao`/`pedido` (já na
nuvem); Tailwind (breakpoints) no Escritório.

**Storage**: nuvem Postgres (espelho) + SQLite (réplica PDV). Estorno = **eventos append-only**;
`pedido.cancelado` = **mutável (LWW)**; carimbos via `transferencia_destinacao`/`alocacao_venda`.

**Testing**: `cargo test` (domínio: janela; conformância **nativo (PDV) ↔ SQL (nuvem)** do estorno);
teste de idempotência do estorno (rodar 2×, cancelar concorrente → 1 estorno); validação responsiva por
viewport (quickstart).

**Target Platform**: Web (Next.js, **desktop + celular**), Postgres, Rust/WASM.

**Project Type**: Híbrido em workspace (apps/*, packages/*, crates/*, src-tauri).

**Performance Goals**: venda no celular < 2 min (SC-007); cancelamento é operação pontual.

**Constraints**: **offline-first do PDV** (o PDV cancela sem nuvem); **≤300 linhas/arquivo**;
**migrations/RPC idempotentes**; **sem rolagem horizontal no celular**; pt-BR; dinheiro em centavos.

**Scale/Scope**: base pequena. UI: ajustes responsivos nas ~10 telas + lista de vendas com ações.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Hexagonal/Domínio**: ✅ a **regra de janela** (`pode_cancelar_venda`) fica no domínio
  (já existe, WASM). A **orquestração** do estorno vive nos adapters (RPC da nuvem; repo do PDV).
- **II — KISS/DRY/YAGNI**: ⚠️ **tensão de DRY conhecida** — a *mecânica* de estorno + devolução de
  carimbo existe em **dois adapters**: Rust (`estornar_saidas`/`devolver_alocacoes_pedido`, PDV offline)
  e SQL (nova RPC da nuvem). Não é duplicação de **regra de negócio** (a regra — janela, "estornar até
  net 0", idempotência — é a mesma), mas de **mecânica de persistência** entre dois runtimes que não
  compartilham código (Postgres ≠ SQLite). Mitigação: **testes de conformância** garantindo que os dois
  produzem o mesmo efeito (padrão já usado na 009 nativo↔WASM). → **Complexity Tracking** abaixo.
- **III — ≤300 linhas**: ✅ RPC enxuta; UI da lista/ações e o responsivo divididos em componentes.
- **IV — Idempotência por comando**: ✅ RPC idempotente (`net<0`/`cancelado` guard + `sync_uid`
  determinístico); qualquer objeto novo na nuvem via `create or replace`/`if not exists`.
- **V — pt-BR**: ✅ "cancelar", "reabrir", "estorno", "carimbo", "turno".
- **VI — Governança/ADR**: registrar a decisão do estorno determinístico como nota no ADR-0016
  (identidade determinística p/ eventos idempotentes através do sync).

**Resultado**: uma violação **justificada** (DRY da mecânica de estorno) → ver Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/011-escritorio-cancelamento-responsivo/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/         # RPC cancelar_venda + contrato de UI (lista/ações + responsivo)
└── tasks.md           # (/speckit-tasks)
```

### Source Code (repository root)

```text
crates/livraria-domain/src/
└── pedido.rs                        # pode_cancelar_venda (janela 5 dias) — JÁ EXISTE, reusar

apps/nuvem/migrations/
└── 0011_cancelar_venda.sql          # NOVO: RPC cancelar_venda (SECURITY DEFINER, atômica,
                                    #        estorno + carimbo + cancelado + sync_uid determinístico)
                                    #        (0001–0010 ocupados; 0010_turno é da 009)

apps/escritorio/
├── lib/nuvem/venda.ts               # + cancelarVenda(pedido), reabrirVenda(pedido)
├── app/venda/page.tsx               # lista de vendas: ações Cancelar / Reabrir (janela via WASM)
├── components/AppSidebar.tsx        # sidebar recolhível (drawer no mobile)
├── app/layout.tsx / globals.css     # shell responsivo (sidebar off-canvas < md)
└── (telas)                          # grids 4→1-2 col; tabelas → cards no mobile (breakpoints)

src-tauri/src/adapters/persistencia/
└── pedido_sql.rs                    # estorno passa a usar sync_uid DETERMINÍSTICO (paridade c/ a RPC)
```

**Structure Decision**: workspace existente. A **regra** (janela) é única no domínio; a **mecânica** de
estorno é espelhada Rust↔SQL com conformância. O responsivo é ajuste de layout na base única.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Mecânica de estorno/carimbo duplicada em Rust (PDV) e SQL (RPC nuvem) | O PDV **cancela offline** (precisa de Rust/SQLite) e o Escritório usa a **nuvem** (RPC Postgres) — os dois runtimes não compartilham código executável | "Só na nuvem" quebra o offline do PDV; "só no PDV" tira o cancelamento da retaguarda (o pedido desta feature). Regra de negócio continua única (domínio); só a mecânica de persistência é espelhada, com **testes de conformância** garantindo paridade. |
