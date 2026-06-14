//! Implementação SeaORM da porta `LivroRepo` (ADR-0003). Converte entidade ↔ domínio.

use super::entities::livro::{self, ActiveModel, Entity as LivroEntity};
use crate::application::ports::{LivroRepo, RepoErro};
use crate::domain::categoria::Categoria;
use crate::domain::dinheiro::Dinheiro;
use crate::domain::livro::Livro;
use async_trait::async_trait;
use chrono::Local;
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveValue::Set, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect,
};

pub struct SeaLivroRepo {
    db: DatabaseConnection,
}

impl SeaLivroRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
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
        };
        LivroEntity::insert(am)
            .on_conflict(
                OnConflict::column(livro::Column::Codigo)
                    .update_columns([
                        livro::Column::Titulo,
                        livro::Column::Autor,
                        livro::Column::PrecoCentavos,
                        livro::Column::Categoria,
                        livro::Column::Estoque,
                        livro::Column::Descricao,
                        livro::Column::BuscaNorm,
                        livro::Column::Ativo,
                        livro::Column::AtualizadoEm,
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
            .filter(livro::Column::BuscaNorm.like(padrao))
            .order_by_asc(livro::Column::Titulo)
            .limit(limite as u64)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }
}
