//! Implementação SeaORM da porta `DashboardRepo` (US4).

use super::entities::livro::{self, Entity as LivroEntity};
use super::livro_repo::para_dominio;
use crate::application::ports::{DashboardRepo, RepoErro, ResumoDia};
use crate::domain::livro::Livro;
use async_trait::async_trait;
use sea_orm::{
    ColumnTrait, ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, QuerySelect, Statement,
};

pub struct SeaDashboardRepo {
    db: DatabaseConnection,
}

impl SeaDashboardRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl DashboardRepo for SeaDashboardRepo {
    async fn resumo_periodo(&self, inicio: &str, fim: &str) -> Result<ResumoDia, RepoErro> {
        let backend = self.db.get_database_backend();
        let cab = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT COALESCE(SUM(total_centavos),0) AS total, COUNT(*) AS n \
                 FROM pedido WHERE data BETWEEN ? AND ?",
                [inicio.into(), fim.into()],
            ))
            .await
            .map_err(erro)?;
        let (total_centavos, num_pedidos) = match cab {
            Some(r) => (
                r.try_get::<i64>("", "total").map_err(erro)?,
                r.try_get::<i64>("", "n").map_err(erro)?,
            ),
            None => (0, 0),
        };

        let it = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT COALESCE(SUM(ip.qtd),0) AS itens FROM item_pedido ip \
                 JOIN pedido p ON ip.pedido_numero = p.numero WHERE p.data BETWEEN ? AND ?",
                [inicio.into(), fim.into()],
            ))
            .await
            .map_err(erro)?;
        let itens_vendidos = match it {
            Some(r) => r.try_get::<i64>("", "itens").map_err(erro)?,
            None => 0,
        };

        Ok(ResumoDia {
            total_centavos,
            num_pedidos,
            itens_vendidos,
        })
    }

    async fn estoque_baixo(&self, limite: i64) -> Result<Vec<Livro>, RepoErro> {
        let ms = LivroEntity::find()
            .filter(livro::Column::Ativo.eq(true))
            .filter(livro::Column::Estoque.lte(limite))
            .order_by_asc(livro::Column::Estoque) // esgotados (menor) primeiro
            .limit(50)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn total_livros(&self) -> Result<i64, RepoErro> {
        let n = LivroEntity::find()
            .filter(livro::Column::Ativo.eq(true))
            .count(&self.db)
            .await
            .map_err(erro)?;
        Ok(n as i64)
    }

    async fn total_estoque(&self) -> Result<i64, RepoErro> {
        let backend = self.db.get_database_backend();
        let row = self
            .db
            .query_one(Statement::from_string(
                backend,
                "SELECT COALESCE(SUM(estoque), 0) AS s FROM livro WHERE ativo = 1".to_string(),
            ))
            .await
            .map_err(erro)?;
        match row {
            Some(r) => Ok(r.try_get::<i64>("", "s").map_err(erro)?),
            None => Ok(0),
        }
    }
}
