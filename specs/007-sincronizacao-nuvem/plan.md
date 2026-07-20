# Implementation Plan: Sincronização com a nuvem (escritório + PDV offline)

**Branch**: `007-sincronizacao-nuvem` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-sincronizacao-nuvem/spec.md`

## Summary

Elevar o app (hoje offline, SQLite local, mono-estação) para **sincronizar com uma base na nuvem (Supabase/Postgres)**, permitindo que o **escritório** opere pela web (recebimento, cadastro/preço, consulta) **com o notebook desligado**, e que o **PDV** continue vendendo **sem internet**, reconciliando quando a conexão volta.

Abordagem técnica central — três pilares que tornam isso tratável sem cair no inferno do merge:

1. **Estoque já é razão de movimentos append-only** (ADR-0008/0009; `movimento_estoque` não guarda saldo). Entrada (escritório) e saída de venda (PDV) são **eventos imutáveis** de origens **disjuntas** → mesclar = unir os dois conjuntos, **sem conflito**. O saldo e o `custo_medio` são **recomputados** por fold do ledger após a merge — nunca sincronizados como número.
2. **Nuvem é o hub**; o PDV mantém o SQLite local como **réplica offline** e sincroniza deltas. O escritório é um **cliente web fino** (sempre online) que grava eventos crus direto na nuvem.
3. **Idempotência por identidade estável**: cada registro sincronizável ganha um **`sync_uid` (UUID)** imutável gerado na origem; a sincronização é **upsert por `sync_uid`** (mesmo princípio do import idempotente do legado — ADR-0006), retomável e à prova de re-execução.

Recursos mutáveis compartilhados (editáveis nos dois lados): **cadastro/preço do Livro** (dedup por código de barras) e **Fornecedor** (dedup por nome/documento) → **última edição vence** por `atualizado_em` (tempo do servidor). Deleções via **soft delete**.

> **Clarificações incorporadas (2026-07-20)** — este plano reflete as 5 respostas do `/speckit-clarify`:
> 1. **Auth por usuário** (Supabase Auth) + RLS por usuário + **autoria** nas gravações do escritório — não apenas chave `anon`.
> 2. **Escopo ampliado**: além do núcleo, sincronizam **formas de pagamento (005)**, **destinação/alocação (006)** e **fornecedores (003)**.
> 3. **Seed inicial do histórico completo** (idempotente) como passo de primeira classe.
> 4. **Dedup por chave natural**: `livro` por código de barras, `fornecedor` por nome/documento (além do `sync_uid`).
> 5. **Fornecedor** é entidade **mutável bidirecional** (mesma estratégia LWW do livro).
> 6. **Operadores do PDV** sincronizam (bidirecional, dedup por usuário) — **só identidade, `senha_hash` nunca sai do PDV**; dois espaços de identidade (retaguarda Supabase Auth × operador local). A **venda passa a registrar o operador** (`pedido.operador`).

> ⚠️ **Esta feature altera uma restrição constitucional** ("Sem backend HTTP; funcionamento offline; Dados: SQLite local"). Exige **emenda da constituição (1.0.0 → 1.1.0)** e **ADRs** antes da implementação (ver Constitution Check e Complexity Tracking). O PDV **continua offline-capable**; a nuvem é aditiva.

## Technical Context

**Language/Version**: Rust 1.93 (núcleo + adapters); TypeScript ~5.8 / React 19 (UI PDV **e** novo app do escritório)

**Primary Dependencies**: Tauri 2; SeaORM/sqlx (local); **NOVAS** — cliente HTTP Rust (`reqwest`) para falar com a API do Supabase (PostgREST) + `uuid`; no app web do escritório, `@supabase/supabase-js` + **Supabase Auth** (login por usuário) (npm). Sem TEF/impressão nova.

**Storage**: **Local** SQLite (fonte de operação offline do PDV) + **Nuvem** Supabase/Postgres (hub de merge). Espelho das tabelas sincronizáveis: `livro`, `movimento_estoque`, `pedido`/`item_pedido`, `pagamento_pedido` (005), `lancamento_entrada`/`item_lancamento`, `fornecedor` (003), `forma_pagamento` (005), `destinacao`/`transferencia_destinacao`/`alocacao_venda` (006), `usuario` (operador — **só identidade, sem `senha_hash`**). `m008` também adiciona `pedido.operador`. Derivados (saldo, `custo_medio`) recomputados, não sincronizados.

**Testing**: `cargo test` — domínio de sincronização puro (ordenação por dependência, decisão last-write-wins, detecção de órfã, convergência do fold) sem rede; adapters com Postgres/PostgREST de teste (upsert idempotente por `sync_uid`, cursor, retomada); Vitest no app do escritório.

**Target Platform**: PDV desktop (Tauri, macOS/Windows/Linux), offline-capable; escritório = navegador (web estático, hospedado no Portainer do usuário).

**Project Type**: Desktop app (Rust core + React) **+ novo cliente web** (monorepo) — deixa de ser "somente desktop".

**Performance Goals**: sincronização de rotina (volume de 1 dia) < 1 min (SC-005); indicador de estado em segundos (SC-007); PDV nunca bloqueia por sync (roda em background).

**Constraints**: PDV **offline-capable** (sync é oportunista); consistência **eventual**; ≤300 linhas/arquivo; migração idempotente por comando; **login por usuário** (Supabase Auth) + **RLS por usuário** + autoria; **credenciais fora do binário** (nunca `service_role`); dinheiro em centavos; **npm-only** (memória: não corromper o lockfile ao adicionar o app web); FKs enforced no Postgres vs. órfãs históricas locais (memória) → push/seed ordenado + isolamento de órfãs.

**Scale/Scope**: 1 PDV + 1 escritório; milhares de registros; dezenas de sincronizações/dia. Toca domínio (novo módulo sync) → aplicação (porta+caso de uso) → adapters (nuvem) → comandos → migração local → **novo app web**.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Situação | Status |
|---|---|---|
| I. Hexagonal & SOLID | Regras de merge/convergência puras em `domain/sincronizacao.rs` (testáveis sem rede/DB). Nova porta `SyncPort`; a fala com a nuvem fica **só** no adapter `adapters/nuvem`. Domínio não conhece Supabase. | ✅ PASS |
| II. KISS & DRY / YAGNI | Reusa o ledger existente (nada de motor de sync genérico). **Uma via lógica de escrita por origem** (PDV=saídas, escritório=entradas) evita resolução de conflito. Derivados recomputados por **um** fold (fonte única). Escritório grava **eventos crus** — regras de negócio NÃO são reimplementadas em TS (invariantes viram `CHECK` no schema). Web estático, sem SSR (Next.js rejeitado). | ✅ PASS |
| III. ≤300 linhas/arquivo | Sync fatiado: `domain/sincronizacao.rs` (regras), `application/sincronizacao.rs` (orquestração), `adapters/nuvem/supabase_sync.rs` (I/O), `commands_sync.rs`. App web em componentes pequenos. | ✅ PASS (hook verifica) |
| IV. Persistência idempotente por comando | Merge = **upsert por `sync_uid`** (ADR-0006 estende ao sync). Migração local `m008` só ADD COLUMN + backfill idempotente de `sync_uid`. Schema da nuvem por migração idempotente. Re-sync não duplica. | ✅ PASS |
| V. Guardrails (Hooks/Skills/ADRs) | **ADR-0015** (arquitetura de sync) e **ADR-0016** (identidade `sync_uid`, dedup e recomputação de derivados) **registrados**. Hook de 300 linhas e skills vigentes. | ✅ PASS |
| VI. Fidelidade ao domínio & pt-BR | Vocabulário mantido; escritório repete os termos de recebimento (003), estoque (002), formas de pagamento (005) e destinação (006). Valores em `R$`/centavos. | ✅ PASS |
| **Segurança / acesso** | **Login por usuário** (Supabase Auth) + **RLS por usuário** + coluna de **autoria** nas gravações do escritório (auditoria/revogação). `service_role` nunca no cliente. | ✅ PASS |
| **Restrição de stack** (nuvem/HTTP/2º app) | **Resolvido pela emenda 1.1.0**: a constituição passa a permitir sync opcional com a nuvem sob invariante de offline do PDV + login/RLS + segredos fora do binário. | ✅ PASS |

**Resultado do gate**: **PASSA**. A emenda **1.1.0** (constituição atualizada) e os **ADR-0015/0016** foram registrados; o design é conforme. Gate de governança **liberado** para `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/007-sincronizacao-nuvem/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1–D14 (base dos ADR-0015/0016 e da emenda)
├── data-model.md        # Phase 1 — colunas de sync, espelho na nuvem, outbox/cursor, recomputação
├── quickstart.md        # Phase 1 — validação ponta a ponta (offline dos dois lados → converge)
├── contracts/
│   ├── sync-port.md         # porta SyncPort + comandos Tauri de sync
│   ├── nuvem-schema.md       # tabelas/colunas na nuvem + RLS + política de acesso
│   └── escritorio-web.md     # o que o app do escritório lê/grava
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root) — deltas

