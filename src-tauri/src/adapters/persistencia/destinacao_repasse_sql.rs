//! Repasse por destinação no relatório de vendas (FR-016): por destinação,
//! os livros vendidos e o total — o valor a repassar no fechamento do dia.
//! Especiais vêm das alocações; a Loja é o residual por item (livre + carimbo
//! Loja), calculado no SQL — mesma régua do relatório por período (D3).

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

    // Loja = residual por item (item − Σ especiais do item), agrupado por título.
    let sql_loja = format!(
        "SELECT ip.titulo AS titulo,
                SUM(ip.qtd - COALESCE(esp.q, 0)) AS qtd,
                SUM(ip.preco_centavos * ip.qtd - COALESCE(esp.v, 0)) AS valor
         FROM item_pedido ip
         JOIN pedido p ON p.numero = ip.pedido_numero
         LEFT JOIN (SELECT a.item_id AS item_id, SUM(a.qtd) AS q, SUM(a.valor_centavos) AS v
                    FROM alocacao_venda a JOIN destinacao d ON d.id = a.destinacao_id
                    WHERE d.de_sistema = 0
                    GROUP BY a.item_id) esp ON esp.item_id = ip.id
         WHERE p.cancelado = 0 AND p.data = ?{turno}
         GROUP BY ip.titulo
         HAVING SUM(ip.qtd - COALESCE(esp.q, 0)) > 0
         ORDER BY ip.titulo"
    );
    let rows = conn
        .query_all(Statement::from_sql_and_values(backend, &sql_loja, [data.into()]))
        .await?;
    if !rows.is_empty() {
        let loja = conn
            .query_one(Statement::from_string(
                backend,
                "SELECT id, nome FROM destinacao WHERE de_sistema = 1".to_string(),
            ))
            .await?
            .ok_or_else(|| DbErr::Custom("destinação de sistema ausente".into()))?;
        let mut dest = RepasseDestinacao {
            destinacao_id: loja.try_get("", "id")?,
            nome: loja.try_get("", "nome")?,
            qtd: 0,
            valor_centavos: 0,
            livros: Vec::with_capacity(rows.len()),
        };
        for r in &rows {
            let livro = LivroRepasse {
                titulo: r.try_get("", "titulo")?,
                qtd: r.try_get("", "qtd")?,
                valor_centavos: r.try_get("", "valor")?,
            };
            dest.qtd += livro.qtd;
            dest.valor_centavos += livro.valor_centavos;
            dest.livros.push(livro);
        }
        // Loja primeiro — é a primeira na ordem de baixa.
        repasses.insert(0, dest);
    }
    Ok(repasses)
}
