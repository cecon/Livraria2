---
description: "Task list — feature 010: gestão de usuários com perfis"
---
# Tasks: Gestão de usuários com perfis (operador/admin) e controle de acesso

**Input**: Design de `/specs/010-gestao-usuarios-perfis/` (plan, spec, research, data-model, contracts, quickstart)
**Prerequisites**: ADR-0019 parcialmente implementado (identidade unificada, hash bcrypt, RPC de auth, sessão compartilhada do Escritório)
**Tests**: incluídos só onde a constituição já exige (domínio puro testável). Sem TDD de UI.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3
- Caminhos de arquivo explícitos.

---

## Phase 1: Setup

- [X] T001 Criar branch `010-gestao-usuarios-perfis` a partir do `main` atualizado (workspace instalado: `npm ci`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Propósito**: base compartilhada por todas as histórias — regra de acesso (domínio), coluna `perfil` e a sincronização de `senha_hash`+`perfil` para o PDV (conclui o Stage 3 do ADR-0019). **Nenhuma US começa antes disto.**

- [X] T002 [P] Domínio: criar `crates/livraria-domain/src/usuario.rs` com `enum Perfil {Operador,Admin}`, `from_str` (desconhecido→Operador), `as_str`, `pode_acessar_pdv(perfil,ativo)`, `pode_acessar_escritorio(perfil,ativo)`, `e_ultimo_admin_ativo(qtd)`; registrar `pub mod usuario;` em `crates/livraria-domain/src/lib.rs`.
- [X] T003 [P] Domínio: testes unitários em `crates/livraria-domain/src/usuario.rs` (operador↔escritório negado; admin↔ambos; desativado negado; último admin) — validar com `cargo test -p livraria-domain usuario`.
- [ ] T004 WASM: expor `Perfil` + regras via wrappers `#[wasm_bindgen]` (padrão da 008) e **regenerar** `packages/domain` (`index.js`/`index.d.ts`/`index_bg.wasm`).
- [X] T005 Migração local **`m010`**: `src-tauri/src/migration/m010.rs` — `ALTER TABLE usuario ADD COLUMN perfil TEXT NOT NULL DEFAULT 'operador'` (idempotente: ignora "duplicate column") + `UPDATE usuario SET perfil='admin' WHERE usuario='adm'`; registrar em `src-tauri/src/migration/mod.rs`.
- [X] T006 Migração nuvem `apps/nuvem/migrations/0006_usuario_perfil.sql`: `add column if not exists perfil text not null default 'operador'` + `update usuario set perfil='admin' where usuario='adm'`; **aplicar** em produção (Management API).
- [ ] T007 Nuvem `apps/nuvem/migrations/0007_rpc_usuarios.sql` (parte sync/proteção): `REVOKE SELECT (senha_hash) ON public.usuario FROM anon, authenticated` + RPC `sync_pull_usuarios(p_cursor timestamptz)` `SECURITY DEFINER` retornando linhas com `senha_hash`+`perfil`; `GRANT EXECUTE ... TO authenticated`; **aplicar**.
- [ ] T008 PDV sync: `src-tauri/src/adapters/persistencia/replica_mapa.rs` — incluir `perfil` (e `senha_hash`) nas colunas sincronizadas de `usuario`; e `src-tauri/src/adapters/nuvem/supabase_sync.rs` — pull de `usuario` via `sync_pull_usuarios` (não mais `select *`).
- [X] T009 PDV entity: `src-tauri/src/adapters/persistencia/entities/usuario.rs` ganha `perfil: String`; `usuario_repo` carrega/expõe o perfil (autenticação inalterada — ambos os perfis entram, FR-017).

**Checkpoint**: `cargo test --lib` + `cargo test -p livraria-domain` verdes; PDV sincroniza `usuario` com `perfil`/`senha_hash` sem quebrar; nuvem tem `perfil` e o hash protegido.

---

## Phase 3: User Story 1 — Admin cadastra usuário com perfil e senha (P1) 🎯 MVP

**Goal**: um admin cria um usuário (identificador, nome, senha, perfil) que passa a logar onde o perfil permite, com a mesma credencial em PDV e Escritório.
**Independent Test**: criar `caixa1` (operador) e `gerente` (admin); `caixa1` loga no PDV (offline pós-sync), `gerente` nos dois.

- [X] T010 [US1] Nuvem (`0007`): RPC `criar_usuario(p_admin,p_usuario,p_nome,p_senha,p_perfil)` `SECURITY DEFINER` — valida admin ativo (chamador), unicidade (INV-1), senha ≥ mínimo (INV-4), perfil válido; grava `senha_hash=crypt(p_senha,gen_salt('bf'))`, `perfil`, `atualizado_em`, `sync_uid`; **aplicar**.
- [X] T011 [US1] Nuvem (`0007`): RPC `definir_senha_usuario(p_admin,p_usuario,p_senha)` `SECURITY DEFINER` (admin ativo; senha ≥ mínimo; regrava só `senha_hash`+`atualizado_em`); **aplicar**.
- [X] T012 [P] [US1] Escritório: `apps/escritorio/app/usuarios/page.tsx` — lista de usuários (Usuário · Nome · Perfil · Estado) lendo **colunas explícitas** (nunca `senha_hash`); estados vazio/carregando/erro; botão "Novo usuário".
- [X] T013 [US1] Escritório: `apps/escritorio/app/usuarios/form-usuario.tsx` (form/modal de criação) — campos usuário/nome/perfil(radio)/senha; chama `criar_usuario`; validação client (usuário obrigatório, senha ≥ mínimo) + mensagens pt-BR.
- [ ] T014 [US1] Verificar US1 — cadastro pela UI ✅ (SC-001, hash bcrypt, login ok); **login do novo usuário no PDV offline pende T008** (sync do senha_hash).

**Checkpoint**: um admin cadastra usuários com perfil e senha; eles logam conforme o perfil. **MVP entregável.**

---

## Phase 4: User Story 2 — Acesso por perfil (P1)

**Goal**: operador só entra no PDV; admin entra em PDV e Escritório; desativado não entra em lugar nenhum.
**Independent Test**: com `caixa1` (operador) e `gerente` (admin) prontos, logar cada um no PDV e no Escritório e conferir o gate.

- [X] T015 [US2] Nuvem (`0007`): alterar `autenticar_usuario(p_usuario,p_senha)` para **retornar `perfil` (texto) / NULL** (era boolean) — mantém dupla verificação bcrypt/SHA-256 e `excluido_em IS NULL`; **aplicar**. ⚠️ **Deployar junto com T016** (ver Notas de coordenação): o Escritório em produção espera boolean.
- [X] T016 [US2] Escritório: `apps/escritorio/app/api/login/route.ts` — usa o `perfil` retornado + `pode_acessar_escritorio(perfil)` (via `@livraria/domain` WASM); NULL ou operador → **403 genérico** (FR-013); admin → abre sessão compartilhada (ADR-0019) + `app_user`.
- [X] T017 [US2] Escritório: garantir que a área `/usuarios` (e mutações) só é acessível logado (sessão = admin); reforço de rota. `apps/escritorio/app/usuarios/`.
- [X] T018 [US2] PDV: confirmar que login local aceita **ambos** os perfis (FR-017) e carrega o `perfil` para exibição; ajuste/checagem em `src-tauri` (comando de login/estado do operador).
- [X] T019 [US2] Verificar US2 pelo `quickstart.md` (operador barrado no Escritório — SC-002; entra no PDV; desativado barrado em ambos).

**Checkpoint**: regra de acesso por perfil valendo nos dois sistemas.

---

## Phase 5: User Story 3 — Gestão de usuários existentes (P2)

**Goal**: admin edita nome/perfil, redefine senha, desativa/reativa; sistema protege o último admin; sessão do PDV cai ao sincronizar desativação.
**Independent Test**: sobre usuários existentes, alterar perfil, redefinir senha, desativar; e tentar rebaixar/desativar o último admin (bloqueado).

- [ ] T020 [US3] Nuvem (`0007`): RPCs `editar_usuario(p_admin,p_usuario,p_nome,p_perfil)` e `desativar_usuario(p_admin,p_usuario)` `SECURITY DEFINER` com **guarda do último admin** (INV-2: bloquear rebaixar/desativar se `count(admins ativos)==1`); **aplicar**.
- [ ] T021 [P] [US3] Escritório: ações na lista/form (`apps/escritorio/app/usuarios/`) — **Editar** (nome/perfil), **Redefinir senha** (chama `definir_senha_usuario`), **Desativar/Reativar**; desabilitar rebaixar/desativar o último admin com motivo (reforçado pela RPC).
- [ ] T022 [US3] PDV: após cada sincronização, se o **operador logado** ficou `excluido_em IS NOT NULL` → **logout forçado** e volta à seleção de operador (FR-018/D7). `src-tauri` (fluxo pós-sync + estado do operador).
- [ ] T023 [US3] Verificar US3 pelo `quickstart.md` (redefinir senha; promover operador→admin; bloquear último admin — SC-005; histórico de venda preservado — SC-006).

**Checkpoint**: ciclo de vida completo do usuário, com invariante do último admin garantido no ponto de escrita.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T024 [P] Registrar a conclusão do **Stage 3 do ADR-0019** (sync do `senha_hash` protegido) + o incremento de `perfil` — nota no `docs/adr/0019-*.md` (ou ADR novo se o time preferir).
- [ ] T025 [P] Guardrail ≤300 linhas (`scripts/check-file-size.sh`) nos arquivos novos; dividir UI (lista/form) se estourar. Conferir também que **nenhum log/telemetria emite a senha** em texto (SC-004/FR-012).
- [ ] T026 [P] Idempotência (Princípio IV): re-aplicar `m010` e `0006`/`0007` em base já migrada — sem erro, sem duplicar, sem perder dados.
- [ ] T027 Passagem completa do `quickstart.md` (SC-001..006) + `cargo test --lib`/`cargo test -p livraria-domain` + build do Escritório (`npm run build -w apps/escritorio`).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T009)** bloqueiam tudo.
- Dentro do Foundational: `T002→T003→T004` (domínio→testes→WASM) em uma trilha; `T005`/`T006`/`T007` (migrações) em paralelo; `T008`/`T009` (sync PDV) dependem de `T006`/`T007`.
- **US1 (P1)** e **US2 (P1)** podem correr **em paralelo** após o Foundational (US2 depende do domínio+WASM T002/T004; US1 do sync T008/T009). São o **MVP**.
- **US3 (P2)** depende da UI base da US1 (T012/T013) + `T020`.
- **Polish** por último.

