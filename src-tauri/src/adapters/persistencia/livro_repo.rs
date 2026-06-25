//! Implementação SeaORM da porta `LivroRepo` (ADR-0003). Converte entidade ↔ domínio.

use super::entities::livro::{self, ActiveModel, Entity as LivroEntity};
use crate::application::ports::{LivroRepo, RepoErro};
use crate::domain::categoria::Categoria;
use crate::domain::dinheiro::Dinheiro;
use crate::domain::livro::Livro;
use crate::domain::texto::normalize;
use async_trait::async_trait;
use chrono::Local;
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveValue::Set, ColumnTrait, Condition, DatabaseConnection, DbErr, EntityTrait,
    PaginatorTrait, QueryFilter, QueryOrder, QuerySelect,
};

pub struct SeaLivroRepo {
    db: DatabaseConnection,
}

impl SeaLivroRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Bipagem (FR-022): casa o valor lido contra `codigo_barras` OU `codigo` (PK),
    /// para achar tanto livros migrados (EAN no `codigo`) quanto os com EAN separado.
    pub async fn por_codigo_barras_ou_codigo(
        &self,
        valor: &str,
    ) -> Result<Option<Livro>, RepoErro> {
        let m = LivroEntity::find()
            .filter(livro::Column::Ativo.eq(true))
            .filter(
                Condition::any()
                    .add(livro::Column::CodigoBarras.eq(valor))
                    .add(livro::Column::Codigo.eq(valor)),
            )
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(m.map(para_dominio))
    }

    /// Lista paginada de livros ativos (mais recentes primeiro), com busca opcional
    /// por título/autor (sem acento), código ou código de barras. Retorna (itens, total).
    /// `pagina` é 1-based.
    pub async fn listar_pagina(
        &self,
        termo: &str,
        pagina: u64,
        por_pagina: u64,
    ) -> Result<(Vec<Livro>, i64), RepoErro> {
        let mut q = LivroEntity::find().filter(livro::Column::Ativo.eq(true));
        let t = termo.trim();
        if !t.is_empty() {
            let norm = format!("%{}%", normalize(t));
            let bruto = format!("%{}%", t);
            q = q.filter(
                Condition::any()
                    .add(livro::Column::BuscaNorm.like(norm))
                    .add(livro::Column::Codigo.like(bruto.clone()))
                    .add(livro::Column::CodigoBarras.like(bruto)),
            );
        }
        let pager = q
            .order_by_desc(livro::Column::AtualizadoEm)
            .paginate(&self.db, por_pagina.max(1));
        let total = pager.num_items().await.map_err(erro)? as i64;
        let ms = pager
            .fetch_page(pagina.saturating_sub(1))
            .await
            .map_err(erro)?;
        Ok((ms.into_iter().map(para_dominio).collect(), total))
    }
}

pub(crate) fn para_dominio(m: livro::Model) -> Livro {
    Livro {
        codigo: m.codigo,
        titulo: m.titulo,
        autor: m.autor,
        preco: Dinheiro::de_centavos(m.preco_centavos),
        categoria: Categoria::de_i64(m.categoria),
        estoque: m.estoque,
        descricao: m.descricao,
        codigo_barras: m.codigo_barras,
        custo_medio: Dinheiro::de_centavos(m.custo_medio_centavos),
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl LivroRepo for SeaLivroRepo {
    async fn por_codigo(&self, codigo: &str) -> Result<Option<Livro>, RepoErro> {
        let m = LivroEntity::find_by_id(codigo.to_string())
            .filter(livro::Column::Ativo.eq(true))
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(m.map(para_dominio))
    }

    async fn salvar(&self, l: &Livro) -> Result<(), RepoErro> {
        let agora = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let am = ActiveModel {
            codigo: Set(l.codigo.clone()),
            titulo: Set(l.titulo.clone()),
            autor: Set(l.autor.clone()),
            preco_centavos: Set(l.preco.centavos()),
            categoria: Set(l.categoria.to_i64()),
            estoque: Set(l.estoque),
            descricao: Set(l.descricao.clone()),
            busca_norm: Set(l.busca_norm()),
            ativo: Set(true),
            atualizado_em: Set(agora),
            codigo_barras: Set(l.codigo_barras.clone()),
            // custo_medio é gerido pela entrada de mercadoria; no insert nasce com o valor
            // do domínio (0 em cadastro novo) e NÃO entra no update_columns para não ser
            // sobrescrito ao editar o livro.
            custo_medio_centavos: Set(l.custo_medio.centavos()),
        };
        LivroEntity::insert(am)
            .on_conflict(
                OnConflict::column(livro::Column::Codigo)
                    .update_columns([
                        livro::Column::Titulo,
                        livro::Column::Autor,
                        livro::Column::PrecoCentavos,
                        livro::Column::Categoria,
                        // Estoque NÃO entra: ao editar um livro, o saldo é preservado.
                        // Estoque só muda por movimento (entrada/ajuste/venda/inventário).
                        livro::Column::Descricao,
                        livro::Column::BuscaNorm,
                        livro::Column::Ativo,
                        livro::Column::AtualizadoEm,
                        livro::Column::CodigoBarras,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await
            .map_err(erro)?;
        Ok(())
    }

    async fn inativar(&self, codigo: &str) -> Result<(), RepoErro> {
        let am = ActiveModel {
            codigo: Set(codigo.to_string()),
            ativo: Set(false),
            ..Default::default()
        };
        LivroEntity::update(am).exec(&self.db).await.map_err(erro)?;
        Ok(())
    }

    async fn recentes(&self, limite: i64) -> Result<Vec<Livro>, RepoErro> {
        let ms = LivroEntity::find()
            .filter(livro::Column::Ativo.eq(true))
            .order_by_desc(livro::Column::AtualizadoEm)
            .limit(limite as u64)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn buscar_texto(&self, termo_norm: &str, limite: i64) -> Result<Vec<Livro>, RepoErro> {
        let padrao = format!("%{}%", termo_norm);
        let ms = LivroEntity::find()
            .filter(livro::Column::Ativo.eq(true))
            // casa por título/autor (busca_norm) OU por código de barras
            .filter(
                Condition::any()
                    .add(livro::Column::BuscaNorm.like(padrao.clone()))
                    .add(livro::Column::Codigo.like(padrao)),
            )
            .order_by_asc(livro::Column::Titulo)
            .limit(limite as u64)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }
}
