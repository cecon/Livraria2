# Contrato — Domínio (regra de acesso) e UI do Escritório

## Domínio puro — `crates/livraria-domain/src/usuario.rs`

Fonte única da regra (Princípio II), compilada nativo (PDV) e `wasm32` (`@livraria/domain`, Escritório).

```
pub enum Perfil { Operador, Admin }
impl Perfil {
    pub fn from_str(s: &str) -> Perfil        // desconhecido/vazio ⇒ Operador (fail-safe)
    pub fn as_str(&self) -> &'static str      // "operador" | "admin"
}

pub fn pode_acessar_pdv(perfil: Perfil, ativo: bool) -> bool          // = ativo
pub fn pode_acessar_escritorio(perfil: Perfil, ativo: bool) -> bool   // = ativo && perfil==Admin
pub fn e_ultimo_admin_ativo(qtd_admins_ativos: u32) -> bool           // = qtd == 1
```

- Exportar ao WASM (wrappers `#[wasm_bindgen]` no crate, como os já existentes da 008).
- **Testes unitários** (cargo): operador↔escritório negado; admin↔ambos; desativado negado em ambos;
  último admin.

## UI do Escritório — `apps/escritorio/app/usuarios/`

**Acesso**: só `admin` (a rota checa a sessão; middleware + verificação de perfil). Operador logado
nunca chega aqui (nem entra no Escritório — FR-010/FR-003).

### Tela: Lista de usuários (`/usuarios`)
- Tabela: **Usuário · Nome · Perfil · Estado (Ativo/Desativado) · Ações**.
- Ações por linha: **Editar** (nome/perfil), **Redefinir senha**, **Desativar/Reativar**.
- Botão **Novo usuário**.
- Estados: vazio ("nenhum usuário"), carregando, erro. Nunca exibe `senha_hash` (não é lida).

### Tela/Modal: Form de usuário
- Campos: `usuário` (só na criação; imutável depois), `nome`, `perfil` (radio operador/admin), `senha`
  (na criação; em edição, botão separado "Redefinir senha").
- Validação client + server (RPC): usuário único, senha ≥ mínimo, perfil válido.
- Guarda do **último admin**: UI desabilita rebaixar/desativar o último admin e mostra o motivo; a RPC
  reforça (não confiar só na UI).
- Mensagens de erro pt-BR, genéricas onde for segurança (FR-013).

### Login (ajuste em `apps/escritorio/app/api/login/route.ts`)
- `autenticar_usuario` → `perfil` (ou NULL). Se NULL **ou** `!pode_acessar_escritorio(perfil, true)`
  (via WASM) → 403 "Usuário ou senha inválidos, ou sem acesso ao escritório." (genérica).
- Sucesso → abre a sessão compartilhada (ADR-0019) e grava `app_user` = usuário admin.

## PDV (Rust) — ajustes

- `usuario_repo::autenticar` já usa `verificar_senha` (ADR-0019) — **inalterado** (ambos os perfis
  entram; FR-017). Passa a **carregar o `perfil`** junto (exibição).
- `replica_mapa.rs`: `usuario` inclui `perfil` (e `senha_hash`) no sync; pull via `sync_pull_usuarios`.
- Pós-sync: se o **operador logado** ficou `excluido_em IS NOT NULL` → **logout forçado** (FR-018/D7).
