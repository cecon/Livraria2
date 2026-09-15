//! Portas da sincronização com a nuvem (feature 007, ADR-0015/0016).
//!
//! O desenho separa duas bordas (o contrato inicial falava em um `SyncPort` só,
//! mas o adapter da nuvem não pode ler o SQLite — furaria o hexágono):
//! - [`NuvemRepo`]: I/O remoto (adapter Supabase/PostgREST).
//! - [`ReplicaLocalRepo`]: leitura/gravação da réplica local (adapter SeaORM),
//!   incluindo o **remap** de FKs por `sync_uid` (ids locais ↔ `*_uid`).
//! O caso de uso `application/sincronizacao.rs` orquestra as duas + o domínio.

use crate::application::ports::RepoErro;
use async_trait::async_trait;
use std::collections::HashSet;

/// Registro sincronizável genérico. `dados` carrega as colunas de negócio **já no
/// formato da nuvem** — as referências a pais vêm como `*_uid` (o remap de/para o
/// id local é responsabilidade do [`ReplicaLocalRepo`]).
#[derive(Debug, Clone)]
pub struct RegistroSync {
    pub recurso: String,
    pub sync_uid: String,
    pub atualizado_em: Option<String>,
    pub excluido_em: Option<String>,
    pub dados: serde_json::Value,
}

/// Lote retornado por um pull, com o cursor avançado (tempo do servidor, D9).
#[derive(Debug, Clone)]
pub struct LotePull {
    pub registros: Vec<RegistroSync>,
    pub novo_cursor: String,
}

/// Resultado de um push de um recurso.
#[derive(Debug, Clone, Default)]
pub struct ResumoPush {
    pub enviados: usize,
    /// `sync_uid`s isolados por serem órfãos (FK ausente) — não abortam o lote (D11).
    pub orfas: Vec<String>,
}

/// Porta da **nuvem** (hub). Implementada pelo adapter Supabase via PostgREST/HTTPS.
/// Só I/O remoto; não conhece o SQLite local.
#[async_trait]
pub trait NuvemRepo: Send + Sync {
    /// Upsert idempotente por `sync_uid` (`Prefer: resolution=merge-duplicates`).
    async fn upsert(&self, recurso: &str, registros: &[RegistroSync]) -> Result<(), RepoErro>;

    /// Busca os registros de `recurso` com `sincronizado_em > cursor` (ordem do
    /// servidor), retornando o novo cursor.
    async fn buscar_desde(&self, recurso: &str, cursor: &str) -> Result<LotePull, RepoErro>;

    /// Tempo confiável do servidor (ISO-8601 UTC) para carimbar `atualizado_em`/cursor.
    async fn agora_servidor(&self) -> Result<String, RepoErro>;
}

/// Porta da **réplica local** (PDV). Implementada pelo adapter SeaORM. Faz o
/// remap de FKs (`livro_id` ↔ `livro_uid`) ao produzir/aplicar registros.
#[async_trait]
pub trait ReplicaLocalRepo: Send + Sync {
    /// Registros locais pendentes de push (`sincronizado_em IS NULL`), já no
    /// formato da nuvem (refs por `*_uid`).
    async fn pendentes(&self, recurso: &str) -> Result<Vec<RegistroSync>, RepoErro>;

    /// Marca como sincronizados os `sync_uid`s enviados, com o carimbo do servidor.
    async fn marcar_sincronizado(
        &self,
        recurso: &str,
        uids: &[String],
        quando: &str,
    ) -> Result<(), RepoErro>;

    /// Aplica um lote vindo da nuvem: upsert por `sync_uid` com LWW/soft-delete,
    /// resolvendo `*_uid` → id local.
    async fn aplicar(&self, recurso: &str, registros: &[RegistroSync]) -> Result<(), RepoErro>;

    /// `sync_uid`s conhecidos de um recurso — usado para detectar órfãs (pais
    /// ausentes) antes do push.
    async fn uids_conhecidos(&self, recurso: &str) -> Result<HashSet<String>, RepoErro>;

    /// Cursor de pull salvo em `sync_cursor` para o recurso (vazio se nunca sincronizou).
    async fn cursor(&self, recurso: &str) -> Result<String, RepoErro>;

    /// Persiste o cursor de pull do recurso.
    async fn salvar_cursor(&self, recurso: &str, cursor: &str) -> Result<(), RepoErro>;

    /// Recomputa os derivados (saldo, `custo_medio`) dos livros afetados por um
    /// conjunto de movimentos aplicados (fold do ledger — ADR-0009).
    async fn recomputar_derivados(&self, livros_uid: &[String]) -> Result<(), RepoErro>;
}
