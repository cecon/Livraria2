# Implementation Plan: PDV com Responsabilidade Reduzida

**Branch**: `011-pdv-responsabilidade-reduzida` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-pdv-responsabilidade-reduzida/spec.md`

## Summary

Antes de reduzir telas e responsabilidades do PDV, esta feature profissionaliza o **estoque oficial em producao na nuvem**. A nuvem passa a ser dona da baixa e do estorno de estoque derivados de vendas: uma venda marcada como completa/pronta gera movimentos oficiais de saida uma unica vez; o cancelamento estorna exatamente os movimentos da venda original; e o saldo atual de producao e preservado como saldo de partida. O PDV, depois disso, fica com responsabilidade operacional: vender offline, abrir/fechar turno e exibir um saldo local simples calculado por `saldo publicado - vendas nao sincronizadas + cancelamentos nao sincronizados`.

## Technical Context

**Language/Version**: SQL Postgres/Supabase para regras oficiais de estoque; TypeScript 5 + React 19/Next.js 15 no Escritorio; Rust/Tauri 2 no PDV; Rust dominio/WASM continua para regras puras de venda/turno quando cliente precisa validar checkout.

**Primary Dependencies**: Supabase Postgres/PostgREST/Auth/RLS; `@supabase/supabase-js`; `@livraria/domain` WASM; workspace existente `apps/escritorio`, `src-tauri`, `crates`, `packages`.

**Storage**: Nuvem = Supabase Postgres com tabelas espelho existentes (`livro`, `pedido`, `item_pedido`, `pagamento_pedido`, `movimento_estoque`) e nova migration `0011_estoque_oficial_venda.sql`. Local PDV = SQLite, preservado offline-first. Dinheiro permanece inteiro em centavos.

**Testing**: Testes SQL de migration/idempotencia em banco Supabase local ou equivalente; testes TypeScript do adapter de venda para nao gravar `movimento_estoque`; testes Rust existentes continuam para dominio/PDV; validacao manual via `quickstart.md` contra ambiente equivalente a producao.

**Target Platform**: Producao Supabase como estoque oficial; Escritorio web online; PDV desktop Windows offline-first.

**Project Type**: Monorepo com app web, app desktop e nucleo compartilhado. Esta feature e principalmente de banco/nuvem com ajustes nos adapters web/PDV.

**Performance Goals**: Venda pronta deve gerar movimentos oficiais em ate 1 ciclo transacional; reenvio da mesma venda/cancelamento nao deve duplicar movimentos; consultas de saldo por produto continuam via view em tempo aceitavel para catalogo de livraria de balcão.

**Constraints**: Preservar saldo atual de producao como baseline; migrations idempotentes; nenhum `service_role` no cliente; RLS por usuario autenticado; PDV continua vendendo offline; arquivos de logica com no maximo 300 linhas significativas; valores monetarios em centavos; pt-BR.

**Scale/Scope**: Catalogo de centenas a poucos milhares de livros, poucos operadores simultaneos, vendas de balcão offline sincronizadas posteriormente, uma base Supabase de producao ja existente.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Veredito | Observacao |
|---|---|---|
| I. Hexagonal & SOLID | PASS | A regra oficial de persistencia fica no adapter de banco/nuvem; dominio puro continua sem depender de Supabase. Clientes deixam de duplicar a baixa de estoque. |
| II. KISS/DRY/YAGNI | PASS | Centralizar venda/cancelamento para movimento no banco remove duplicacao entre Escritorio, PDV e sync. Escopo nao cria sistema fiscal ou ERP. |
| III. <=300 linhas/arquivo | PASS | Migration `0011` deve ser modular e, se ficar grande, separar helpers SQL por blocos pequenos; TS deve extrair adapters se necessario. |
| IV. Migrations idempotentes por comando | PASS | A feature e uma migration idempotente na nuvem, reexecutavel sem duplicar colunas, triggers, policies, indices ou movimentos derivados. |
| V. Guardrails, Skills & ADRs | ACAO | Registrar ADR nova para "estoque oficial na nuvem por venda pronta/cancelamento" porque muda a decisao anterior de baixa limitada ao saldo cacheado no contexto da nuvem. |
| VI. Fidelidade ao dominio & pt-BR | PASS | Mantem venda offline, Pedido No, turno, saldos e divergencias com vocabulario do dominio. |
| Restricoes tecnicas & stack | PASS | Sync com nuvem permanece aditiva; PDV nao depende de internet para vender. Segredos continuam fora do repo/cliente. |

**Resultado do gate**: PASS, condicionado a criar ADR da nova regra de estoque oficial na nuvem e a preservar o saldo de partida de producao durante a ativacao.

## Project Structure

### Documentation (this feature)

```text
specs/011-pdv-responsabilidade-reduzida/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- estoque-oficial-sql.md
|   `-- sync-pdv-saldo-local.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- nuvem/
|   `-- migrations/
|       `-- 0011_estoque_oficial_venda.sql
`-- escritorio/
    `-- lib/
        `-- nuvem/
            |-- venda.ts
            `-- estoque.ts

src-tauri/
`-- src/
    `-- adapters/
        `-- nuvem/
            `-- supabase_sync.rs

docs/
`-- adr/
    `-- 0023-estoque-oficial-nuvem-venda-pronta.md
```

**Structure Decision**: Manter o monorepo atual. A mudanca principal mora na borda de persistencia da nuvem (`apps/nuvem/migrations`). O Escritorio passa a enviar venda completa/pronta e deixa de gravar movimento oficial. O PDV continua local/offline e, em fase posterior desta feature, calcula saldo local simples a partir do saldo publicado pela nuvem e pendencias locais.

## Complexity Tracking

> Sem violacoes constitucionais novas. A complexidade de trigger/funcoes SQL e justificada por remover duplicacao de regra entre clientes e garantir idempotencia em producao, dentro da propria borda de persistencia.

## Phases

- **Phase 0 (`research.md`)**: Decisoes sobre venda pronta, idempotencia, saldo negativo, cancelamento por movimentos originais, saldo de partida de producao, divergencias e limites de trigger.
- **Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`)**: Modelar novos campos/entidades, contrato SQL da automacao, contrato de sync/saldo local do PDV e cenarios de validacao.
- **Phase 2 (`tasks.md`)**: Gerar tarefas com `/speckit-tasks`; nao criado por este comando.

## Constitution Check - Post-Design

| Principio | Veredito | Observacao |
|---|---|---|
| I. Hexagonal & SOLID | PASS | Contratos separam regra oficial de persistencia da validacao de dominio/cliente. |
| II. KISS/DRY/YAGNI | PASS | Uma unica automacao oficial para venda/cancelamento, sem recomputar historico. |
| III. <=300 linhas/arquivo | PASS | Plano explicita extracao se migration/TS ultrapassar limite. |
| IV. Migrations idempotentes por comando | PASS | Contrato exige `add column if not exists`, `create or replace function`, `drop trigger if exists` e indices unicos para dedup. |
| V. Guardrails, Skills & ADRs | ACAO | ADR-0023 deve ser criada antes ou junto da implementacao. |
| VI. Fidelidade ao dominio & pt-BR | PASS | Produto publicado, saldo local simples, divergencia e Pedido No permanecem nos termos do negocio. |