```text
src-tauri/src/
├── migration/
│   └── m008.rs                   # NOVO — ADD COLUMN sync_uid/atualizado_em/excluido_em/sincronizado_em
│                                 #   em TODAS as tabelas sincronizáveis (livro, movimento, pedido/itens,
│                                 #   pagamento_pedido, fornecedor, forma_pagamento, lancamento/itens,
│                                 #   destinacao/transferencia/alocacao, usuario) + pedido.operador
│                                 #   + backfill idempotente de sync_uid + índices de dedup
│                                 #   (livro.codigo_barras, fornecedor nome/doc, usuario) + sync_cursor.
│                                 #   usuario.senha_hash FORA do sync. Só ADD/CREATE IF NOT EXISTS.
├── domain/
│   └── sincronizacao.rs          # NOVO — regras puras: ordenação por dependência (pais→filhas),
│                                 #   last-write-wins (livro/fornecedor), dedup por chave natural,
│                                 #   detecção de órfã, convergência do fold
├── application/
│   ├── ports_sync.rs             # NOVO — trait SyncPort (enviar_pendentes, puxar_desde(cursor)),
│   │                             #   trait RelogioServidor (tempo confiável), tipos de delta
│   ├── sincronizacao.rs          # NOVO — caso de uso: orquestra push→pull→recomputar derivados
│   └── seed_nuvem.rs             # NOVO — carga inicial idempotente do histórico completo p/ a nuvem
│                                 #   (ordenada pais→filhas, isola/reporta órfãs)
├── adapters/
│   └── nuvem/
│       ├── mod.rs                # NOVO
│       └── supabase_sync.rs      # NOVO — implementa SyncPort via PostgREST/HTTPS (reqwest), upsert
│                                 #   por sync_uid, autentica (token de usuário), sem service_role no binário
└── commands_sync.rs             # NOVO — comandos Tauri: sincronizar_agora, status_sincronizacao, seed_inicial

apps/                             # NOVO — monorepo passa a ter mais de um front
└── escritorio/                   # NOVO — app web estático (React + Vite + supabase-js + Supabase Auth)
    └── src/                      #   telas: Login, Recebimento (entrada), Fornecedores, Cadastro/Preço,
                                  #   Consulta (estoque/vendas), relatórios (formas de pagamento / destinação)
packages/                        # NOVO (opcional) — tipos/utilitários compartilhados PDV↔escritório
```

