//! Comandos Tauri da sincronização (feature 007). Ligam o adapter da nuvem
//! (`SupabaseSync`) + a réplica local (`SeaReplicaSync`) + a orquestração.
//! Segredos (URL/ANON/EMAIL/SENHA do PDV) vêm do ambiente (ADR-0015).

use crate::adapters::nuvem::supabase_sync::SupabaseSync;
use crate::adapters::persistencia::replica_sync::SeaReplicaSync;
use crate::application::sincronizacao::{semear, sincronizar};
use crate::commands::AppState;
use crate::domain::sincronizacao::ORDEM_DEPENDENCIA;
use sea_orm::{ConnectionTrait, Statement};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumoSyncDto {
    pub enviados: usize,
    pub recebidos: usize,
    pub orfas: usize,
}

/// Dispara uma sincronização completa (push→pull→recompute). Também é chamado
/// pelo agendador em background (T041). A venda nunca bloqueia por isto.
#[tauri::command]
pub async fn sincronizar_agora(state: tauri::State<'_, AppState>) -> Result<ResumoSyncDto, String> {
    let nuvem = SupabaseSync::conectar(state.config_sync_path.as_deref()).await.map_err(|e| e.to_string())?;
    let local = SeaReplicaSync::new(state.db.clone());
    let r = sincronizar(&nuvem, &local).await.map_err(|e| e.to_string())?;
    Ok(ResumoSyncDto { enviados: r.enviados, recebidos: r.recebidos, orfas: r.orfas })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperadorDto {
    pub usuario: String,
    pub nome: Option<String>,
}

/// Lista os operadores (usuários do PDV) para o caixa escolher quem está operando
/// (FR-023). Não expõe senha.
#[tauri::command]
pub async fn listar_operadores(state: tauri::State<'_, AppState>) -> Result<Vec<OperadorDto>, String> {
    let rows = state
        .db
        .query_all(Statement::from_string(
            state.db.get_database_backend(),
            "SELECT usuario, nome FROM usuario WHERE (excluido_em IS NULL OR excluido_em='') ORDER BY usuario"
                .to_string(),
        ))
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .map(|r| OperadorDto {
            usuario: r.try_get::<String>("", "usuario").unwrap_or_default(),
            nome: r.try_get::<Option<String>>("", "nome").ok().flatten(),
        })
        .collect())
}

/// Carga inicial: sobe todo o histórico pendente para a nuvem (T028). Retorna
/// quantos registros foram enviados.
#[tauri::command]
pub async fn seed_inicial(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let nuvem = SupabaseSync::conectar(state.config_sync_path.as_deref()).await.map_err(|e| e.to_string())?;
    let local = SeaReplicaSync::new(state.db.clone());
    semear(&nuvem, &local).await.map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusSyncDto {
    /// Total de registros locais ainda não sincronizados (FR-014).
    pub pendentes: i64,
}

/// Estado de sincronização para o indicador da UI (não usa rede).
#[tauri::command]
pub async fn status_sincronizacao(state: tauri::State<'_, AppState>) -> Result<StatusSyncDto, String> {
    let backend = state.db.get_database_backend();
    let mut pendentes = 0i64;
    for recurso in ORDEM_DEPENDENCIA {
        let rows = state
            .db
            .query_all(Statement::from_string(
                backend,
                format!("SELECT COUNT(*) AS n FROM {recurso} WHERE sincronizado_em IS NULL"),
            ))
            .await
            .map_err(|e| e.to_string())?;
        pendentes += rows.first().and_then(|r| r.try_get::<i64>("", "n").ok()).unwrap_or(0);
    }
    Ok(StatusSyncDto { pendentes })
}
