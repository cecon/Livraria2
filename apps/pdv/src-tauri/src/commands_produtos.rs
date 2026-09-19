use crate::adapters::{nuvem::{api_sync::ApiSync, produtos::{self, Autorizacao, Produto}},
    persistencia::{produto_pontual, estoque_repo::SeaEstoqueRepo, livro_repo::SeaLivroRepo}};
use crate::application::ports::LivroRepo;
use crate::commands::{AppState, ErroDto, LivroDto};
use serde::Serialize;
use serde_json::Value;
use sea_orm::{ConnectionTrait, Statement};

#[tauri::command]
pub async fn produtos_listar(state: tauri::State<'_, AppState>, termo: String, pagina: u32)
    -> Result<Vec<Produto>, ErroDto> {
    let termo = crate::domain::texto::normalize(termo.trim());
    let rows = state.db.query_all(Statement::from_sql_and_values(state.db.get_database_backend(),
        "SELECT sync_uid,codigo,titulo,autor,preco_centavos,categoria,descricao,saldo_publicado,ativo
         FROM livro WHERE excluido_em IS NULL AND sync_uid IS NOT NULL AND busca_norm LIKE ?
         ORDER BY titulo,codigo LIMIT 21 OFFSET ?",
        [format!("%{termo}%").into(), i64::from(pagina.min(100000)) .saturating_mul(20).into()]))
        .await.map_err(produtos::rede)?;
    rows.into_iter().map(|r| Ok(Produto {
        uid: r.try_get("", "sync_uid").map_err(produtos::rede)?,
        codigo: r.try_get("", "codigo").map_err(produtos::rede)?,
        titulo: r.try_get("", "titulo").map_err(produtos::rede)?,
        autor: r.try_get("", "autor").map_err(produtos::rede)?,
        preco_centavos: r.try_get("", "preco_centavos").map_err(produtos::rede)?,
        categoria: r.try_get("", "categoria").map_err(produtos::rede)?,
        descricao: r.try_get("", "descricao").map_err(produtos::rede)?,
        saldo_publicado: r.try_get("", "saldo_publicado").map_err(produtos::rede)?,
        ativo: r.try_get("", "ativo").map_err(produtos::rede)?,
        excluido: false, versao: String::new(),
    })).collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProdutoDisponivel {
    produto: Produto,
    livro: Option<LivroDto>,
    pendente_local: bool,
}

async fn disponibilizar(state: &AppState, produto: Produto) -> ProdutoDisponivel {
    let importado = !produto.excluido && produto_pontual::importar(&state.db, &produto).await.is_ok();
    let livro = async {
        if !importado { return None; }
        if !produto.ativo { return None; }
        let l = SeaLivroRepo::new(state.db.clone()).por_codigo(&produto.codigo).await.ok()??;
        let mut dto = LivroDto::from(l);
        dto.saldo_operacional = Some(SeaEstoqueRepo::new(state.db.clone()).saldo_operacional(&produto.codigo).await.ok()?);
        Some(dto)
    }.await;
    let pendente_local = !produto.excluido && (!importado || (produto.ativo && livro.is_none()));
    ProdutoDisponivel { produto, livro, pendente_local }
}

#[tauri::command]
pub async fn produto_consultar(state: tauri::State<'_, AppState>, codigo: Option<String>, uid: Option<String>)
    -> Result<Option<ProdutoDisponivel>, ErroDto> {
    let api = ApiSync::conectar_com_config(state.machine_config_path.as_deref()).await.map_err(produtos::rede)?;
    let data = api.produto(codigo.as_deref(), uid.as_deref()).await.map_err(produtos::rede)?;
    if data.is_null() { return Ok(None); }
    let p = serde_json::from_value(data).map_err(produtos::rede)?;
    Ok(Some(disponibilizar(&state, p).await))
}

#[tauri::command]
pub async fn produto_salvar(state: tauri::State<'_, AppState>, pedido: Value, autorizacao: Autorizacao)
    -> Result<ProdutoDisponivel, ErroDto> {
    let p = produtos::salvar(state.machine_config_path.as_deref(), &pedido, autorizacao).await?;
    Ok(disponibilizar(&state, p).await)
}
