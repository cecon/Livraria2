# Implementation Plan: Escritório espelho do PDV (paridade nuvem ↔ local)

**Branch**: `008-escritorio-espelho-pdv` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-escritorio-espelho-pdv/spec.md`

## Summary

Fazer o app **Escritório (Next.js, nuvem)** ficar **idêntico ao PDV (Vite/Tauri, local)** — mesmas telas, funções, CSS e tema — gravando direto no Supabase, sem gerar estranhamento. A restrição dura é **não duplicar regra de negócio** (DRY, não-negociável) **preservando o offline do PDV** (invariante). A abordagem que satisfaz ambos: **reusar o domínio puro** (não reescrevê-lo) e **reusar a UI** (não recriá-la):

1. **Regras de negócio** → extrair o domínio Rust puro (`src-tauri/src/domain/`) para um crate próprio `livraria-domain` e compilá-lo para **WASM**; o Escritório importa esse WASM e roda **as mesmas funções** (custo médio ordenado, dinheiro-em-centavos, validação de venda, alocação, inventário, convergência). O Escritório implementa os *ports* de persistência contra o **Supabase (PostgREST/supabase-js)**.
2. **UI/tema** → tornar o repo um **workspace** e extrair `packages/ui` (tokens `@theme` do Tailwind v4 + componentes shadcn + `cn`), consumido pelo PDV e pelo Escritório; replicar a mesma barra lateral (10 itens), rótulos e rotas.
3. **Derivados na nuvem** → `saldo` já vem de `vw_saldo_livro`; `custo_medio` é calculado **pelo mesmo domínio via WASM** (evita duplicar o *fold* numa view SQL). Sem recompute server-side novo.
4. **Turno de operação** (US4, exceção de escopo) → **entidade nova de domínio** com ciclo abrir → vender → encerrar. Numeração de **Pedido Nº por turno (1..n)**, calculável **offline** no PDV (contexto por origem, sem alocador central) → conflito-livre entre PDV/Escritório. Migrations idempotentes: **`m009` (SQLite local)** e **`0004_turno.sql` (nuvem)**. Regra do turno é **pura** → entra no `livraria-domain` e é compartilhada via WASM (DRY).

## Technical Context

**Language/Version**: Rust (domínio → WASM via `wasm-bindgen`/`serde-wasm-bindgen`, target `wasm32-unknown-unknown`); TypeScript 5 + React 19; Next.js 15 (App Router) no Escritório; React 19 + Vite + Tauri 2 no PDV.

**Primary Dependencies**: `@supabase/supabase-js` + `@supabase/ssr` (PostgREST, auth, RLS); Tailwind CSS v4 (`@tailwindcss/postcss` no Next, `@tailwindcss/vite` no PDV); shadcn/ui (radix-nova) + `lucide-react` + `clsx`/`tailwind-merge`; `wasm-pack`/`wasm-bindgen`; `next-themes` (dark mode por classe).

**Storage**: Nuvem = Supabase Postgres (esquema-espelho da feature 007, chaveado por `sync_uid`, dinheiro em centavos, sem colunas de `estoque`/`custo_medio`). Local (PDV) = SQLite. **Turno de operação adiciona esquema nas duas pontas**: tabela `turno_operacao` + colunas `pedido.turno_uid`/`pedido.numero_no_turno` — via migration idempotente `m009` (SQLite) e `0004_turno.sql` (nuvem, mirror com `sync_uid` + colunas de sync + RLS `to authenticated`). Não há base separada do Escritório.

**Testing**: `cargo test` no domínio (roda sem UI/banco — já existe); testes de conformидade que provam **paridade PDV↔WASM** (mesmo input → mesmo output do fold/validações); testes de integração do adapter Supabase (escrita evento + leitura saldo); testes de UI/visual das telas espelhadas.

**Target Platform**: Escritório = navegador (container Docker já publicado, feature 007). PDV = desktop Tauri (Windows). Domínio WASM roda no navegador (e potencialmente no PDV, sem mudança).

**Project Type**: Monorepo/workspace com dois front-ends (web + desktop) compartilhando um núcleo (domínio Rust/WASM) e uma UI (`packages/ui`).

**Performance Goals**: telas de retaguarda respondem em <1 s em uso normal; o *fold* de custo médio por livro no navegador é O(n movimentos) e deve ser imperceptível para catálogos da ordem de milhares de itens.

**Constraints**: **offline do PDV é invariante** (o domínio permanece embarcado no PDV; a nuvem é aditiva e online-only); **nenhum segredo administrativo** (`service_role`) no cliente — só `publishable/anon` + login de usuário + RLS; **≤300 linhas significativas** por arquivo de lógica (`.ts/.tsx/.rs/.css`); moeda sempre inteiro de centavos; pt-BR, busca sem acento/caixa.

**Scale/Scope**: ~10 telas espelhadas (Início, Cadastro, Pesquisa, Lançamentos, Fornecedores, Formas de Pagamento, Destinações, Inventário, Relatórios, Venda). Poucos operadores simultâneos. Catálogo/estoque de porte de uma livraria de balcão.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Veredito | Observação |
|---|---|---|
| **I. Hexagonal & SOLID** | ✅ PASS (reforça) | O Escritório é um **novo conjunto de adapters** (Supabase + UI web) dirigindo **o mesmo domínio puro**. Dependências apontam para dentro; a nuvem entra por porta/adapter. |
| **II. KISS/DRY/YAGNI** | ⚠️ PASS c/ justificativa | **DRY satisfeito**: uma única fonte de regra (domínio), sem reescrever venda/estoque/custo. Custo: toolchain WASM + workspace + `packages/ui`. Justificado em *Complexity Tracking* (as alternativas violam DRY ou o objetivo de paridade). YAGNI: escopo é só paridade. |
| **III. ≤300 linhas/arquivo** | ✅ PASS (gate de implementação) | Telas do Escritório devem ser decompostas; hook de guardrail vigora. Docs `.md` isentos. |
| **IV. Migrations idempotentes por comando** | ✅ PASS | Sem `vw_custo_medio` (fold WASM). O **Turno** exige schema novo: `m009` (SQLite) e `0004_turno.sql` (nuvem), ambos **idempotentes** (re-aplicar não duplica). Sem recompute server-side novo. |
| **V. Guardrails, Skills & ADRs** | ⚠️ AÇÃO | Requer **ADRs antes de implementar**: (0019) Escritório reusa domínio via WASM; (0020) UI compartilhada via `packages/ui`+workspace; **(0021) Turno de operação** (entidade de domínio, numeração por turno, ciclo abrir/encerrar, convergência). Refino de ADR-0017/0018 ao **elevar as regras ao domínio**. |
| **VI. Fidelidade ao domínio & pt-BR** | ✅ PASS | Paridade preserva termos, rótulos e vocabulário exatos do PDV. |
| **Restrições técnicas & stack** | ✅ PASS | Offline do PDV preservado; nuvem aditiva; auth por usuário + RLS; sem `service_role` no cliente. |

**Resultado do gate**: PASS, condicionado a (a) registrar os ADRs 0019/0020/**0021**, (b) elevar as regras ADR-0017/0018 ao domínio puro para garantir paridade, (c) respeitar o limite de 300 linhas nas novas telas, (d) manter `m009`/`0004_turno.sql` idempotentes.

## Project Structure

### Documentation (this feature)

```text
specs/008-escritorio-espelho-pdv/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões (WASM, UI compartilhada, dados na nuvem)
├── data-model.md        # Fase 1 — entidades (espelho 007) + contratos de porta do adapter web
├── quickstart.md        # Fase 1 — cenários de validação (paridade visual, funcional, ida-e-volta)
├── contracts/           # Fase 1 — UI parity, API do domínio-WASM, operações Supabase por caso de uso
└── tasks.md             # Fase 2 — /speckit-tasks (NÃO criado aqui)
```

### Source Code (repository root)

Converter o repositório em **workspace** (npm workspaces para JS; workspace Cargo para o crate de domínio):

```text
livraria-2/                     # workspace root (npm workspaces + [workspace] no Cargo)
├── crates/
│   ├── livraria-domain/        # domínio puro EXTRAÍDO de src-tauri/src/domain (serde+thiserror+std)
│   └── livraria-domain-wasm/   # wasm-bindgen: expõe o domínio p/ JS (gera pkg via wasm-pack)
├── packages/
│   ├── ui/                     # tokens @theme (Tailwind v4) + components/ui shadcn + lib/utils(cn)
│   └── domain/                 # wrapper TS do pacote WASM (tipos + API ergonômica)
├── src/                        # PDV (Vite+React+Tauri) → passa a consumir @livraria/ui + fluxo de turno
├── src-tauri/                  # shell Tauri → Cargo depende de crates/livraria-domain
│   └── src/migration/m009.rs   # NOVA migration local (SQLite): turno_operacao + pedido.turno_uid/numero_no_turno
├── apps/nuvem/migrations/
│   └── 0004_turno.sql          # NOVA migration nuvem: mirror turno_operacao + colunas em pedido + RLS
└── apps/escritorio/            # Next.js → consome @livraria/ui + @livraria/domain (WASM)
    └── app/                    # telas espelhadas: inicio, venda (exige turno), cadastro, pesquisa,
                                # lancamentos, fornecedores, formas-pagamento, destinacoes, inventario,
                                # relatorios + fluxo Abrir/Encerrar turno (fechamento de caixa)
