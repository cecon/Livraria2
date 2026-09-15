//! Implementação SeaORM da porta `RelatorioRepo` (US5).

use super::entities::item_pedido::{self, Entity as ItemEntity};
use super::entities::livro::{self, Entity as LivroEntity};
use super::entities::pedido::{self, Entity as PedidoEntity};
use super::livro_repo::para_dominio;
use super::pagamento_pedido_sql;
use crate::application::ports::{AlocacaoRelatorio, ItemRelatorio, PedidoRelatorio, RelatorioRepo, RepoErro};
use crate::domain::livro::Livro;
use async_trait::async_trait;
use sea_orm::{ConnectionTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,};

pub struct SeaRelatorioRepo {
    db: DatabaseConnection,
}

impl SeaRelatorioRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl RelatorioRepo for SeaRelatorioRepo {
    async fn vendas(&self, data: &str, periodo: &str) -> Result<Vec<PedidoRelatorio>, RepoErro> {
        let mut q = PedidoEntity::find().filter(pedido::Column::Data.eq(data));
        if periodo == "manha" {
            q = q.filter(pedido::Column::Turno.eq("manha"));
        } else if periodo == "tarde" {
            q = q.filter(pedido::Column::Turno.eq("tarde"));
        }
        let pedidos = q
            .order_by_asc(pedido::Column::Numero)
            .all(&self.db)
            .await
            .map_err(erro)?;

        // Loja (de_sistema) para consolidar carimbo Loja + livre no detalhe (FR-013).
        let loja = self
            .db
            .query_one(sea_orm::Statement::from_string(
                self.db.get_database_backend(),
                "SELECT id, nome FROM destinacao WHERE de_sistema = 1".to_string(),
            ))
            .await
            .map_err(erro)?;
        let (loja_id, loja_nome): (i64, String) = match &loja {
            Some(r) => (
                r.try_get("", "id").map_err(erro)?,
                r.try_get("", "nome").map_err(erro)?,
            ),
            None => (0, "Loja".to_string()),
        };

        let mut saida = Vec::with_capacity(pedidos.len());
        for p in pedidos {
            let modelos = ItemEntity::find()
                .filter(item_pedido::Column::PedidoNumero.eq(p.numero))
                .all(&self.db)
                .await
                .map_err(erro)?;
            let mut itens = Vec::with_capacity(modelos.len());
            for i in modelos {
                let alocacoes =
                    alocacoes_do_item(&self.db, i.id, i.qtd, i.preco_centavos, loja_id, &loja_nome)
                        .await
                        .map_err(erro)?;
                itens.push(ItemRelatorio {
                    id: i.id,
                    codigo: i.codigo,
                    titulo: i.titulo,
                    qtd: i.qtd,
                    valor_centavos: i.preco_centavos * i.qtd,
                    alocacoes,
                });
            }
            let recebimentos = pagamento_pedido_sql::por_pedido(&self.db, p.numero)
                .await
                .map_err(erro)?;
            saida.push(PedidoRelatorio {
                numero: p.numero,
                cliente: p.cliente,
                itens,
                recebimentos,
                total_centavos: p.total_centavos,
                cancelado: p.cancelado,
            });
        }
        Ok(saida)
    }

    async fn estoque_completo(&self) -> Result<Vec<Livro>, RepoErro> {
        let ms = LivroEntity::find()
            .filter(livro::Column::Ativo.eq(true))
            .order_by_asc(livro::Column::Estoque)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }
}

/// Alocações do item para o detalhe da venda (FR-013). Vazio quando o item não
/// consumiu carimbo (100% Loja); senão, consolida carimbo Loja + livre restante
/// numa entrada única "Loja" — a UI não faz conta.
async fn alocacoes_do_item(
    db: &DatabaseConnection,
    item_id: i64,
    qtd_item: i64,
    preco_centavos: i64,
    loja_id: i64,
    loja_nome: &str,
) -> Result<Vec<AlocacaoRelatorio>, sea_orm::DbErr> {
    let rows = db
        .query_all(sea_orm::Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT a.destinacao_id AS id, d.nome AS nome,
                    SUM(a.qtd) AS qtd, SUM(a.valor_centavos) AS valor
             FROM alocacao_venda a JOIN destinacao d ON d.id = a.destinacao_id
             WHERE a.item_id = ?
             GROUP BY a.destinacao_id ORDER BY d.ordem, d.id",
            [item_id.into()],
        ))
        .await?;
    if rows.is_empty() {
        return Ok(vec![]);
    }
    let mut alocacoes: Vec<AlocacaoRelatorio> = Vec::with_capacity(rows.len() + 1);
    let mut consumido = 0i64;
    for r in &rows {
        let a = AlocacaoRelatorio {
            destinacao_id: r.try_get("", "id")?,
            nome: r.try_get("", "nome")?,
            qtd: r.try_get("", "qtd")?,
            valor_centavos: r.try_get("", "valor")?,
        };
        consumido += a.qtd;
        alocacoes.push(a);
    }
    let livre = qtd_item - consumido;
    if livre > 0 {
        if let Some(loja) = alocacoes.iter_mut().find(|a| a.destinacao_id == loja_id) {
            loja.qtd += livre;
            loja.valor_centavos += livre * preco_centavos;
        } else {
            alocacoes.insert(
                0,
                AlocacaoRelatorio {
                    destinacao_id: loja_id,
                    nome: loja_nome.to_string(),
                    qtd: livre,
                    valor_centavos: livre * preco_centavos,
                },
            );
        }
    }
    Ok(alocacoes)
}
