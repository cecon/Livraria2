//! Implementação SeaORM da porta `LivroRepo` (ADR-0003). Converte entidade ↔ domínio.

use super::entities::livro::{self, ActiveModel, Entity as LivroEntity};
use crate::application::ports::{LivroRepo, RepoErro};
use crate::domain::categoria::Categoria;
use crate::domain::dinheiro::Dinheiro;
use crate::domain::livro::Livro;
use async_trait::async_trait;
use chrono::Local;
use sea_orm::sea_query::{Expr, OnConflict};
use sea_orm::{
    ActiveValue::{NotSet, Set},
    ColumnTrait, Condition, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect,
};

pub struct SeaLivroRepo {
    db: DatabaseConnection,
}

impl SeaLivroRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Semeia/atualiza um livro no acervo. Em PRODUÇÃO o acervo desce da nuvem
    /// (a porta `LivroRepo` é só leitura); este método existe para a suíte de
    /// integração montar o estado como se tivesse vindo do sync. Upsert por
    /// `codigo` (código de barras) — editar NÃO sobrescreve o saldo (FR-002).
    pub async fn salvar(&self, l: &Livro) -> Result<(), RepoErro> {
        let agora = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let am = ActiveModel {
            id: NotSet, // auto-increment; o upsert casa por `codigo` (único)
            codigo: Set(l.codigo.clone()),
            titulo: Set(l.titulo.clone()),
            autor: Set(l.autor.clone()),
            preco_centavos: Set(l.preco.centavos()),
            categoria: Set(l.categoria.to_i64()),
            estoque: Set(l.estoque),
            saldo_publicado: Set(l.estoque),
            descricao: Set(l.descricao.clone()),
            busca_norm: Set(l.busca_norm()),
            ativo: Set(true),
            atualizado_em: Set(agora),
            // custo_medio nasce com o valor do domínio e NÃO entra no update_columns.
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

    /// Soft-delete por `codigo` (infra de teste — ver `salvar`).
    pub async fn inativar(&self, codigo: &str) -> Result<(), RepoErro> {
        LivroEntity::update_many()
            .col_expr(livro::Column::Ativo, Expr::value(false))
            .filter(livro::Column::Codigo.eq(codigo))
            .exec(&self.db)
            .await
            .map_err(erro)?;
        Ok(())
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
        custo_medio: Dinheiro::de_centavos(m.custo_medio_centavos),
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl LivroRepo for SeaLivroRepo {
    async fn por_codigo(&self, codigo: &str) -> Result<Option<Livro>, RepoErro> {
        let m = LivroEntity::find()
            .filter(livro::Column::Codigo.eq(codigo))
            .filter(livro::Column::Ativo.eq(true))
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(m.map(para_dominio))
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
