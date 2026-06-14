//! Implementação SeaORM da porta `RelatorioRepo` (US5).

use super::entities::item_pedido::{self, Entity as ItemEntity};
use super::entities::livro::{self, Entity as LivroEntity};
use super::entities::pedido::{self, Entity as PedidoEntity};
use super::livro_repo::para_dominio;
use crate::application::ports::{ItemRelatorio, PedidoRelatorio, RelatorioRepo, RepoErro};
use crate::domain::livro::Livro;
use async_trait::async_trait;
use sea_orm::{
    ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
};

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

        let mut saida = Vec::with_capacity(pedidos.len());
        for p in pedidos {
            let itens = ItemEntity::find()
                .filter(item_pedido::Column::PedidoNumero.eq(p.numero))
                .all(&self.db)
                .await
                .map_err(erro)?
                .into_iter()
                .map(|i| ItemRelatorio {
                    id: i.id,
                    titulo: i.titulo,
                    qtd: i.qtd,
                    valor_centavos: i.preco_centavos * i.qtd,
                })
                .collect();
            saida.push(PedidoRelatorio {
                numero: p.numero,
                cliente: p.cliente,
                itens,
                cartao: p.val_cartao,
                dinheiro: p.val_dinheiro,
                pix: p.val_pix,
                ministerio: p.val_ministerio,
                vale: p.val_vale,
                total_centavos: p.total_centavos,
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
