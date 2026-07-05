//! Repasse por destinação no relatório de vendas (FR-016): por destinação
//! ESPECIAL, os livros vendidos e o total a repassar no fechamento do dia.
//! A Loja fica de fora — o dinheiro dela é da própria loja, não é repasse
//! (pedido do usuário); os valores vêm das alocações gravadas na venda (D3).

use crate::application::ports_destinacao::{LivroRepasse, RepasseDestinacao};
use sea_orm::{ConnectionTrait, DbErr, Statement};

fn filtro_turno(periodo: &str) -> &'static str {
    match periodo {
        "manha" => " AND p.turno = 'manha'",
        "tarde" => " AND p.turno = 'tarde'",
        _ => "",
    }
}

pub(crate) async fn repasse<C: ConnectionTrait>(
    conn: &C,
    data: &str,
    periodo: &str,
) -> Result<Vec<RepasseDestinacao>, DbErr> {
    let backend = conn.get_database_backend();
    let turno = filtro_turno(periodo);

    // Especiais por (destinação, título), na ordem de baixa do cadastro.
    let sql_especiais = format!(
        "SELECT a.destinacao_id AS id, d.nome AS nome, ip.titulo AS titulo,
                SUM(a.qtd) AS qtd, SUM(a.valor_centavos) AS valor
         FROM alocacao_venda a
         JOIN item_pedido ip ON ip.id = a.item_id
         JOIN pedido p ON p.numero = a.pedido_numero
         JOIN destinacao d ON d.id = a.destinacao_id
         WHERE p.cancelado = 0 AND p.data = ?{turno} AND d.de_sistema = 0
         GROUP BY a.destinacao_id, ip.titulo
         ORDER BY d.ordem, d.id, ip.titulo"
    );
    let rows = conn
        .query_all(Statement::from_sql_and_values(backend, &sql_especiais, [data.into()]))
        .await?;

    let mut repasses: Vec<RepasseDestinacao> = Vec::new();
    for r in &rows {
        let id: i64 = r.try_get("", "id")?;
        let livro = LivroRepasse {
            titulo: r.try_get("", "titulo")?,
            qtd: r.try_get("", "qtd")?,
            valor_centavos: r.try_get("", "valor")?,
        };
        match repasses.iter_mut().find(|x| x.destinacao_id == id) {
            Some(dest) => {
                dest.qtd += livro.qtd;
                dest.valor_centavos += livro.valor_centavos;
                dest.livros.push(livro);
            }
            None => repasses.push(RepasseDestinacao {
                destinacao_id: id,
                nome: r.try_get("", "nome")?,
                qtd: livro.qtd,
                valor_centavos: livro.valor_centavos,
                livros: vec![livro],
            }),
        }
    }

    Ok(repasses)
}