**Structure Decision**: mantém o núcleo Hexagonal Rust do PDV; a nuvem entra **exclusivamente** por `adapters/nuvem` atrás da porta `SyncPort` (domínio não muda de dependência). O escritório é um **app web separado** no mesmo repositório (monorepo), reaproveitando tipos/telas via `packages/`. Sincronização roda em background no PDV, disparável também sob demanda.

## Complexity Tracking

> Violações que **exigem justificativa formal** (emenda + ADR) antes de implementar.

| Violação (vs. constituição 1.0.0) | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| **Base de dados na nuvem** (contra "Dados: SQLite local") | É o único jeito de o escritório operar com o notebook **desligado** — requisito P1 da spec. | "Só SQLite local" não permite dois pontos independentes; não resolve o problema declarado. |
| **Consumo de API HTTP** (contra "Sem backend HTTP") | Sincronizar exige um ponto de encontro remoto; PostgREST + RLS evita abrir Postgres direto e vazar credenciais. | Conexão Postgres direta do binário expõe credenciais e abre a porta 5432 à internet — pior em segurança. |
| **Segundo app (web) além do Tauri** (contra "só Tauri desktop") | O escritório usa navegador; instalar Tauri no escritório não resolve "notebook desligado" (são máquinas distintas). | Reusar só o app Tauri não cobre o acesso web independente do PDV. |
| **Novas dependências** (`reqwest`, `uuid`, `supabase-js`) | Cliente HTTP e identidade global são pré-requisitos do sync. | Implementar HTTP/UUID à mão viola KISS e aumenta risco. |

**Ação de governança (gate) — CONCLUÍDA em 2026-07-20**: ✅ emenda **1.1.0** (MINOR — permite sync opcional com nuvem sob invariante de offline do PDV) + ✅ **ADR-0015** (arquitetura) e ✅ **ADR-0016** (identidade/convergência). A implementação está liberada.
