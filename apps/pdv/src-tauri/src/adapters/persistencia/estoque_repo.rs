//! Implementação SeaORM da porta `EstoqueRepo` (ADR-0008). Cada mutação insere o
//! movimento e atualiza o saldo materializado de `livro` na MESMA transação.

use super::entities::livro::Entity as LivroEntity;
use super::estoque_sql::inserir_movimento;
use crate::application::ports::RepoErro;
use crate::application::ports_estoque::{EstoqueRepo, MovimentoView};
use crate::domain::estoque::{baseline_saldo_inicial, TipoMovimento};
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

    pub async fn saldo_operacional(&self, codigo: &str) -> Result<i64, RepoErro> {
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "SELECT
                   l.saldo_publicado
                   - COALESCE((
                       SELECT SUM(i.qtd)
                       FROM item_pedido i
                       JOIN pedido p ON p.numero = i.pedido_numero
                       WHERE i.codigo = l.codigo
                         AND p.cancelado = 0
                         AND p.sincronizado_em IS NULL
                     ), 0)
                   + COALESCE((
                       SELECT SUM(i.qtd)
                       FROM item_pedido i
                       JOIN pedido p ON p.numero = i.pedido_numero
                       WHERE i.codigo = l.codigo
                         AND p.cancelado = 1
                         AND p.sincronizado_em IS NULL
                         -- Só compensa o cancelamento de venda JÁ incorporada ao
                         -- saldo_publicado (a nuvem baixou o −1). Venda criada e
                         -- cancelada offline continua 'pronta' — nunca baixou, então
                         -- o +1 seria dupla contagem (bug 121→122 antes do sync).
                         AND p.estoque_status = 'incorporada'
                     ), 0) AS saldo
                 FROM livro l
                 WHERE l.codigo = ?",
                [codigo.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| r.try_get::<i64>("", "saldo").ok()).unwrap_or(0))
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl EstoqueRepo for SeaEstoqueRepo {
    async fn extrato(&self, codigo: &str, limite: i64) -> Result<Vec<MovimentoView>, RepoErro> {
        use super::entities::livro;
        use super::entities::movimento_estoque::{Column, Entity as MovEntity};
        use sea_orm::{ColumnTrait, QueryFilter, QueryOrder};
        // Resolve o id do livro a partir do `codigo` (identidade passou a ser `id`).
        let Some(l) = LivroEntity::find()
            .filter(livro::Column::Codigo.eq(codigo))
            .one(&self.db)
            .await
            .map_err(erro)?
        else {
            return Ok(vec![]);
        };
        let movs = MovEntity::find()
            .filter(Column::LivroId.eq(l.id))
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
        // Baseline por livro que ainda NÃO tem `saldo_inicial` (ADR-0017). Cobre tanto os
        // livros sem movimento algum quanto os herdados do legado que têm movimentos de venda
        // mas nunca receberam baseline (ex.: A PONTE) — antes, o filtro "sem nenhum movimento"
        // deixava esses de fora e o recompute do sync (ADR-0016) corrompia o estoque.
        // A qtd é `estoque − Σ movimentos`, garantindo `Σ == estoque` (invariante SC-001, ADR-0008)
        // SEM alterar o `estoque` cacheado. Idempotente: uma vez criado o `saldo_inicial`, ignora.
        let pendentes = txn
            .query_all(Statement::from_string(
                backend,
                // Traz `estoque` e `Σ movimentos` crus; o baseline (estoque − Σ) é
                // calculado pela regra do domínio `baseline_saldo_inicial` (ADR-0017),
                // regra única compartilhada com o Escritório/WASM.
                "SELECT l.codigo,
                        l.estoque AS estoque,
                        COALESCE(
                            (SELECT SUM(m.qtd) FROM movimento_estoque m WHERE m.livro_id = l.id), 0
                        ) AS soma_mov
                 FROM livro l
                 WHERE NOT EXISTS (
                     SELECT 1 FROM movimento_estoque s
                     WHERE s.livro_id = l.id AND s.tipo = 'saldo_inicial'
                 )"
                    .to_string(),
            ))
            .await
            .map_err(erro)?;
        let mut criados = 0u64;
        for row in &pendentes {
            let codigo: String = row.try_get("", "codigo").map_err(erro)?;
            let estoque: i64 = row.try_get("", "estoque").map_err(erro)?;
            let soma_mov: i64 = row.try_get("", "soma_mov").map_err(erro)?;
            let baseline = baseline_saldo_inicial(estoque, soma_mov);
            inserir_movimento(&txn, &codigo, TipoMovimento::SaldoInicial, baseline, None, None, None, None)
                .await
                .map_err(erro)?;
            criados += 1;
        }
        txn.commit().await.map_err(erro)?;
        Ok(criados)
    }
}
