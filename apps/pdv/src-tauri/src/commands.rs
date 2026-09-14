//! Porta de entrada Tauri: estado, DTOs de fronteira e comandos (`invoke`).
//! DTOs em camelCase espelham `src/lib/types.ts` (contracts/tauri-commands.md).

use crate::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use crate::adapters::persistencia::forma_pagamento_repo::SeaFormaPagamentoRepo;
use crate::adapters::persistencia::livro_repo::SeaLivroRepo;
use crate::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use crate::adapters::persistencia::relatorio_repo::SeaRelatorioRepo;
use crate::adapters::persistencia::turno_repo::SeaTurnoRepo;
use crate::adapters::persistencia::usuario_repo::SeaUsuarioRepo;
use crate::adapters::relogio::RelogioSistema;
use crate::application::relatorios::{self, RelatorioEstoque, RelatorioVendas};
use crate::application::erros::ErroApp;
use crate::application::ports::LivroRepo;
use crate::application::venda::VendaInput;
use crate::application::{pesquisa, turno, venda};
use crate::domain::livro::Livro;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

/// Estado compartilhado: a conexão. Os repositórios são construídos por comando
/// (DatabaseConnection é barato de clonar — Arc interno).
pub struct AppState {
    pub db: DatabaseConnection,
    /// Caminho do `sync.json` (config da nuvem) na pasta de config do app.
    /// `None` = usa só env vars (dev). Feature 007.
    pub config_sync_path: Option<std::path::PathBuf>,
}

/// Erro serializado que cruza a fronteira Tauri: `{ codigo, mensagem }`.
#[derive(Debug, Serialize)]
pub struct ErroDto {
    pub codigo: String,
    pub mensagem: String,
}

