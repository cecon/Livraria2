# Implementation Plan: Operações de balcão na nuvem — Turno, Venda e Inventário

**Branch**: `009-turno-venda-inventario` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-turno-venda-inventario/spec.md`

## Summary

A feature 008 deixou a **retaguarda** do Escritório idêntica ao PDV e montou a **fundação** (domínio Rust → crate + WASM `@livraria/domain`, `@livraria/ui`, workspace, CI do WASM). Falta a **operação de balcão na nuvem**: **turno de operação** (abrir → vender → encerrar com fechamento de caixa), **venda completa** (checkout) e **inventário** (contagem física com reconciliação) — mais as **pendências da 008** (export de relatórios + testes).

A abordagem é a mesma que já provou paridade na 008 e permanece sob os invariantes da constituição:

1. **Regra única no domínio (DRY)** — a única regra de negócio **nova** é o **turno de operação**: entra como entidade pura `TurnoOperacao` em `crates/livraria-domain/src/turno_operacao.rs` (ADR-0021). Venda e inventário **já têm** as regras no domínio (`pedido::validar_conclusao`/`troco`, `estoque::clamp_baixa_venda`, `inventario::{ModoInventario,contagem_efetiva,resumir}`) — o Escritório **reusa**, não reescreve. **Gap de fronteira**: hoje o WASM só expõe estoque/custo/formatação; falta **expor via WASM** (a) a **validação de conclusão da venda** + troco (métodos de `Pedido`) e (b) as **funções do turno**. Adicionar esses wrappers em `livraria-domain-wasm` é o trabalho de fronteira desta feature (a regra permanece única no domínio).
2. **UI espelhada** — as telas novas do Escritório (Venda, Inventário, Abrir/Encerrar turno) replicam o fluxo do PDV com `@livraria/ui`, seguindo a lição da 008: **mesmo layout/fluxo**, não só o tema.
3. **Persistência idempotente nas duas pontas** — o turno persiste por migração **`m009`** (SQLite local) e **`0010_turno.sql`** (nuvem; `0004`/`0005` já usadas pelo #15). Ambas idempotentes.
4. **Offline preservado** — o Pedido Nº por turno é **calculável por origem** (sem alocador central), então o PDV segue vendendo offline; o Escritório é online.

## Technical Context

**Language/Version**: Rust (domínio → WASM via `wasm-bindgen`/`serde-wasm-bindgen`, target `wasm32-unknown-unknown`; build no CI por causa do Windows SAC); TypeScript 5 + React 19; Next.js 15 (App Router) no Escritório; React 19 + Vite + Tauri 2 no PDV.

**Primary Dependencies**: `@supabase/supabase-js` + `@supabase/ssr` (PostgREST/auth/RLS); `@livraria/domain` (WASM) e `@livraria/ui` (workspace, já publicados na 008); Tailwind CSS v4; shadcn/ui + `lucide-react`; leitura de câmera para o inventário via API de mídia do navegador (sem leitor dedicado, como no PDV).

**Storage**: Nuvem = Supabase Postgres (esquema-espelho da 007, chaveado por `sync_uid`, dinheiro em centavos, sem colunas de `estoque`/`custo_medio` — derivados). Local (PDV) = SQLite. **Turno de operação adiciona esquema nas duas pontas**: tabela `turno_operacao` + colunas `pedido.turno_uid`/`pedido.numero_no_turno`, via `m009` (SQLite) e `0010_turno.sql` (nuvem, mirror com `sync_uid` + colunas de sync + RLS `to authenticated`). Não há base separada do Escritório. **Inventário na nuvem NÃO cria tabelas novas**: o espelho da 007 **não mirrora** `sessao_inventario`/`item_contagem` (inventário é local do PDV; a nuvem só vê o `movimento_estoque` resultante). Logo, o Escritório roda a **sessão de contagem no cliente** (rascunho em `localStorage`, como o rascunho de venda do PDV) e, no fechamento, aplica a **reconciliação via WASM** e grava só os **ajustes** em `movimento_estoque` — que sincronizam para o PDV. A venda escreve `pedido` + `item_pedido` + `pagamento_pedido` + `movimento_estoque` (saída) + `alocacao_venda` (todas já existentes no espelho).

**Testing**: `cargo test` no domínio (roda sem UI/banco) incluindo o novo `turno_operacao` e o **fechamento de caixa** (esperado/conferido do dinheiro); testes de **conformidade** nativo↔WASM para turno/venda/inventário; testes de **ida-e-volta PDV↔nuvem**, **acesso** (autenticado) e **convergência concorrente** (pendência da 008, US4).

**Target Platform**: Escritório = navegador (container Docker já publicado). PDV = desktop Tauri (Windows). Domínio WASM roda no navegador; a regra nativa do turno roda no PDV sem mudança.

**Project Type**: Monorepo/workspace com dois front-ends (web + desktop) compartilhando núcleo (domínio Rust/WASM) e UI (`packages/ui`).

**Performance Goals**: telas operacionais respondem em <1 s em uso normal; concluir uma venda (montar carrinho → gravar) é imperceptível para o operador; o *fold* de custo/saldo por livro é O(n movimentos).

**Constraints**: **offline do PDV é invariante** (turno/venda/inventário funcionam offline no PDV; a nuvem é aditiva e online-only); **nenhum segredo administrativo** no cliente distribuído (só `publishable/anon` + login de usuário + RLS — modelo do #15); **≤300 linhas significativas** por arquivo de lógica; moeda sempre inteiro de centavos; pt-BR, busca sem acento/caixa; **numeração offline-safe** (Pedido Nº por turno, contexto por origem, sem alocador central).

**Scale/Scope**: 3 telas/fluxos novos no Escritório (Venda, Inventário, Abrir/Encerrar turno) + export nos Relatórios existentes; poucos operadores simultâneos; catálogo/estoque de porte de livraria de balcão.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Veredito | Observação |
|---|---|---|
| **I. Hexagonal & SOLID** | ✅ PASS (reforça) | Turno/venda/inventário na nuvem são **adapters** (Supabase + UI web) dirigindo **o mesmo domínio puro**. A regra nova do turno é pura; a nuvem entra por porta/adapter. |
| **II. KISS/DRY/YAGNI** | ✅ PASS | **DRY satisfeito**: venda e inventário reusam o domínio existente; a única regra nova (turno) tem **fonte única** compartilhada via WASM. Sem reescrever regra em TS. Escopo fechado (sem generalização especulativa). |
| **III. ≤300 linhas/arquivo** | ✅ PASS (gate de implementação) | Telas de Venda/Inventário do PDV são grandes → decompor no Escritório (carrinho, formas, câmera, fechamento como componentes). Hook de guardrail vigora. |
| **IV. Migrations idempotentes por comando** | ✅ PASS | `m009` (SQLite) e `0010_turno.sql` (nuvem), ambas **idempotentes** (re-aplicar não duplica); FK por `sync_uid`; pedidos legados toleram `turno_uid` nulo. Sem recompute server-side novo. |
| **V. Guardrails, Skills & ADRs** | ⚠️ AÇÃO | **ADR-0021 já registra o turno**. Ações: (a) resolver a **colisão de numeração ADR-0019** (o WASM da 008 e a identidade do #15 ambos usaram 0019) renumerando o meu para **ADR-0022**; (b) **corrigir ADR-0021** onde cita `0004_turno.sql` → **`0010_turno.sql`** (0004/0005 foram consumidas pelo #15). Nenhuma decisão arquitetural nova além do turno já decidido. |
| **VI. Fidelidade ao domínio & pt-BR** | ✅ PASS | Preserva "Pedido Nº", turno por horário (`Turno` Manhã/Tarde) **distinto** do novo `TurnoOperacao` (ADR-0021), baixa na venda, termos e rótulos exatos do PDV. |
| **Restrições técnicas & stack** | ✅ PASS | Offline do PDV preservado (numeração por origem); nuvem aditiva; auth por usuário + RLS (modelo #15); sem `service_role` no cliente. |

**Resultado do gate**: **PASS**, condicionado a: (a) renumerar meu ADR do WASM para **0022** (resolver colisão 0019); (b) corrigir a referência de migração da nuvem em ADR-0021 para **`0010_turno.sql`**; (c) respeitar ≤300 linhas nas telas novas (decompor); (d) manter `m009`/`0010_turno.sql` idempotentes. Nenhuma violação exige *Complexity Tracking* nova — a complexidade de WASM/workspace já foi paga e justificada na 008.

## Project Structure

### Documentation (this feature)

```text
specs/009-turno-venda-inventario/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões (turno no domínio, fechamento só-dinheiro, inventário parcial/total, export, testes)
├── data-model.md        # Fase 1 — TurnoOperacao + esquema m009/0006 + contratos de porta (venda/inventário/turno na nuvem)
├── quickstart.md        # Fase 1 — cenários de validação (numeração por turno, paridade de venda, inventário, export)
├── contracts/           # Fase 1 — API WASM do turno; operações Supabase (abrir/vender/encerrar/inventário); mapa de paridade de telas
└── tasks.md             # Fase 2 — /speckit-tasks (NÃO criado aqui)
```

### Source Code (repository root)

O workspace já existe (008). Esta feature **adiciona**:

```text
livraria-2/
├── crates/
│   ├── livraria-domain/
│   │   └── src/turno_operacao.rs   # NOVO: TurnoOperacao puro (abrir, pode_registrar_venda,
│   │                               #        proximo_numero, resumir_fechamento[só-dinheiro], encerrar)
│   └── livraria-domain-wasm/
│       └── src/lib.rs              # + wrappers WASM: turno (abrir/proximo_numero/fechamento/encerrar)
│                                   #   E validação de conclusão da venda + troco (métodos de Pedido)
├── packages/domain/               # wrapper TS re-exporta as novas funções do turno (regenerado pelo CI)
├── src-tauri/src/
│   ├── migration/m009.rs          # NOVO (SQLite): turno_operacao + pedido.turno_uid/numero_no_turno
│   └── …                          # comandos de venda/turno passam a exigir turno aberto (PDV)
└── apps/escritorio/
    ├── app/
    │   ├── venda/page.tsx         # NOVO: checkout (exige turno aberto) — espelha o PDV
    │   ├── inventario/page.tsx    # NOVO: contagem parcial/total (sessão no cliente) + reconciliação
    │   │                          #        → grava só ajustes em movimento_estoque (sem tabela nova)
    │   └── turnos/page.tsx        # NOVO: abrir/encerrar turno + fechamento de caixa
    ├── components/                # NOVO: Carrinho, FormasPagamento, LeitorCamera, FechamentoCaixa, ContagemInventario
    ├── lib/
    │   ├── nuvem/turno.ts         # NOVO: abrir/encerrar/consultar turno (Supabase) via domínio WASM
    │   ├── nuvem/venda.ts         # NOVO: concluir venda (baixa/custo/troco via WASM), Pedido Nº por turno
    │   ├── nuvem/inventario.ts    # NOVO: sessão de contagem + reconciliação + ajustes
    │   └── nuvem/relatorios.ts    # + export Excel/PDF/WhatsApp (pendência 008, US4)
    └── apps/nuvem/migrations/0010_turno.sql   # NOVO (nuvem): mirror turno_operacao + colunas em pedido + RLS
