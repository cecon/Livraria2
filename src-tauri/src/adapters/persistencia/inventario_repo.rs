//! Implementação SeaORM da porta `InventarioRepo` (ADR-0010). Bipagem, revisão e
//! fechamento com reconciliação no fechamento. Helpers SQL em `inventario_sql`.

use super::inventario_sql::{
    achar_por_bipagem, agora, aplicar_fechamento, divergencias_query, exec, ler_qtd_contada,
    pendencias_query, sessao_de_row,
};
use super::livro_repo::para_dominio;
use crate::application::ports::RepoErro;
use crate::application::ports_inventario::{
    BipagemResultado, DivergenciaView, FechamentoView, InventarioRepo, PendenciaView, SessaoView,
};
use async_trait::async_trait;
use sea_orm::{
    ConnectionTrait, DatabaseConnection, DbErr, Statement, TransactionTrait,
};

pub struct SeaInventarioRepo {
    db: DatabaseConnection,
}

impl SeaInventarioRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Monta o relatório de uma sessão fechada (divergências persistidas + pendências).
    async fn relatorio_fechada(&self, sessao_id: i64) -> Result<FechamentoView, RepoErro> {
        let ajustados = divergencias_query(&self.db, sessao_id, true)
            .await
            .map_err(erro)?;
        let pendencias = pendencias_query(
            &self.db,
            "WHERE sessao_id = ? AND resolvida = 0",
            vec![sessao_id.into()],
        )
        .await
        .map_err(erro)?;
        Ok(FechamentoView {
            sessao_id,
            total_diferencas: ajustados.len() as i64,
            ajustados,
            pendencias,
        })
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl InventarioRepo for SeaInventarioRepo {
    async fn sessao_aberta(&self) -> Result<Option<SessaoView>, RepoErro> {
        let row = self
            .db
            .query_one(Statement::from_string(
                self.db.get_database_backend(),
                "SELECT id, modo, rotulo, status, aberta_em FROM sessao_inventario
                 WHERE status = 'aberta' ORDER BY id DESC LIMIT 1"
                    .to_string(),
            ))
            .await
            .map_err(erro)?;
        match row {
            Some(r) => Ok(Some(sessao_de_row(&r).map_err(erro)?)),
            None => Ok(None),
        }
    }

    async fn abrir(&self, modo: &str, rotulo: Option<String>) -> Result<SessaoView, RepoErro> {
        exec(
            &self.db,
            "INSERT INTO sessao_inventario (modo, rotulo, status, aberta_em)
             VALUES (?, ?, 'aberta', ?)",
            vec![modo.into(), rotulo.into(), agora().into()],
        )
        .await
        .map_err(erro)?;
        self.sessao_aberta()
            .await?
            .ok_or_else(|| RepoErro::Persistencia("falha ao abrir sessão".into()))
    }

    async fn bipar(&self, sessao_id: i64, codigo_lido: &str) -> Result<BipagemResultado, RepoErro> {
        if let Some(m) = achar_por_bipagem(&self.db, codigo_lido).await.map_err(erro)? {
            let codigo = m.codigo.clone();
            let afetou = self
                .db
                .execute(Statement::from_sql_and_values(
                    self.db.get_database_backend(),
                    "UPDATE item_contagem SET qtd_contada = qtd_contada + 1
                     WHERE sessao_id = ? AND livro_codigo = ?",
                    [sessao_id.into(), codigo.clone().into()],
                ))
                .await
                .map_err(erro)?;
            if afetou.rows_affected() == 0 {
                exec(
                    &self.db,
                    "INSERT INTO item_contagem (sessao_id, livro_codigo, qtd_contada)
                     VALUES (?, ?, 1)",
                    vec![sessao_id.into(), codigo.clone().into()],
                )
                .await
                .map_err(erro)?;
            }
            let qtd = ler_qtd_contada(&self.db, sessao_id, &codigo)
                .await
                .map_err(erro)?;
            return Ok(BipagemResultado {
                livro: Some(para_dominio(m)),
                qtd_contada: Some(qtd),
                pendencia: None,
            });
        }
        let afetou = self
            .db
            .execute(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "UPDATE pendencia_cadastro SET qtd = qtd + 1
                 WHERE sessao_id = ? AND codigo_lido = ? AND resolvida = 0",
                [sessao_id.into(), codigo_lido.into()],
            ))
            .await
            .map_err(erro)?;
        if afetou.rows_affected() == 0 {
            exec(
                &self.db,
                "INSERT INTO pendencia_cadastro (sessao_id, codigo_lido, qtd, resolvida, criado_em)
                 VALUES (?, ?, 1, 0, ?)",
                vec![sessao_id.into(), codigo_lido.into(), agora().into()],
            )
            .await
            .map_err(erro)?;
        }
        let pendencia = pendencias_query(
            &self.db,
            "WHERE sessao_id = ? AND codigo_lido = ? AND resolvida = 0",
            vec![sessao_id.into(), codigo_lido.into()],
        )
        .await
        .map_err(erro)?
        .into_iter()
        .next();
        Ok(BipagemResultado {
            livro: None,
            qtd_contada: None,
            pendencia,
        })
    }

    async fn desbipar(
        &self,
        sessao_id: i64,
        codigo_lido: &str,
    ) -> Result<BipagemResultado, RepoErro> {
        let Some(m) = achar_por_bipagem(&self.db, codigo_lido).await.map_err(erro)? else {
            return Ok(BipagemResultado {
                livro: None,
                qtd_contada: None,
                pendencia: None,
            });
        };
        let codigo = m.codigo.clone();
        exec(
            &self.db,
            "UPDATE item_contagem SET qtd_contada = qtd_contada - 1
             WHERE sessao_id = ? AND livro_codigo = ?",
            vec![sessao_id.into(), codigo.clone().into()],
        )
        .await
        .map_err(erro)?;
        // Se zerou, remove da contagem (não vira "contado = 0").
        exec(
            &self.db,
            "DELETE FROM item_contagem WHERE sessao_id = ? AND livro_codigo = ? AND qtd_contada <= 0",
            vec![sessao_id.into(), codigo.clone().into()],
        )
        .await
        .map_err(erro)?;
        let qtd = ler_qtd_contada(&self.db, sessao_id, &codigo)
            .await
            .map_err(erro)?;
        Ok(BipagemResultado {
            livro: Some(para_dominio(m)),
            qtd_contada: Some(qtd),
            pendencia: None,
        })
    }

    async fn ajustar_item(&self, sessao_id: i64, codigo: &str, qtd: i64) -> Result<(), RepoErro> {
        let afetou = self
            .db
            .execute(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "UPDATE item_contagem SET qtd_contada = ? WHERE sessao_id = ? AND livro_codigo = ?",
                [qtd.into(), sessao_id.into(), codigo.into()],
            ))
            .await
            .map_err(erro)?;
        if afetou.rows_affected() == 0 {
            exec(
                &self.db,
                "INSERT INTO item_contagem (sessao_id, livro_codigo, qtd_contada) VALUES (?, ?, ?)",
                vec![sessao_id.into(), codigo.into(), qtd.into()],
            )
            .await
            .map_err(erro)?;
        }
        Ok(())
    }

    async fn revisao(&self, sessao_id: i64) -> Result<Vec<DivergenciaView>, RepoErro> {
        divergencias_query(&self.db, sessao_id, false)
            .await
            .map_err(erro)
    }

    async fn fechar(
        &self,
        sessao_id: i64,
        confirmar_total: bool,
    ) -> Result<FechamentoView, RepoErro> {
        let sessao = self
            .db
            .query_one(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "SELECT modo, status FROM sessao_inventario WHERE id = ?",
                [sessao_id.into()],
            ))
            .await
            .map_err(erro)?
            .ok_or_else(|| RepoErro::Persistencia("sessão não encontrada".into()))?;
        let modo: String = sessao.try_get("", "modo").map_err(erro)?;
        let status: String = sessao.try_get("", "status").map_err(erro)?;
        if status == "fechada" {
            return self.relatorio_fechada(sessao_id).await; // idempotente (FR-030)
        }
        if status != "aberta" {
            return Err(RepoErro::Persistencia("sessão não está aberta".into()));
        }
        if modo == "total" && !confirmar_total {
            return Err(RepoErro::Persistencia(
                "modo total exige confirmação (zera livros não bipados)".into(),
            ));
        }
        let txn = self.db.begin().await.map_err(erro)?;
        if modo == "total" {
            exec(
                &txn,
                "INSERT INTO item_contagem (sessao_id, livro_codigo, qtd_contada)
                 SELECT ?, codigo, 0 FROM livro WHERE ativo = 1
                 AND codigo NOT IN (SELECT livro_codigo FROM item_contagem WHERE sessao_id = ?)",
                vec![sessao_id.into(), sessao_id.into()],
            )
            .await
            .map_err(erro)?;
        }
        aplicar_fechamento(&txn, sessao_id).await.map_err(erro)?;
        exec(
            &txn,
            "UPDATE sessao_inventario SET status = 'fechada', fechada_em = ? WHERE id = ?",
            vec![agora().into(), sessao_id.into()],
        )
        .await
        .map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        self.relatorio_fechada(sessao_id).await
    }

    async fn cancelar(&self, sessao_id: i64) -> Result<(), RepoErro> {
        exec(
            &self.db,
            "UPDATE sessao_inventario SET status = 'cancelada', fechada_em = ?
             WHERE id = ? AND status = 'aberta'",
            vec![agora().into(), sessao_id.into()],
        )
        .await
        .map_err(erro)
    }

    async fn divergencias(&self, sessao_id: i64) -> Result<Vec<DivergenciaView>, RepoErro> {
        divergencias_query(&self.db, sessao_id, true)
            .await
            .map_err(erro)
    }

    async fn pendencias(&self, apenas_abertas: bool) -> Result<Vec<PendenciaView>, RepoErro> {
        let filtro = if apenas_abertas { "WHERE resolvida = 0" } else { "" };
        pendencias_query(&self.db, filtro, vec![]).await.map_err(erro)
    }

    async fn resolver_pendencia(&self, pendencia_id: i64) -> Result<(), RepoErro> {
        exec(
            &self.db,
            "UPDATE pendencia_cadastro SET resolvida = 1 WHERE id = ?",
            vec![pendencia_id.into()],
        )
        .await
        .map_err(erro)
    }
}
