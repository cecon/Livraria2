//! Comandos Tauri do turno de operacao.

use crate::adapters::persistencia::turno_repo::SeaTurnoRepo;
use crate::application::turno;
use crate::commands::{AppState, ErroDto};
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnoAbertoDto {
    pub sync_uid: String,
    pub caixa_inicial_centavos: i64,
    pub abertura: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumoTurnoDto {
    pub qtd_vendas: i64,
    pub por_forma: Vec<(i64, i64)>,
    pub esperado_dinheiro_centavos: i64,
    pub pendencias_sync: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FechamentoDto {
    pub esperado_centavos: i64,
    pub conferido_centavos: i64,
    pub diferenca_centavos: i64,
    pub pendencias_sync: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnoHistoricoDto {
    pub abertura: String,
    pub encerramento: Option<String>,
    pub status: String,
    pub esperado_centavos: Option<i64>,
    pub conferido_centavos: Option<i64>,
    pub diferenca_centavos: Option<i64>,
}

pub async fn pendencias_sync_turno(db: &DatabaseConnection, turno_uid: &str) -> Result<i64, DbErr> {
    let backend = db.get_database_backend();
    let row = db
        .query_one(Statement::from_sql_and_values(
            backend,
            "SELECT
               (SELECT COUNT(*) FROM turno_operacao WHERE sync_uid = ? AND sincronizado_em IS NULL) +
               (SELECT COUNT(*) FROM pedido WHERE turno_uid = ? AND sincronizado_em IS NULL) +
               (SELECT COUNT(*) FROM item_pedido i JOIN pedido p ON p.numero = i.pedido_numero
                  WHERE p.turno_uid = ? AND i.sincronizado_em IS NULL) +
               (SELECT COUNT(*) FROM pagamento_pedido pp JOIN pedido p ON p.numero = pp.pedido_numero
                  WHERE p.turno_uid = ? AND pp.sincronizado_em IS NULL) AS n",
            [turno_uid.into(), turno_uid.into(), turno_uid.into(), turno_uid.into()],
        ))
        .await?;
    Ok(row.and_then(|r| r.try_get::<i64>("", "n").ok()).unwrap_or(0))
}

#[tauri::command]
pub async fn turno_aberto(state: tauri::State<'_, AppState>, operador: String) -> Result<Option<TurnoAbertoDto>, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    Ok(turno::turno_aberto(&repo, &operador).await?.map(|t| TurnoAbertoDto {
        sync_uid: t.sync_uid,
        caixa_inicial_centavos: t.caixa_inicial_centavos,
        abertura: t.abertura,
    }))
}

#[tauri::command]
pub async fn turno_abrir(
    state: tauri::State<'_, AppState>,
    operador: String,
    caixa_inicial_centavos: i64,
) -> Result<TurnoAbertoDto, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    let t = turno::abrir(&repo, &operador, caixa_inicial_centavos).await?;
    Ok(TurnoAbertoDto {
        sync_uid: t.sync_uid,
        caixa_inicial_centavos: t.caixa_inicial_centavos,
        abertura: t.abertura,
    })
}

#[tauri::command]
pub async fn turno_resumo(state: tauri::State<'_, AppState>, turno_uid: String) -> Result<ResumoTurnoDto, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    let r = turno::resumo(&repo, &turno_uid).await?;
    let pendencias = pendencias_sync_turno(&state.db, &turno_uid)
        .await
        .map_err(|e| ErroDto { codigo: "PERSISTENCIA".into(), mensagem: e.to_string() })?;
    Ok(ResumoTurnoDto {
        qtd_vendas: r.qtd_vendas,
        por_forma: r.por_forma,
        esperado_dinheiro_centavos: r.esperado_dinheiro_centavos,
        pendencias_sync: pendencias,
    })
}

#[tauri::command]
pub async fn turno_encerrar(
    state: tauri::State<'_, AppState>,
    turno_uid: String,
    conferido_centavos: i64,
) -> Result<FechamentoDto, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    let f = turno::encerrar(&repo, &turno_uid, conferido_centavos).await?;
    let pendencias = pendencias_sync_turno(&state.db, &turno_uid)
        .await
        .map_err(|e| ErroDto { codigo: "PERSISTENCIA".into(), mensagem: e.to_string() })?;
    Ok(FechamentoDto {
        esperado_centavos: f.esperado_centavos,
        conferido_centavos: f.conferido_centavos,
        diferenca_centavos: f.diferenca_centavos,
        pendencias_sync: pendencias,
    })
}

#[tauri::command]
pub async fn turno_listar(state: tauri::State<'_, AppState>, operador: String) -> Result<Vec<TurnoHistoricoDto>, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    Ok(turno::listar(&repo, &operador)
        .await?
        .into_iter()
        .map(|t| TurnoHistoricoDto {
            abertura: t.abertura,
            encerramento: t.encerramento,
            status: t.status,
            esperado_centavos: t.esperado_centavos,
            conferido_centavos: t.conferido_centavos,
            diferenca_centavos: t.diferenca_centavos,
        })
        .collect())
}