```

**Structure Decision**: **Workspace com núcleo compartilhado (herdado da 008)**. A regra nova (turno) mora **uma vez** no domínio e vale nas duas pontas por WASM; venda e inventário **reusam** o domínio já existente. As telas novas do Escritório são decompostas em componentes (≤300 linhas) e consomem `@livraria/ui` + `@livraria/domain`, garantindo paridade por construção.

## Complexity Tracking

> Sem novas violações a justificar. A complexidade estrutural (toolchain WASM, workspace, `packages/ui`) **já foi introduzida e justificada na 008**; esta feature apenas a **consome**. A única adição é uma entidade de domínio pura (`TurnoOperacao`) + duas migrations idempotentes — dentro dos princípios, sem exceção a registrar.

## Phases

- **Fase 0 (research.md)**: decisões e alternativas — turno como entidade pura no domínio (reuso ADR-0021); **fechamento de caixa só-dinheiro** (clarify Q1); **inventário parcial/total + reconciliação** reusando `inventario.rs` (clarify Q2); **um turno aberto por operador/origem** (clarify Q3); numeração por turno offline-safe; export de relatórios (Excel/PDF/WhatsApp); estratégia de testes ida-e-volta/acesso/concorrência; resolução das pendências de ADR (0019→0022, 0021 cita 0006). *(gerado nesta execução)*
- **Fase 1 (data-model.md, contracts/, quickstart.md)**: `TurnoOperacao` (campos, estados, funções puras) + esquema `m009`/`0010_turno.sql` (mirror por `sync_uid`); contratos de porta que o adapter web implementa (abrir/vender/encerrar, inventário); contrato da API WASM do turno; mapa de paridade das telas novas; guia de validação. *(gerado nesta execução)*
- **Fase 2 (tasks.md)**: `/speckit-tasks` — **não** criado aqui.

## Pendências de ADR a sanear (antes de implementar)

- **ADR-0022** (novo nº) — Escritório reusa o domínio via WASM: **renumeração** do meu ADR-0019 para resolver a colisão com o `0019` de identidade unificada (#15). README/índice de ADR atualizado.
- **ADR-0021 (correção)** — trocar a referência de migração da nuvem de `0004_turno.sql` para **`0010_turno.sql`** (0004/0005 já usadas pelo #15); manter o restante (entidade, numeração por turno, ciclo, convergência).
