//! Porta de entrada Tauri: estado, DTOs de fronteira e comandos (`invoke`).
//! DTOs em camelCase espelham `src/lib/types.ts` (contracts/tauri-commands.md).

use crate::adapters::legado::mdb_importer::MdbImportador;
use crate::adapters::persistencia::inicializar_schema;
use crate::adapters::persistencia::dashboard_repo::SeaDashboardRepo;
use crate::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use crate::adapters::persistencia::livro_repo::SeaLivroRepo;
use crate::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use crate::adapters::persistencia::relatorio_repo::SeaRelatorioRepo;
use crate::adapters::persistencia::usuario_repo::SeaUsuarioRepo;
use crate::adapters::relogio::RelogioSistema;
use crate::application::dashboard;
use crate::application::relatorios::{self, RelatorioEstoque, RelatorioVendas};
use crate::application::erros::ErroApp;
use crate::application::migracao::{self, RelatorioMigracao};
use crate::application::ports::{LivroRepo, PedidoRepo};
use crate::application::venda::VendaInput;
use crate::application::{cadastro, pesquisa, venda};
use crate::domain::categoria::Categoria;
use crate::domain::dinheiro::Dinheiro;
use crate::domain::livro::Livro;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

/// Estado compartilhado: a conexão. Os repositórios são construídos por comando
/// (DatabaseConnection é barato de clonar — Arc interno).
pub struct AppState {
    pub db: DatabaseConnection,
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
    pub descricao: Option<String>,
    pub codigo_barras: Option<String>,
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
            descricao: l.descricao,
            codigo_barras: l.codigo_barras,
            custo_medio_centavos: l.custo_medio.centavos(),
        }
    }
}

impl LivroDto {
    fn para_dominio(self) -> Livro {
        Livro {
            codigo: self.codigo,
            titulo: self.titulo,
            autor: self.autor,
            preco: Dinheiro::de_centavos(self.preco_centavos),
            categoria: Categoria::de_i64(self.categoria),
            estoque: self.estoque,
            descricao: self.descricao,
            codigo_barras: self.codigo_barras,
            custo_medio: Dinheiro::de_centavos(self.custo_medio_centavos),
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

/// Aplica as migrations idempotentes sob demanda (FR-061).
#[tauri::command]
pub async fn inicializar_dados(state: tauri::State<'_, AppState>) -> Result<(), String> {
    inicializar_schema(&state.db)
        .await
        .map_err(|e| e.to_string())
}

/// Próximo número de pedido (FR-017).
#[tauri::command]
pub async fn proximo_numero_pedido(state: tauri::State<'_, AppState>) -> Result<i64, ErroDto> {
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    Ok(venda::proximo_numero_pedido(&pedidos).await?)
}

/// Registra uma venda (US1, FR-015).
#[tauri::command]
pub async fn registrar_venda(
    state: tauri::State<'_, AppState>,
    input: VendaInput,
) -> Result<PedidoDto, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    let pedido = venda::registrar_venda(input, &livros, &pedidos, &RelogioSistema).await?;
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
    Ok(ls.into_iter().map(LivroDto::from).collect())
}

/// Busca um livro pelo código de barras (US1/US2/US3).
#[tauri::command]
pub async fn livro_por_codigo(
    state: tauri::State<'_, AppState>,
    codigo: String,
) -> Result<Option<LivroDto>, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let l = livros.por_codigo(&codigo).await.map_err(ErroApp::from)?;
    Ok(l.map(LivroDto::from))
}

/// Inclui ou altera um livro (upsert por código), com validação (US2, FR-001).
#[tauri::command]
pub async fn salvar_livro(
    state: tauri::State<'_, AppState>,
    livro: LivroDto,
) -> Result<(), ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    cadastro::salvar(livro.para_dominio(), &livros).await?;
    // Livro novo recebe seu movimento `saldo_inicial` (idempotente; no-op se já tem
    // movimento). Mantém a invariante Σ movimentos == estoque desde a criação (FR-006).
    use crate::application::ports_estoque::EstoqueRepo;
    SeaEstoqueRepo::new(state.db.clone())
        .gerar_saldos_iniciais()
        .await
        .map_err(crate::application::erros::ErroApp::from)?;
    Ok(())
}

/// Exclui (soft-delete) um livro (US2, FR-001).
#[tauri::command]
pub async fn excluir_livro(
    state: tauri::State<'_, AppState>,
    codigo: String,
) -> Result<(), ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    cadastro::excluir(&codigo, &livros).await?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardDto {
    pub vendas_centavos: i64,
    pub itens_vendidos: i64,
    pub ticket_medio_centavos: i64,
    pub total_livros: i64,
    pub total_estoque: i64,
    pub estoque_baixo: Vec<LivroDto>,
}

