//! Porta de entrada Tauri: estado, DTOs de fronteira e comandos (`invoke`).
//! DTOs em camelCase espelham `src/lib/types.ts` (contracts/tauri-commands.md).

use crate::adapters::legado::mdb_importer::MdbImportador;
use crate::adapters::persistencia::inicializar_schema;
use crate::adapters::persistencia::livro_repo::SeaLivroRepo;
use crate::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use crate::adapters::relogio::RelogioSistema;
use crate::application::erros::ErroApp;
use crate::application::migracao::{self, RelatorioMigracao};
use crate::application::ports::LivroRepo;
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
        }
    }
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
