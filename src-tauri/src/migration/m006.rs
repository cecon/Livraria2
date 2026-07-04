//! Migração m006 (feature 005, ADR-0013): cadastro de formas de pagamento.
//!
//! De colunas largas (`pedido.val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale`)
//! para registro + junção: cria `forma_pagamento` e `pagamento_pedido`, semeia as 7
//! formas (todas ativas), faz o backfill esparso (`val_* > 0` → linha por chave) e
//! reconstrói `pedido` sem as colunas `val_*`.
//!
//! Segurança (FR-015/016/016a): transação única; **verificação anti-perda** por
//! Σ de cada pedido e Σ global por forma — divergência ⇒ `Err` ⇒ rollback (colunas
//! `val_*` intactas); `PRAGMA foreign_key_check` limpo. Idempotente por estado
//! (`ja_aplicada`: `pedido` sem `val_cartao`). Em falha, o boot propaga o erro e o
//! app bloqueia a operação (FR-016a).

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement, TransactionTrait};

/// Seed canônico: (ordem, chave, rotulo, de_sistema, coluna legada de backfill).
/// Débito e PIX Igreja são novas (sem coluna legada). Rótulos exatos (Princípio VI).
const SEED: &[(i64, &str, &str, bool, Option<&str>)] = &[
    (0, "credito", "Crédito", true, Some("val_cartao")),
    (1, "debito", "Débito", false, None),
    (2, "dinheiro", "Dinheiro", true, Some("val_dinheiro")),
    (3, "pix", "PIX", true, Some("val_pix")),
    (4, "pix_igreja", "PIX Igreja", false, None),
    (5, "ministerio", "Ministério", true, Some("val_ministerio")),
    (6, "vale", "Vale Presente", true, Some("val_vale")),
];

/// Relatório do que a migração fez (para log/teste).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RelatorioM006 {
    pub formas_semeadas: i64,
    pub pedidos: i64,
    pub linhas_pagamento: i64,
    pub soma_total_centavos: i64,
}

async fn conta(c: &impl ConnectionTrait, sql: &str) -> Result<i64, DbErr> {
    let r = c
        .query_one(Statement::from_string(c.get_database_backend(), sql))
        .await?
        .ok_or_else(|| DbErr::Custom("count sem linha".into()))?;
    r.try_get::<i64>("", "n")
}

async fn exec(c: &impl ConnectionTrait, sql: &str) -> Result<(), DbErr> {
    c.execute(Statement::from_string(c.get_database_backend(), sql.to_string()))
        .await?;
    Ok(())
}

/// Idempotência por estado: aplicada se `pedido` já não tem `val_cartao`.
pub async fn ja_aplicada(db: &DatabaseConnection) -> Result<bool, DbErr> {
    let rows = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA table_info(pedido)".to_string(),
        ))
        .await?;
    for r in &rows {
        if r.try_get::<String>("", "name").ok().as_deref() == Some("val_cartao") {
            return Ok(false);
        }
    }
    Ok(true)
}

/// Aplica a m006 de forma idempotente: não faz nada se já aplicada.
/// Em falha da verificação retorna `Err` com dados originais intactos (FR-016a).
pub async fn aplicar(db: &DatabaseConnection) -> Result<Option<RelatorioM006>, DbErr> {
    if ja_aplicada(db).await? {
        return Ok(None);
    }
    migrar(db).await.map(Some)
}