/// Intervalo de datas (ISO) para o período: "hoje" | "7dias" | "mes".
fn intervalo_periodo(periodo: Option<&str>) -> (String, String) {
    use chrono::{Datelike, Duration, Local, NaiveDate};
    let hoje = Local::now().date_naive();
    let inicio = match periodo {
        // mesmo dia da semana anterior (ex.: domingo → domingo passado)
        Some("7dias") => hoje - Duration::days(7),
        Some("mes") => hoje.with_day(1).unwrap_or(hoje),
        Some("ano") => NaiveDate::from_ymd_opt(hoje.year(), 1, 1).unwrap_or(hoje),
        _ => hoje,
    };
    let fmt = |d: NaiveDate| d.format("%Y-%m-%d").to_string();
    (fmt(inicio), fmt(hoje))
}

/// Indicadores do dashboard (US4, FR-030/031). `periodo` = hoje | 7dias | mes.
#[tauri::command]
pub async fn dashboard_do_dia(
    state: tauri::State<'_, AppState>,
    periodo: Option<String>,
) -> Result<DashboardDto, ErroDto> {
    let repo = SeaDashboardRepo::new(state.db.clone());
    let (inicio, fim) = intervalo_periodo(periodo.as_deref());
    let ind = dashboard::do_periodo(&inicio, &fim, &repo).await?;
    Ok(DashboardDto {
        vendas_centavos: ind.vendas_centavos,
        itens_vendidos: ind.itens_vendidos,
        ticket_medio_centavos: ind.ticket_medio_centavos,
        total_livros: ind.total_livros,
        total_estoque: ind.total_estoque,
        estoque_baixo: ind.estoque_baixo.into_iter().map(LivroDto::from).collect(),
    })
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
#[tauri::command]
pub async fn relatorio_vendas(
    state: tauri::State<'_, AppState>,
    data: String,
    periodo: String,
) -> Result<RelatorioVendas, ErroDto> {
    let repo = SeaRelatorioRepo::new(state.db.clone());
    Ok(relatorios::vendas(&data, &periodo, &repo).await?)
}

/// Cancela uma venda inteira (pedido + itens) — edição da venda do dia.
#[tauri::command]
pub async fn excluir_pedido(
    state: tauri::State<'_, AppState>,
    numero: i64,
) -> Result<(), ErroDto> {
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    pedidos.excluir_pedido(numero).await.map_err(ErroApp::from)?;
    Ok(())
}

/// Salva bytes num arquivo no caminho escolhido pelo usuário (ex.: exportar Excel).
#[tauri::command]
pub fn salvar_arquivo(caminho: String, conteudo: Vec<u8>) -> Result<(), String> {
    std::fs::write(&caminho, &conteudo).map_err(|e| e.to_string())
}

/// Remove um item de um pedido e recalcula o total (correção de dados — US5).
#[tauri::command]
pub async fn excluir_item_pedido(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), ErroDto> {
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    pedidos.excluir_item(id).await.map_err(ErroApp::from)?;
    Ok(())
}

/// Relatório de estoque (US5, FR-043).
#[tauri::command]
pub async fn relatorio_estoque(
    state: tauri::State<'_, AppState>,
) -> Result<RelatorioEstoque, ErroDto> {
    let repo = SeaRelatorioRepo::new(state.db.clone());
    Ok(relatorios::estoque(&repo).await?)
}

/// Migra/sincroniza o legado Access (idempotente, FR-065..069). `caminho_mdb`
/// default: `../Livraria/livraria.mdb` (irmão de Livraria2).
#[tauri::command]
pub async fn migrar_legado(
    state: tauri::State<'_, AppState>,
    caminho: Option<String>,
) -> Result<RelatorioMigracao, ErroDto> {
    let caminho = caminho.unwrap_or_else(|| "../Livraria/livraria.mdb".to_string());
    let importador = MdbImportador::new(caminho);
    let livros = SeaLivroRepo::new(state.db.clone());
    let pedidos = SeaPedidoRepo::new(state.db.clone());
    Ok(migracao::migrar(&importador, &livros, &pedidos).await?)
}

/// Últimos livros cadastrados/alterados (US2, FR-005).
#[tauri::command]
pub async fn livros_recentes(
    state: tauri::State<'_, AppState>,
    limite: Option<i64>,
) -> Result<Vec<LivroDto>, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let ls = cadastro::recentes(limite.unwrap_or(4), &livros).await?;
    Ok(ls.into_iter().map(LivroDto::from).collect())
}

/// Lista paginada de livros no banco (busca opcional) — Cadastro (feature 003).
#[tauri::command]
pub async fn livros_pagina(
    state: tauri::State<'_, AppState>,
    termo: Option<String>,
    pagina: Option<i64>,
    por_pagina: Option<i64>,
) -> Result<PaginaLivros, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let pp = por_pagina.unwrap_or(12).max(1) as u64;
    let p = pagina.unwrap_or(1).max(1) as u64;
    let (ls, total) = livros
        .listar_pagina(termo.as_deref().unwrap_or(""), p, pp)
        .await
        .map_err(ErroApp::from)?;
    Ok(PaginaLivros {
        itens: ls.into_iter().map(LivroDto::from).collect(),
        total,
    })
}