impl From<ErroApp> for ErroDto {
    fn from(e: ErroApp) -> Self {
        ErroDto {
            codigo: e.codigo(),
            mensagem: e.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LivroDto {
    pub codigo: String,
    pub titulo: String,
    pub autor: Option<String>,
    pub preco_centavos: i64,
    pub categoria: i64,
    pub estoque: i64,
    pub saldo_operacional: Option<i64>,
    pub descricao: Option<String>,
    #[serde(default)]
    pub custo_medio_centavos: i64,
}

impl From<Livro> for LivroDto {
    fn from(l: Livro) -> Self {
        LivroDto {
            codigo: l.codigo,
            titulo: l.titulo,
            autor: l.autor,
            preco_centavos: l.preco.centavos(),
            categoria: l.categoria.to_i64(),
            estoque: l.estoque,
            saldo_operacional: None,
            descricao: l.descricao,
            custo_medio_centavos: l.custo_medio.centavos(),
        }
    }
}

/// Página de livros (lista + total) para paginação no banco.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginaLivros {
    pub itens: Vec<LivroDto>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoDto {
    pub numero: i64,
    pub total_centavos: i64,
    pub troco_centavos: i64,
    pub total_itens: i64,
}


/// Próximo número de pedido (FR-017).
#[tauri::command]
pub async fn proximo_numero_pedido(state: tauri::State<'_, AppState>) -> Result<i64, ErroDto> {
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    Ok(venda::proximo_numero_pedido(&pedidos).await?)
}

/// Registra uma venda (US1, FR-015). Pagamentos por lista `{formaId, valorCentavos}`.
/// Feature 009 (FR-002/FR-003): exige um turno aberto do operador e carimba
/// `turno_uid`/`numero_no_turno` no pedido (numeração por turno, offline-safe).
#[tauri::command]
pub async fn registrar_venda(
    state: tauri::State<'_, AppState>,
    input: VendaInput,
) -> Result<PedidoDto, ErroDto> {
    let operador = input.operador.clone().unwrap_or_default();
    let turnos = SeaTurnoRepo::new(state.db.clone());
    let turno = turno::turno_aberto(&turnos, &operador)
        .await?
        .ok_or(ErroApp::Dominio(crate::domain::erros::ErroDominio::VendaSemTurno))?;
    let numero_no_turno = turno::proximo_numero_no_turno(&turnos, &turno.sync_uid).await?;

    let livros = SeaLivroRepo::new(state.db.clone());
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    let formas = SeaFormaPagamentoRepo::new(state.db.clone());
    let pedido =
        venda::registrar_venda(input, &livros, &pedidos, &formas, &RelogioSistema).await?;

    // Carimba o turno + Pedido Nº do turno no pedido recém-gravado (FR-003).
    use sea_orm::{ConnectionTrait, Statement};
    let backend = state.db.get_database_backend();
    state
        .db
        .execute(Statement::from_sql_and_values(
            backend,
            "UPDATE pedido SET turno_uid = ?, numero_no_turno = ? WHERE numero = ?",
            [turno.sync_uid.clone().into(), numero_no_turno.into(), pedido.numero.into()],
        ))
        .await
        .map_err(|e| ErroDto { codigo: "PERSISTENCIA".into(), mensagem: e.to_string() })?;

    Ok(PedidoDto {
        numero: pedido.numero,
        total_centavos: pedido.total().centavos(),
        troco_centavos: pedido.troco().centavos(),
        total_itens: pedido.total_itens(),
    })
}

/// Pesquisa por título/autor, sem acento/caixa (US3, FR-021).
#[tauri::command]
pub async fn buscar_por_texto(
    state: tauri::State<'_, AppState>,
    termo: String,
) -> Result<Vec<LivroDto>, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let ls = pesquisa::por_texto(&termo, &livros).await?;
    livros_com_saldo_operacional(&state.db, ls).await
}

/// Busca um livro pelo código de barras (US1/US2/US3).
#[tauri::command]
pub async fn livro_por_codigo(
    state: tauri::State<'_, AppState>,
    codigo: String,
) -> Result<Option<LivroDto>, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let l = livros.por_codigo(&codigo).await.map_err(ErroApp::from)?;
    match l {
        Some(livro) => Ok(Some(livro_com_saldo_operacional(&state.db, livro).await?)),
        None => Ok(None),
    }
}

async fn livro_com_saldo_operacional(db: &DatabaseConnection, livro: Livro) -> Result<LivroDto, ErroDto> {
    let saldo = SeaEstoqueRepo::new(db.clone())
        .saldo_operacional(&livro.codigo)
        .await
        .map_err(ErroApp::from)?;
    let mut dto = LivroDto::from(livro);
    dto.saldo_operacional = Some(saldo);
    Ok(dto)
}

async fn livros_com_saldo_operacional(db: &DatabaseConnection, livros: Vec<Livro>) -> Result<Vec<LivroDto>, ErroDto> {
    let mut out = Vec::with_capacity(livros.len());
    for livro in livros {
        out.push(livro_com_saldo_operacional(db, livro).await?);
    }
    Ok(out)
}



/// Autentica o gate de relatórios (US5, FR-040). Default adm/adm.
#[tauri::command]
pub async fn autenticar(
    state: tauri::State<'_, AppState>,
    usuario: String,
    senha: String,
) -> Result<bool, ErroDto> {
    let repo = SeaUsuarioRepo::new(state.db.clone());
    Ok(relatorios::autenticar(&usuario, &senha, &repo).await?)
}

/// Relatório de vendas do período (US5, FR-041/042). `periodo` = dia|manha|tarde.
/// Resumo dinâmico por forma do cadastro (FR-019).
#[tauri::command]
pub async fn relatorio_vendas(
    state: tauri::State<'_, AppState>,
    data: String,
    periodo: String,
) -> Result<RelatorioVendas, ErroDto> {
    let repo = SeaRelatorioRepo::new(state.db.clone());
    let formas = SeaFormaPagamentoRepo::new(state.db.clone());
    let destinacoes =
        crate::adapters::persistencia::destinacao_repo::SeaDestinacaoRepo::new(state.db.clone());
    Ok(relatorios::vendas(&data, &periodo, &repo, &formas, &destinacoes).await?)
}

/// Cancela uma venda inteira (pedido + itens). Bloqueado após 5 dias corridos
/// (erro VENDA_ANTIGA — FR-011 da 006); devolve estoque e carimbos.
#[tauri::command]
pub async fn excluir_pedido(
    state: tauri::State<'_, AppState>,
    numero: i64,
) -> Result<(), ErroDto> {
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    crate::application::cancelamento::cancelar_venda(numero, &pedidos, &RelogioSistema).await?;
    Ok(())
}

/// Salva bytes num arquivo no caminho escolhido pelo usuário (ex.: exportar Excel).
#[tauri::command]
pub fn salvar_arquivo(caminho: String, conteudo: Vec<u8>) -> Result<(), String> {
    std::fs::write(&caminho, &conteudo).map_err(|e| e.to_string())
}


/// Relatório de estoque (US5, FR-043).
#[tauri::command]
pub async fn relatorio_estoque(
    state: tauri::State<'_, AppState>,
) -> Result<RelatorioEstoque, ErroDto> {
    let repo = SeaRelatorioRepo::new(state.db.clone());
    Ok(relatorios::estoque(&repo).await?)
}



