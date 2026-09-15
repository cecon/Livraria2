//! Fixture de teste (feature 012): cadastros que em PRODUÇÃO descem da nuvem.
//! O PDV não semeia mais formas/destinação (a nuvem manda); os testes que
//! exercitam a lógica local sobre esses cadastros os criam aqui, simulando o
//! estado pós-sync (o que a nuvem entregou).

use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

async fn exec(db: &DatabaseConnection, sql: &str) {
    db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .expect("fixture: semear cadastro de teste");
}

// Os cadastros vêm da nuvem JÁ com `sync_uid` (identidade estável). A fixture
// reproduz isso (senão o remap de FK por sync_uid não teria o que referenciar).
const UID: &str = "lower(hex(randomblob(16)))";

/// As 7 formas de pagamento canônicas (ex-seed da m006), na ordem — com sync_uid.
#[allow(dead_code)]
pub async fn semear_formas(db: &DatabaseConnection) {
    exec(
        db,
        &format!(
            "INSERT INTO forma_pagamento (chave,rotulo,de_sistema,ativa,ordem,sync_uid) VALUES \
             ('credito','Crédito',1,1,0,{UID}),('debito','Débito',0,1,1,{UID}),\
             ('dinheiro','Dinheiro',1,1,2,{UID}),('pix','PIX',1,1,3,{UID}),\
             ('pix_igreja','PIX Igreja',0,1,4,{UID}),('ministerio','Ministério',1,1,5,{UID}),\
             ('vale','Vale Presente',1,1,6,{UID})"
        ),
    )
    .await;
}

/// A destinação de sistema "Loja" (ex-seed da m007), ordem 0 — com sync_uid.
#[allow(dead_code)]
pub async fn semear_loja(db: &DatabaseConnection) {
    exec(
        db,
        &format!("INSERT INTO destinacao (nome,nome_norm,de_sistema,ativa,ordem,sync_uid) VALUES ('Loja','loja',1,1,0,{UID})"),
    )
    .await;
}