## Parallel Opportunities

- `T002` + `T003` (domínio + testes) — mesma trilha, mas testes junto.
- `T005` + `T006` + `T007` (migração local, nuvem coluna, nuvem RPC/proteção) — arquivos distintos.
- `T012` (lista) em paralelo com `T010`/`T011` (RPCs de escrita).
- `T021` (ações US3) e `T024`/`T025`/`T026` (polish) marcados `[P]`.

## Implementation Strategy

- **MVP = US1 + US2** (ambos P1): cadastrar usuários com perfil/senha **e** aplicar o acesso (operador→PDV, admin→ambos) — entrega o pedido central.
- Incremento seguinte: **US3** (gestão: editar/redefinir/desativar + último admin + logout forçado).
- Cada fase é testável isoladamente pelo `quickstart.md`.

## Notas de coordenação

- **Acoplamento T015 ↔ T016 (deploy atômico)**: `autenticar_usuario` muda de **boolean → texto
  (perfil)**. O Escritório **já em produção** (ADR-0019 Stage 4) espera boolean (`ok !== true`) — se a
  RPC (T015) subir sem o novo `/api/login` (T016), **o login vivo quebra**. Subir os dois juntos (ou
  T016 antes, tolerando ambos os retornos por um release).
- **Numeração**: `m010` (local) porque `m009` está reservado à feature 009 (turno). Alinhar ordem de migração com a 009 para não colidir.
- **FR-016 (atribuição preservada)**: sem código novo — o `operador` no `pedido` e o soft-delete já
  existem; a task de verificação (T023) confirma que desativar preserva o histórico.
- **Sem novos segredos**: reusa `ESCRITORIO_EMAIL/SENHA` (Notion). As RPCs não expõem hash.
