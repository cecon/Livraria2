# Contrato — RPCs da nuvem (Postgres/Supabase)

Todas `SECURITY DEFINER`, `search_path = public, extensions`. Escrita sensível (senha/perfil) só por
aqui. Migrações `0006`/`0007`.

## Autenticação (leitura)

### `autenticar_usuario(p_usuario text, p_senha text) → text`
- Retorna o **`perfil`** (`'operador'` | `'admin'`) se a credencial confere **e** o usuário está ativo
  (`excluido_em IS NULL`); caso contrário **NULL**.
- Dupla verificação: bcrypt (`$2…`) via `crypt`; senão SHA-256 legado.
- `GRANT EXECUTE ... TO anon, authenticated`.
- **Muda o contrato atual** (hoje retorna boolean — ADR-0019): passa a retornar texto. O `/api/login`
  do Escritório trata NULL como falha e aplica `pode_acessar_escritorio(perfil)` (regra do domínio/WASM).

## Escrita (admin-only)

Assinatura comum: recebem `p_admin text` (usuário admin da sessão) e **validam** que ele é `admin`
ativo antes de agir; erro se não for. Retornam `void`/linha afetada. `GRANT EXECUTE ... TO authenticated`.

### `criar_usuario(p_admin text, p_usuario text, p_nome text, p_senha text, p_perfil text) → void`
- Erro se `p_usuario` já existe (INV-1) ou `p_senha` < mínimo (INV-4) ou `p_perfil` inválido.
- Grava `senha_hash = crypt(p_senha, gen_salt('bf'))`, `perfil`, `atualizado_em = now()`, `sync_uid`.

### `editar_usuario(p_admin text, p_usuario text, p_nome text, p_perfil text) → void`
- Não altera senha. Se rebaixaria o **último admin** ativo (INV-2) → erro.

### `definir_senha_usuario(p_admin text, p_usuario text, p_senha text) → void`
- Erro se `p_senha` < mínimo. Regrava só `senha_hash` + `atualizado_em`.

### `desativar_usuario(p_admin text, p_usuario text) → void`
- Preenche `excluido_em = now()`. Se for o **último admin** ativo (INV-2) → erro.

## Sincronização (pull protegido do PDV — D6)

### `sync_pull_usuarios(p_cursor timestamptz) → setof (…, senha_hash, perfil)`
- Retorna linhas de `usuario` com `sincronizado_em > p_cursor`, **incluindo `senha_hash` e `perfil`**.
- Existe porque `SELECT (senha_hash)` fica **revogado** de `anon, authenticated` — o `select *` do pull
  genérico não devolve mais o hash. `GRANT EXECUTE ... TO authenticated` (papel do PDV).

## Proteção de coluna

```
REVOKE SELECT (senha_hash) ON public.usuario FROM anon, authenticated;
```
- Leitura normal de `usuario` (Escritório) segue por colunas explícitas (`usuario, nome, perfil,
  sync_uid, excluido_em`) — nunca `senha_hash`.
