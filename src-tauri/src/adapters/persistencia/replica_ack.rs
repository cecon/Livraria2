//! Ack de incorporação da venda (feature 013, US2 — FR-006/ADR-0025).
//!
//! Sob push-only a venda não desce mais como conteúdo. Mas o `saldo_operacional`
//! precisa de UMA informação que só a nuvem tem: se ela já debitou o
//! `saldo_publicado` daquela venda. Sem isso, o cancelamento de uma venda já
//! sincronizada compensaria (ou não) no escuro — foi assim que o 121→122 do
//! incidente v26.8.3 nasceu.
//!
//! Então do `pedido` desce só o carimbo `estoque_*`, com três limites rígidos:
//!
//! 1. **Só as colunas do ack.** Nunca `cliente`, `total_centavos`, `cancelado`…
//!    A nuvem responde sobre o estoque, não reescreve a venda do PDV.
//! 2. **Só linha que já existe** (`WHERE sync_uid = ?`). Venda de outro PDV não
//!    é inserida — é exatamente o que a US2 quer evitar.
//! 3. **Não toca `sincronizado_em` nem `atualizado_em`.** Marcar `sincronizado_em`
//!    aqui daria por enviado um cancelamento local ainda pendente, que então
//!    nunca subiria.
//!
//! Extraído de `replica_sync` para manter os arquivos sob 300 linhas (Princípio III).

use crate::application::ports::RepoErro;
use crate::application::ports_sync::RegistroSync;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, Value};

use super::replica_mapa::ACK_INCORPORACAO;

pub(crate) async fn aplicar(
    db: &DatabaseConnection,
    registros: &[RegistroSync],
) -> Result<(), RepoErro> {
    for reg in registros {
        let mut sets: Vec<String> = vec![];
        let mut vals: Vec<Value> = vec![];
        for col in ACK_INCORPORACAO {
            if let Some(v) = reg.dados.get(*col) {
                sets.push(format!("{col}=?"));
                vals.push(Value::String(v.as_str().map(|s| Box::new(s.to_string()))));
            }
        }
        if sets.is_empty() {
            continue; // lote sem carimbo: nada a fazer
        }
        vals.push(Value::String(Some(Box::new(reg.sync_uid.clone()))));
        db.execute(Statement::from_sql_and_values(
            db.get_database_backend(),
            format!("UPDATE pedido SET {} WHERE sync_uid = ?", sets.join(",")),
            vals,
        ))
        .await
        .map_err(|e| RepoErro::Persistencia(e.to_string()))?;
    }
    Ok(())
}
