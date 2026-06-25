//! Implementação SeaORM da porta `EstoqueRepo` (ADR-0008). Cada mutação insere o
//! movimento e atualiza o saldo materializado de `livro` na MESMA transação.

use super::entities::livro::Entity as LivroEntity;
use super::estoque_sql::{inserir_entrada_item, inserir_movimento};
use super::livro_repo::para_dominio;
use crate::application::ports::RepoErro;
use crate::application::ports_estoque::{EntradaCmd, EstoqueRepo, MovimentoView};
use crate::domain::estoque::TipoMovimento;
use crate::domain::livro::Livro;
use async_trait::async_trait;
use sea_orm::{
    ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, Statement, TransactionTrait,
};

pub struct SeaEstoqueRepo {
    db: DatabaseConnection,
}

impl SeaEstoqueRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

async fn buscar_livro(db: &DatabaseConnection, codigo: &str) -> Result<Livro, RepoErro> {
    let m = LivroEntity::find_by_id(codigo.to_string())
        .one(db)
        .await
        .map_err(erro)?
        .ok_or_else(|| RepoErro::Persistencia("livro não encontrado".into()))?;
    Ok(para_dominio(m))
}

#[async_trait]
impl EstoqueRepo for SeaEstoqueRepo {
    async fn registrar_entrada(&self, cmd: EntradaCmd) -> Result<Livro, RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        // Delega ao helper compartilhado (D3a) — mesma mecânica usada pela finalização de nota.
        inserir_entrada_item(
            &txn,
            &cmd.livro_codigo,
            cmd.qtd,
            cmd.custo_unit_centavos,
            Some(cmd.fornecedor.clone()),
            None,
        )
        .await
        .map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        buscar_livro(&self.db, &cmd.livro_codigo).await
    }

    async fn registrar_ajuste(
        &self,
        codigo: &str,
        delta: i64,
        motivo: &str,
    ) -> Result<Livro, RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        let backend = txn.get_database_backend();
        inserir_movimento(
            &txn,
            codigo,
            TipoMovimento::Ajuste,
            delta,
            None,
            None,
            Some(motivo.to_string()),
            None,
        )
        .await
        .map_err(erro)?;
        txn.execute(Statement::from_sql_and_values(
            backend,
            "UPDATE livro SET estoque = estoque + ? WHERE codigo = ?",
            [delta.into(), codigo.into()],
        ))
        .await
        .map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        buscar_livro(&self.db, codigo).await
    }

    async fn extrato(&self, codigo: &str, limite: i64) -> Result<Vec<MovimentoView>, RepoErro> {
        use super::entities::movimento_estoque::{Column, Entity as MovEntity};
        use sea_orm::{ColumnTrait, QueryFilter, QueryOrder};
        let movs = MovEntity::find()
            .filter(Column::LivroCodigo.eq(codigo))
            .order_by_asc(Column::Id)
            .all(&self.db)
            .await
            .map_err(erro)?;
        let mut saldo = 0i64;
        let mut linhas: Vec<MovimentoView> = movs
            .into_iter()
            .map(|m| {
                saldo += m.qtd;
                MovimentoView {
                    id: m.id,
                    tipo: m.tipo,
                    qtd: m.qtd,
                    saldo_resultante: saldo,
                    custo_unit_centavos: m.custo_unit_centavos,
                    fornecedor: m.fornecedor,
                    motivo: m.motivo,
                    referencia: m.referencia,
                    criado_em: m.criado_em,
                }
            })
            .collect();
        // mostra do mais recente para o mais antigo; mantém saldo já acumulado
        linhas.reverse();
        if limite > 0 && linhas.len() > limite as usize {
            linhas.truncate(limite as usize);
        }
        Ok(linhas)
    }

    async fn gerar_saldos_iniciais(&self) -> Result<u64, RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        let backend = txn.get_database_backend();
        // Livros que ainda não têm nenhum movimento (idempotente, FR-006).
        let pendentes = txn
            .query_all(Statement::from_string(
                backend,
                "SELECT codigo, estoque FROM livro
                 WHERE codigo NOT IN (SELECT DISTINCT livro_codigo FROM movimento_estoque)"
                    .to_string(),
            ))
            .await
            .map_err(erro)?;
        let mut criados = 0u64;
        for row in &pendentes {
            let codigo: String = row.try_get("", "codigo").map_err(erro)?;
            let estoque: i64 = row.try_get("", "estoque").map_err(erro)?;
            inserir_movimento(&txn, &codigo, TipoMovimento::SaldoInicial, estoque, None, None, None, None)
                .await
                .map_err(erro)?;
            criados += 1;
        }
        txn.commit().await.map_err(erro)?;
        Ok(criados)
    }

    async fn fornecedores_sugestoes(
        &self,
        prefixo: &str,
        limite: i64,
    ) -> Result<Vec<String>, RepoErro> {
        let backend = self.db.get_database_backend();
        let padrao = format!("{}%", prefixo);
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                "SELECT DISTINCT fornecedor FROM movimento_estoque
                 WHERE fornecedor IS NOT NULL AND fornecedor <> '' AND fornecedor LIKE ?
                 ORDER BY fornecedor LIMIT ?",
                [padrao.into(), limite.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(rows
            .iter()
            .filter_map(|r| r.try_get::<String>("", "fornecedor").ok())
            .collect())
    }
}
