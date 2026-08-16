//! Comandos Tauri do turno de operacao.

use crate::adapters::maquina::MaquinaSistema;
use crate::adapters::persistencia::turno_repo::SeaTurnoRepo;
use crate::application::ports::Maquina;
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
    /// Operador que abriu e PC do turno (feature 013, FR-015/FR-021).
    pub operador: String,
    pub maquina: String,
}

impl From<crate::application::ports_turno::TurnoAbertoInfo> for TurnoAbertoDto {
    fn from(t: crate::application::ports_turno::TurnoAbertoInfo) -> Self {
        TurnoAbertoDto {
            sync_uid: t.sync_uid,
            caixa_inicial_centavos: t.caixa_inicial_centavos,
            abertura: t.abertura,
            operador: t.operador,
            maquina: t.maquina.unwrap_or_default(),
        }
    }
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

/// Estado do turno desta máquina (FR-017): um único aberto por PDV, seja qual
/// for o operador logado. Sem argumentos — a identidade é o PC, não o usuário.
#[tauri::command]
pub async fn turno_aberto(state: tauri::State<'_, AppState>) -> Result<Option<TurnoAbertoDto>, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    Ok(turno::aberto(&repo, &MaquinaSistema).await?.map(TurnoAbertoDto::from))
}

/// Nome do PC (FR-021) — o header mostra mesmo sem turno aberto.
#[tauri::command]
pub fn maquina_nome() -> String {
    MaquinaSistema.nome()
}

/// Abre um turno **ou continua** no que já está aberto nesta máquina (FR-002/FR-017).
#[tauri::command]
pub async fn turno_abrir(
    state: tauri::State<'_, AppState>,
    operador: String,
    caixa_inicial_centavos: i64,
) -> Result<TurnoAbertoDto, ErroDto> {
    let repo = SeaTurnoRepo::new(state.db.clone());
    let t = turno::abrir_ou_continuar(&repo, &MaquinaSistema, &operador, caixa_inicial_centavos).await?;
    Ok(TurnoAbertoDto::from(t))
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

/// Vendas do turno aberto (feature 013, FR-022) — a tela inicial usa o MESMO
/// cartão de venda do relatório, então devolve o mesmo formato. `cancelavel` sai
/// do domínio: é o turno aberto desta máquina que manda (FR-003).
#[tauri::command]
pub async fn vendas_do_turno(
    state: tauri::State<'_, AppState>,
    turno_uid: String,
) -> Result<Vec<crate::application::ports::PedidoRelatorio>, ErroDto> {
    use crate::application::ports::RelatorioRepo;
    let repo = crate::adapters::persistencia::relatorio_repo::SeaRelatorioRepo::new(state.db.clone());
    let turnos = SeaTurnoRepo::new(state.db.clone());
    let aberto = turno::aberto(&turnos, &MaquinaSistema).await?;
    let mut vendas = repo
        .vendas_do_turno(&turno_uid)
        .await
        .map_err(crate::application::erros::ErroApp::from)?;
    for v in &mut vendas {
        v.cancelavel = crate::domain::turno_operacao::pode_cancelar(
            v.turno_uid.as_deref(),
            aberto.as_ref().map(|t| t.sync_uid.as_str()),
        );
    }
    Ok(vendas)
}