```

**Structure Decision**: **Workspace com núcleo compartilhado**. O domínio (regra) e a UI (aparência) passam a ter **uma fonte só**, consumida pelos dois front-ends. O PDV migra o `import` do domínio para o novo crate (sem mudança de lógica) e da UI para `@livraria/ui`; o Escritório passa a importar ambos. Isso realiza a paridade "sem divergir com o tempo" (FR-015) por construção, não por disciplina.

## Complexity Tracking

> Preenchido porque o Constitution Check tem complexidade adicional a justificar (Princípio II).

| Violation / Complexidade | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Toolchain WASM** (crate extra + wasm-bindgen) | Rodar **as mesmas** regras de venda/estoque/custo no Escritório sem reescrevê-las | Reimplementar as regras em TypeScript viola o DRY **explicitamente proibido** ("duplicação de regra é proibida") e recria a divergência que "inviabilizou a tentativa anterior". |
| **Workspace / monorepo** (npm workspaces + Cargo workspace) | Pré-requisito para compartilhar `packages/ui` e o domínio entre os dois apps | Manter dois projetos isolados obriga a copiar tokens/componentes → **drift garantido**, contrariando o objetivo de paridade (SC-004, FR-015). |
| **`packages/ui` compartilhado** | UI idêntica com uma fonte de verdade visual | Copiar `index.css`+`components/ui` para o Escritório duplica os tokens e diverge a cada ajuste do PDV. |
| **Elevar regras ao domínio** (clamp de venda ADR-0018; baseline saldo inicial ADR-0017) | Garantir comportamento **idêntico** PDV↔nuvem para as duas regras hoje presas no adapter SQL | Deixar como está força o Escritório a re-implementá-las → duas fontes da mesma regra (DRY). |

## Phases

- **Fase 0 (research.md)**: decisões e alternativas — reuso do domínio via WASM; UI compartilhada + workspace; acesso a dados na nuvem (PostgREST + fold WASM para custo médio); regras a elevar ao domínio; convergência/concorrência (reuso ADR-0016); estado de conexão. *(gerado nesta execução)*
- **Fase 1 (data-model.md, contracts/, quickstart.md)**: entidades (espelho 007) e os contratos de porta que o adapter web implementa; contrato da API WASM; mapa de paridade de telas; guia de validação. *(gerado nesta execução)*
- **Fase 2 (tasks.md)**: `/speckit-tasks` — **não** criado aqui.

## ADRs requeridos (antes de implementar)

- **ADR-0019** — Escritório reusa o domínio via WASM (paridade de regra por construção; offline do PDV preservado).
- **ADR-0020** — Compartilhamento de UI via `packages/ui` + adoção de workspace.
- **ADR-0021** — Turno de operação: entidade de domínio, **Pedido Nº sequencial por turno** (contexto por origem, offline-safe), ciclo abrir/encerrar com fechamento de caixa, convergência por `sync_uid`.
- **Refino ADR-0017/0018** — mover a trava de baixa de venda e a geração de baseline de saldo inicial para funções puras do domínio.
