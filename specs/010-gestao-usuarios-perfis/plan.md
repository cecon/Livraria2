# Implementation Plan: Gestão de usuários com perfis (operador/admin) e controle de acesso

**Branch**: `010-gestao-usuarios-perfis` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-gestao-usuarios-perfis/spec.md`

## Summary

Adicionar **perfil** (`operador` | `admin`) à identidade unificada da tabela `usuario` (ADR-0019) e a
**UI de gestão** (criar/editar/redefinir senha/desativar) no Escritório, aplicando a regra de acesso:
**operador → só PDV; admin → PDV + Escritório**. A regra de acesso vira **função pura no domínio**
(`crates/livraria-domain`), reusada nativamente pelo PDV e via WASM (`@livraria/domain`) pelo Escritório
(DRY, Princípio II). Conclui o que ficou pendente do ADR-0019: **sincronização do `senha_hash` (+ perfil)
para o PDV** por caminho protegido e **definição de senha** central. O PDV segue autenticando **offline**
(qualquer perfil entra); o Escritório rejeita `operador`. Ao sincronizar, o PDV **encerra a sessão** de
usuário desativado/rebaixado (FR-018).

## Technical Context

**Language/Version**: Rust (domínio + PDV Tauri 2; crate `livraria-domain` compila nativo e `wasm32`),
TypeScript + React 19 (Escritório Next.js 15; PDV Vite). Postgres (Supabase) + SQLite (réplica PDV).

**Primary Dependencies**: SeaORM + SQLite; `bcrypt` (ADR-0019, hash forte); `@livraria/domain` (WASM) e
`@livraria/ui` (shadcn) no Escritório; `@supabase/ssr`; `pgcrypto` na nuvem (bcrypt/sha256 nas RPCs).

**Storage**: `usuario` (chave natural `usuario`; `senha_hash`, `nome`, novo `perfil`, `excluido_em`).
SQLite local no PDV + espelho Postgres na nuvem. Perfil e senha **sincronizam** (caminho protegido).

**Testing**: `cargo test` (regra de acesso no domínio + `verificar_senha` + migração idempotente);
validação manual do Escritório via quickstart (login por perfil + CRUD).

**Target Platform**: Desktop Windows (Tauri, offline-first) + Web (Next.js no Portainer Swarm) + WASM.

**Project Type**: Híbrido em workspace npm (`apps/*`, `packages/*`) + workspace Cargo (`crates/*`,
`src-tauri`). Sem novo serviço.

**Performance Goals**: N/A crítico (base pequena — 1 livraria, poucos usuários). Login < 1s.

**Constraints**: **offline-first do PDV** (login local sem internet); **≤300 linhas/arquivo** (Princípio
III); **migrations idempotentes por comando** (Princípio IV); **segredos fora do repo** (Notion);
pt-BR; senha nunca em texto claro (só redefinível).

**Scale/Scope**: Poucos usuários (1+ admin, N operadores). UI: 1 tela de listagem + 1 form de usuário.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Hexagonal/Domínio isolado**: ✅ a **regra de acesso** (`pode_acessar_escritorio`,
  `pode_acessar_pdv`) e o enum `Perfil` entram em `crates/livraria-domain/src/usuario.rs` (puro, sem
  SeaORM/Tauri/HTTP). Adapters (PDV/Escritório/nuvem) só orquestram.
- **II — KISS/DRY/YAGNI**: ✅ **uma** fonte de verdade da regra de acesso (domínio → nativo + WASM).
  Reusa a infra do ADR-0019 (login por `usuario`, RPC de auth, sessão compartilhada). Sem papéis
  hipotéticos além de operador/admin (YAGNI). Sem nova camada de permissão intra-PDV (FR-017).
- **III — ≤300 linhas**: ✅ regra de arquivos: módulo de domínio pequeno; UI do Escritório dividida em
  `lista` + `form`; RPCs curtas. Hook de guardrail valida.
- **IV — Migrations idempotentes por comando**: ✅ coluna `perfil` via migração idempotente **local**
  (`m010`, padrão "ignora duplicate column") e **nuvem** (`0006_*.sql`, `add column if not exists`).
  Backfill: usuários existentes → `admin` por default no bootstrap? **Não** — ver research (default é
  `operador`, e o `adm` é promovido a `admin`).
- **V — Vocabulário pt-BR**: ✅ termos "usuário", "operador", "admin", "perfil", "senha". Mensagens pt-BR.
- **VI — Governança/ADR**: ✅ estende o ADR-0019 (sem novo ADR obrigatório; a regra de perfil é
  incremento coerente). Registrar nota no ADR-0019 se necessário.

**Resultado**: sem violações → **Complexity Tracking vazio**.

## Project Structure

### Documentation (this feature)

```text
specs/010-gestao-usuarios-perfis/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1 (RPCs da nuvem + domínio + contrato de UI)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
crates/livraria-domain/src/
└── usuario.rs                    # NOVO: enum Perfil + regras de acesso (puro; nativo + WASM)

packages/domain/                  # WASM regenerado expõe Perfil/regras ao Escritório

src-tauri/src/
├── migration/m010.rs             # NOVO: coluna usuario.perfil (idempotente)
├── adapters/persistencia/
│   ├── usuario_repo.rs           # autenticar já usa verificar_senha (ADR-0019); expõe perfil
│   └── replica_mapa.rs           # usuario: incluir `perfil` (e `senha_hash`) no sync
└── commands.rs / commands_sync.rs# expõe perfil + encerrar sessão no sync (FR-018)

apps/nuvem/migrations/
├── 0006_usuario_perfil.sql       # NOVO: coluna perfil + índice
└── 0007_rpc_usuarios.sql         # NOVO: autenticar_usuario→perfil, definir_senha_usuario,
                                  #        criar/editar/desativar (SECURITY DEFINER), sync_pull_usuarios

apps/escritorio/app/
├── usuarios/                     # NOVO: lista + form de usuários (admin-only)
├── api/login/route.ts            # gate: rejeita perfil sem acesso ao Escritório (regra via WASM)
└── (middleware)                  # inalterado (sessão compartilhada)
```

**Structure Decision**: workspace híbrido existente. A regra de acesso mora no **domínio** (reuso
nativo+WASM). Persistência de `perfil`/`senha` acompanha a mecânica de sync do ADR-0019 (chave natural
`usuario`, LWW por `atualizado_em`), com o hash trafegando só por caminho protegido (RPC).

## Complexity Tracking

> Sem violações de constituição — nada a justificar.
