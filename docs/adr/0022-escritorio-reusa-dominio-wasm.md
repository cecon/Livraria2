# ADR-0022 — Escritório reusa o domínio (Rust) via WebAssembly

**Status**: Aceito · **Data**: 2026-07-22

> **Nota de renumeração (feature 009)**: originalmente registrado como ADR-0019, colidiu com o
> `0019-identidade-unificada-usuario-senha-sincronizada.md` (merge da 008 × PR #15). Renumerado para
> **0022** no saneamento da 009. Referências antigas a "ADR-0019 (WASM)" apontam para este arquivo.

## Contexto
A feature 008 (specs/008-escritorio-espelho-pdv) exige que o app **Escritório** (Next.js, nuvem) execute
**as mesmas funções de negócio** do **PDV** (venda, estoque, custo médio, alocação, inventário,
convergência) — não só a mesma aparência. Duas restrições da Constituição colidem com as soluções
óbvias:
- **DRY não-negociável** (Princípio II): "duplicação de regra é proibida". Reescrever as regras em
  TypeScript no Escritório criaria **duas fontes da verdade**, exatamente o que "inviabilizou a
  tentativa anterior" (Next.js + Prisma).
- **Offline do PDV é INVARIANTE**: mover a regra para o banco (funções/triggers Postgres) faria a
  lógica depender de rede — o PDV não alcança o banco sem internet.

O domínio (`src-tauri/src/domain/`) já é **puro** (só `serde`+`thiserror`+`std`, sem I/O, sem relógio —
tempo entra como dado), portanto compilável para `wasm32-unknown-unknown` **sem mudar código**.

## Decisão (specs/008-escritorio-espelho-pdv/research.md D1, D2, D4)
- **Extrair o domínio puro** para um crate próprio `crates/livraria-domain` (hoje o crate `src-tauri`
  puxa tauri/sea-orm/reqwest/tokio, incompatíveis com wasm). O PDV passa a depender desse crate **sem
  mudança de comportamento** (coberto por `cargo test`).
- **Compilar o domínio para WASM** (`crates/livraria-domain-wasm`, `wasm-bindgen`+`serde-wasm-bindgen`)
  e consumi-lo no Escritório via o pacote TS `@livraria/domain`. O Escritório é **mais um conjunto de
  adapters** (Supabase/PostgREST + UI) dirigindo **o mesmo domínio** — Hexagonal preservado, dependência
  aponta para dentro (Princípio I).
- **Derivados na nuvem**: `saldo` vem de `vw_saldo_livro` (soma dos movimentos); `custo_medio` é
  calculado pelo **mesmo fold do domínio via WASM** (`recompor_ledger`), **sem** criar `vw_custo_medio`
  em SQL (que duplicaria a regra).
- **Elevar ao domínio** as duas regras hoje presas no adapter SQL, para que valham idênticas nas duas
  pontas: a **trava de baixa de venda** (`clamp_baixa_venda`, ADR-0018) e o **baseline de saldo inicial**
  (`baseline_saldo_inicial`, ADR-0017). O PDV passa a chamá-las (refactor sem mudança de comportamento).
- **Conformidade**: uma suíte de testes prova, para vetores de entrada, saída **idêntica** entre a
  chamada nativa (PDV) e a WASM (Escritório).

## Consequências
- **Positivas**: uma única fonte de regra (DRY); paridade PDV↔nuvem por construção; offline do PDV
  intacto (domínio embarcado); nuvem entra só por porta/adapter.
- **Custos/risco**: toolchain WASM (crate extra + wasm-pack no build); o `fold` de custo médio roda no
  navegador (O(n) por livro) — paginar telas com muitos itens; tamanho do WASM (expor só o necessário).
- **Alternativas rejeitadas**: reimplementar regras em TypeScript (viola DRY, recria divergência);
  mover a regra para funções/triggers Postgres (quebra o offline do PDV); `vw_custo_medio` em SQL
  (duplica o fold ordenado).