/// A migração propriamente dita, numa transação única. Pública para teste.
pub async fn migrar(db: &DatabaseConnection) -> Result<RelatorioM006, DbErr> {
    let txn = db.begin().await?;

    // 1) Cria o cadastro. A junção e o novo `pedido` são criados adiante — com FKs
    //    apontando para `pedido_new`, para o rebuild não violar foreign_keys=ON
    //    (o rename final reescreve as FKs para `pedido`, como na m004).
    exec(
        &txn,
        "CREATE TABLE IF NOT EXISTS forma_pagamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT NOT NULL UNIQUE,
            rotulo TEXT NOT NULL,
            de_sistema INTEGER NOT NULL DEFAULT 0,
            ativa INTEGER NOT NULL DEFAULT 1,
            ordem INTEGER NOT NULL DEFAULT 0
        )",
    )
    .await?;

    // 2) Semeia as 7 formas (todas ativas — FR-002), idempotente por chave.
    for (ordem, chave, rotulo, de_sistema, _) in SEED {
        exec(
            &txn,
            &format!(
                "INSERT INTO forma_pagamento (chave, rotulo, de_sistema, ativa, ordem)
                 SELECT '{chave}', '{rotulo}', {}, 1, {ordem}
                 WHERE NOT EXISTS (SELECT 1 FROM forma_pagamento WHERE chave = '{chave}')",
                i64::from(*de_sistema)
            ),
        )
        .await?;
    }

    // 3) Novo `pedido` (sem val_*) + junção referenciando `pedido_new`; depois o
    //    backfill esparso: cada val_* > 0 vira uma linha vinculada pela chave.
    for sql in [
        "CREATE TABLE pedido_new (
            numero INTEGER PRIMARY KEY,
            cliente TEXT NOT NULL DEFAULT 'CLIENTE',
            turno TEXT NOT NULL,
            data TEXT NOT NULL,
            total_centavos INTEGER NOT NULL,
            cancelado INTEGER NOT NULL DEFAULT 0,
            cancelado_em TEXT
        )",
        "INSERT INTO pedido_new (numero,cliente,turno,data,total_centavos,cancelado,cancelado_em)
         SELECT numero,cliente,turno,data,total_centavos,cancelado,cancelado_em FROM pedido",
        "CREATE TABLE IF NOT EXISTS pagamento_pedido (
            pedido_numero INTEGER NOT NULL REFERENCES pedido_new(numero),
            forma_id INTEGER NOT NULL REFERENCES forma_pagamento(id),
            valor_centavos INTEGER NOT NULL,
            PRIMARY KEY (pedido_numero, forma_id)
        )",
    ] {
        exec(&txn, sql).await?;
    }
    for (_, chave, _, _, col) in SEED {
        let Some(col) = col else { continue };
        exec(
            &txn,
            &format!(
                "INSERT INTO pagamento_pedido (pedido_numero, forma_id, valor_centavos)
                 SELECT p.numero, (SELECT id FROM forma_pagamento WHERE chave = '{chave}'), p.{col}
                 FROM pedido p WHERE p.{col} > 0"
            ),
        )
        .await?;
    }

    // 3b) `item_pedido` também referencia `pedido`: reconstrói apontando para
    //     `pedido_new` (cópia integral) para o DROP de `pedido` não violar FK.
    for sql in [
        "CREATE TABLE item_pedido_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_numero INTEGER NOT NULL REFERENCES pedido_new(numero),
            codigo TEXT NOT NULL,
            titulo TEXT NOT NULL,
            preco_centavos INTEGER NOT NULL,
            qtd INTEGER NOT NULL
        )",
        "INSERT INTO item_pedido_new (id,pedido_numero,codigo,titulo,preco_centavos,qtd)
         SELECT id,pedido_numero,codigo,titulo,preco_centavos,qtd FROM item_pedido",
    ] {
        exec(&txn, sql).await?;
    }

    // 4) Verificação anti-perda (FR-015): Σ por pedido e Σ global por forma.
    let pedidos_divergentes = conta(
        &txn,
        "SELECT count(*) AS n FROM pedido p
         WHERE (p.val_cartao + p.val_dinheiro + p.val_pix + p.val_ministerio + p.val_vale)
            <> COALESCE((SELECT SUM(pp.valor_centavos) FROM pagamento_pedido pp
                         WHERE pp.pedido_numero = p.numero), 0)",
    )
    .await?;
    if pedidos_divergentes > 0 {
        return Err(DbErr::Custom(format!(
            "m006 abortada: soma de pagamentos divergente em {pedidos_divergentes} pedido(s) — rollback, nenhum dado alterado"
        )));
    }
    for (_, chave, _, _, col) in SEED {
        let Some(col) = col else { continue };
        let divergencia = conta(
            &txn,
            &format!(
                "SELECT (SELECT COALESCE(SUM({col}),0) FROM pedido)
                      - (SELECT COALESCE(SUM(pp.valor_centavos),0) FROM pagamento_pedido pp
                         JOIN forma_pagamento f ON f.id = pp.forma_id WHERE f.chave = '{chave}') AS n"
            ),
        )
        .await?;
        if divergencia != 0 {
            return Err(DbErr::Custom(format!(
                "m006 abortada: soma global da forma '{chave}' divergente ({divergencia} centavos) — rollback"
            )));
        }
    }

    // 5) Verificação de cópia + troca atômica: dropa as antigas e renomeia — o
    //    rename reescreve as FKs `pedido_new` → `pedido` (SQLite ≥3.25, como na m004).
    let pedidos_antes = conta(&txn, "SELECT count(*) AS n FROM pedido").await?;
    let pedidos_novos = conta(&txn, "SELECT count(*) AS n FROM pedido_new").await?;
    let itens_antes = conta(&txn, "SELECT count(*) AS n FROM item_pedido").await?;
    let itens_novos = conta(&txn, "SELECT count(*) AS n FROM item_pedido_new").await?;
    if pedidos_novos != pedidos_antes || itens_novos != itens_antes {
        return Err(DbErr::Custom(format!(
            "m006 abortada: cópia perdeu linhas (pedido {pedidos_novos}/{pedidos_antes}, item {itens_novos}/{itens_antes}) — rollback"
        )));
    }
    for sql in [
        "DROP TABLE item_pedido",
        "DROP TABLE pedido",
        "ALTER TABLE pedido_new RENAME TO pedido",
        "ALTER TABLE item_pedido_new RENAME TO item_pedido",
        "CREATE INDEX IF NOT EXISTS idx_item_pedido ON item_pedido(pedido_numero)",
        "CREATE INDEX IF NOT EXISTS idx_pag_pedido ON pagamento_pedido(pedido_numero)",
    ] {
        exec(&txn, sql).await?;
    }

    // 6) Integridade referencial limpa (FKs não enforced em runtime — checagem explícita).
    let viol = txn
        .query_all(Statement::from_string(
            txn.get_database_backend(),
            "PRAGMA foreign_key_check".to_string(),
        ))
        .await?;
    if !viol.is_empty() {
        return Err(DbErr::Custom(format!(
            "m006 abortada: foreign_key_check acusou {} violação(ões) — rollback",
            viol.len()
        )));
    }

    let formas_semeadas = conta(&txn, "SELECT count(*) AS n FROM forma_pagamento").await?;
    let pedidos = conta(&txn, "SELECT count(*) AS n FROM pedido").await?;
    let linhas_pagamento = conta(&txn, "SELECT count(*) AS n FROM pagamento_pedido").await?;
    let soma_total_centavos = conta(
        &txn,
        "SELECT COALESCE(SUM(valor_centavos),0) AS n FROM pagamento_pedido",
    )
    .await?;

    txn.commit().await?;
    Ok(RelatorioM006 {
        formas_semeadas,
        pedidos,
        linhas_pagamento,
        soma_total_centavos,
    })
}
