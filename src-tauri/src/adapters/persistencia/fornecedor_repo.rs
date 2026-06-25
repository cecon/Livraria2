//! Implementação SeaORM da porta `FornecedorRepo` (ADR-0011).

use super::entities::fornecedor::{self, ActiveModel, Entity as FornecedorEntity};
use crate::application::ports::RepoErro;
use crate::application::ports_compras::FornecedorRepo;
use crate::domain::fornecedor::Fornecedor;
use crate::domain::texto::normalize;
use async_trait::async_trait;
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveValue::{NotSet, Set},
    ColumnTrait, ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    Statement,
};

pub struct SeaFornecedorRepo {
    db: DatabaseConnection,
}

impl SeaFornecedorRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

fn para_dominio(m: fornecedor::Model) -> Fornecedor {
    Fornecedor {
        id: m.id,
        nome: m.nome,
        documento: m.documento,
        telefone: m.telefone,
        email: m.email,
        observacoes: m.observacoes,
        ativo: m.ativo,
    }
}

#[async_trait]
impl FornecedorRepo for SeaFornecedorRepo {
    async fn listar(&self, termo: &str) -> Result<Vec<Fornecedor>, RepoErro> {
        let mut q = FornecedorEntity::find().filter(fornecedor::Column::Ativo.eq(true));
        let t = termo.trim();
        if !t.is_empty() {
            q = q.filter(fornecedor::Column::NomeNorm.like(format!("%{}%", normalize(t))));
        }
        let ms = q
            .order_by_asc(fornecedor::Column::Nome)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn por_id(&self, id: i64) -> Result<Option<Fornecedor>, RepoErro> {
        let m = FornecedorEntity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(m.map(para_dominio))
    }

    async fn existe_nome(&self, nome_norm: &str, exceto_id: i64) -> Result<bool, RepoErro> {
        let achado = FornecedorEntity::find()
            .filter(fornecedor::Column::NomeNorm.eq(nome_norm))
            .filter(fornecedor::Column::Id.ne(exceto_id))
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(achado.is_some())
    }

    async fn salvar(&self, f: &Fornecedor) -> Result<Fornecedor, RepoErro> {
        let am = ActiveModel {
            id: if f.id == 0 { NotSet } else { Set(f.id) },
            nome: Set(f.nome.trim().to_string()),
            nome_norm: Set(f.nome_norm()),
            documento: Set(f.documento.clone()),
            telefone: Set(f.telefone.clone()),
            email: Set(f.email.clone()),
            observacoes: Set(f.observacoes.clone()),
            ativo: Set(true),
        };
        let m = if f.id == 0 {
            FornecedorEntity::insert(am)
                .exec_with_returning(&self.db)
                .await
                .map_err(erro)?
        } else {
            FornecedorEntity::update(am).exec(&self.db).await.map_err(erro)?
        };
        Ok(para_dominio(m))
    }

    async fn excluir(&self, id: i64) -> Result<(), RepoErro> {
        let am = ActiveModel {
            id: Set(id),
            ativo: Set(false),
            ..Default::default()
        };
        FornecedorEntity::update(am).exec(&self.db).await.map_err(erro)?;
        Ok(())
    }

    async fn semear(&self) -> Result<u64, RepoErro> {
        let backend = self.db.get_database_backend();
        let rows = self
            .db
            .query_all(Statement::from_string(
                backend,
                "SELECT DISTINCT fornecedor AS nome FROM movimento_estoque
                 WHERE fornecedor IS NOT NULL AND fornecedor <> ''"
                    .to_string(),
            ))
            .await
            .map_err(erro)?;
        let mut criados = 0u64;
        for r in &rows {
            let nome: String = r.try_get("", "nome").map_err(erro)?;
            // Insere ignorando se o nome_norm já existe (idempotente, FR-005).
            let res = FornecedorEntity::insert(ActiveModel {
                id: NotSet,
                nome: Set(nome.clone()),
                nome_norm: Set(normalize(&nome)),
                documento: Set(None),
                telefone: Set(None),
                email: Set(None),
                observacoes: Set(None),
                ativo: Set(true),
            })
            .on_conflict(
                OnConflict::column(fornecedor::Column::NomeNorm)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(&self.db)
            .await;
            if res.is_ok() {
                criados += 1;
            }
        }
        Ok(criados)
    }
}
