//! SQL da poda de retenção (feature 013, US3 — FR-007/008), separado do
//! `turno_repo` para manter cada arquivo sob 300 linhas (Princípio III).
//!
//! ⚠️ **FK-safe**: as FKs locais são reais e estão ativas em runtime
//! (`alocacao_venda → item_pedido/pedido`, `item_pedido → pedido`,
//! `pagamento_pedido → pedido`). Apagar na ordem errada aborta a transação —
//! foi assim que o incidente 787/m013 nasceu. A ordem abaixo é filha→pai e
//! qualquer alteração aqui precisa do teste que reproduz o cluster inteiro.

use sea_orm::{ConnectionTrait, DatabaseTransaction, DbErr, Statement, Value};

/// Uma sentença por nível do cluster, da folha para a raiz.
const CASCATA: &[&str] = &[
    "DELETE FROM alocacao_venda WHERE pedido_numero IN \
     (SELECT numero FROM pedido WHERE turno_uid = ?)",
    "DELETE FROM pagamento_pedido WHERE pedido_numero IN \
     (SELECT numero FROM pedido WHERE turno_uid = ?)",
    "DELETE FROM item_pedido WHERE pedido_numero IN \
     (SELECT numero FROM pedido WHERE turno_uid = ?)",
    "DELETE FROM pedido WHERE turno_uid = ?",
    "DELETE FROM turno_operacao WHERE sync_uid = ?",
];

/// Apaga o cluster do turno na transação. Devolve o total de linhas removidas.
/// Idempotente: rodar de novo num turno já podado remove 0 linhas.
pub(crate) async fn apagar_cluster(txn: &DatabaseTransaction, turno_uid: &str) -> Result<u64, DbErr> {
    let backend = txn.get_database_backend();
    let mut removidas = 0u64;
    for sql in CASCATA {
        let r = txn
            .execute(Statement::from_sql_and_values(
                backend,
                *sql,
                [Value::String(Some(Box::new(turno_uid.to_string())))],
            ))
            .await?;
        removidas += r.rows_affected();
    }
    Ok(removidas)
}

/// Turnos encerrados **sem nenhuma pendência de sync** no cluster. Espelha a
/// contagem de `pendencias_sync_turno`: turno, pedidos, itens e pagamentos.
pub(crate) const CANDIDATOS: &str = "SELECT sync_uid, status, abertura FROM turno_operacao t \
     WHERE t.status = 'encerrado' AND t.excluido_em IS NULL \
       AND t.sincronizado_em IS NOT NULL \
       AND NOT EXISTS (SELECT 1 FROM pedido p \
                        WHERE p.turno_uid = t.sync_uid AND p.sincronizado_em IS NULL) \
       AND NOT EXISTS (SELECT 1 FROM item_pedido i JOIN pedido p ON p.numero = i.pedido_numero \
                        WHERE p.turno_uid = t.sync_uid AND i.sincronizado_em IS NULL) \
       AND NOT EXISTS (SELECT 1 FROM pagamento_pedido pp JOIN pedido p ON p.numero = pp.pedido_numero \
                        WHERE p.turno_uid = t.sync_uid AND pp.sincronizado_em IS NULL) \
     ORDER BY t.abertura";
