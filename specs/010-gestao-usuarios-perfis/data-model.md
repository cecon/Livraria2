# Data Model — Gestão de usuários com perfis (feature 010)

## Entidade: Usuário

Identidade única compartilhada entre PDV e Escritório (ADR-0019). Esta feature **adiciona** `perfil`.

| Campo | Tipo | Regras |
|---|---|---|
| `usuario` | texto | **Chave natural** (única). Identificador de login. Não muda. |
| `nome` | texto? | Nome de exibição. Opcional. |
| `senha_hash` | texto | Hash **bcrypt** (`$2…`) ou **SHA-256 legado** (migração). Nunca em texto claro; nunca lido pelo cliente (D6). Vazio = sem senha definida → não loga. |
| `perfil` | enum texto | **NOVO**. `operador` \| `admin`. `NOT NULL DEFAULT 'operador'`. |
| `excluido_em` | timestamp? | Soft-delete. Preenchido = **desativado** (não loga em lugar nenhum). |
| `atualizado_em` | timestamp? | LWW do sync (tempo do servidor). |
| `sync_uid` | uuid | Identidade de sync (ADR-0016). |

### Estados

- **Ativo** (`excluido_em IS NULL`): pode logar conforme o perfil.
- **Desativado** (`excluido_em` preenchido): não loga em nenhum sistema; histórico preservado.

Transições (todas por admin, via RPC — D5/D8):
- criar → Ativo (`operador` ou `admin`)
- editar perfil: `operador ↔ admin` (bloqueado se rebaixaria o **último admin** ativo — D8)
- redefinir senha: novo `senha_hash` (a senha antiga deixa de valer)
- desativar: Ativo → Desativado (bloqueado se for o **último admin** ativo)

### Invariantes

- **INV-1** (FR-011): `usuario` único.
- **INV-2** (FR-014): `count(perfil='admin' AND excluido_em IS NULL) >= 1` sempre.
- **INV-3** (FR-012): `senha_hash` nunca sai do Postgres para o cliente (só via RPCs SECURITY DEFINER).
- **INV-4** (FR-015): senha definida deve ter comprimento mínimo (default 4) — validado na RPC de escrita.

## Regras de acesso (domínio puro — `crates/livraria-domain/src/usuario.rs`)

Fonte **única** da regra (Princípio II), reusada nativo (PDV) e WASM (Escritório):

```
enum Perfil { Operador, Admin }

pode_acessar_pdv(perfil, ativo)        = ativo                    // ambos os perfis (FR-003/004/017)
pode_acessar_escritorio(perfil, ativo) = ativo && perfil==Admin   // só admin (FR-004)
e_ultimo_admin(perfis_ativos)          = conta admins ativos == 1 // guarda do último admin (FR-014/INV-2)
```

- Parsing tolerante: valor desconhecido/nulo de `perfil` ⇒ tratar como `Operador` (fail-safe: menor
  privilégio). Testes unitários cobrem operador/admin/ativo/desativado/último-admin.

## Sincronização (ADR-0016/0019)

- `usuario` é **cadastro** (LWW por `atualizado_em`, chave natural `usuario`).
- Passam a sincronizar: `perfil` (novo) e `senha_hash` (D6). O **pull do PDV** para `usuario` usa a RPC
  protegida `sync_pull_usuarios` (não o `select *`), pois `senha_hash` fica com `SELECT` revogado.
- `criar/editar/desativar/definir_senha` no Escritório → gravam na nuvem → descem ao PDV pelo sync.

## Impacto de migração (idempotente — Princípio IV)

- **Local `m010`** (SQLite): `ALTER TABLE usuario ADD COLUMN perfil TEXT NOT NULL DEFAULT 'operador'`
  (ignora "duplicate column" ao re-aplicar); `UPDATE usuario SET perfil='admin' WHERE usuario='adm'`.
- **Nuvem `0006`** (Postgres): `add column if not exists perfil text not null default 'operador'`;
  `update usuario set perfil='admin' where usuario='adm'`.
- Backfill idempotente; sem perda de dados; re-execução estável.
