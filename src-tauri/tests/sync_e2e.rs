//! Teste ponta a ponta REAL contra o Supabase (feature 007). `#[ignore]`: precisa
//! de rede + variáveis de ambiente do PDV:
//!   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PDV_EMAIL, SUPABASE_PDV_SENHA
//! Rodar: `cargo test --test sync_e2e -- --ignored --nocapture`

use livraria_2_lib::adapters::nuvem::supabase_sync::SupabaseSync;
use livraria_2_lib::adapters::persistencia::replica_sync::SeaReplicaSync;
use livraria_2_lib::adapters::persistencia::inicializar_schema;
use livraria_2_lib::application::ports_sync::NuvemRepo;
use livraria_2_lib::application::sincronizacao::sincronizar;
use sea_orm::{ConnectionTrait, Database, Statement};

#[tokio::test]
#[ignore]
async fn sincroniza_livro_do_pdv_para_a_nuvem() {
    // 1) Conecta (login email/senha → JWT).
    let nuvem = SupabaseSync::conectar().await.expect("login PDV");

    // 2) SQLite migrado + um livro local (codigo fixo → idempotente por upsert).
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let codigo = "E2E-SYNC-007";
    db.execute(Statement::from_string(
        db.get_database_backend(),
        format!("INSERT INTO livro (codigo,titulo,busca_norm,preco_centavos) VALUES ('{codigo}','Livro E2E','e2e',1500)"),
    ))
    .await
    .unwrap();

    // 3) Sincroniza (push do livro pendente).
    let local = SeaReplicaSync::new(db.clone());
    let resumo = sincronizar(&nuvem, &local).await.expect("sincronizar");
    println!("resumo: enviados={} recebidos={}", resumo.enviados, resumo.recebidos);
    assert!(resumo.enviados >= 1, "deveria empurrar o livro pendente");

    // 4) Confere na nuvem que o livro chegou.
    let lote = nuvem.buscar_desde("livro", "").await.expect("pull");
    let achou = lote.registros.iter().any(|r| r.dados["codigo"] == codigo);
    assert!(achou, "livro E2E deveria existir na nuvem após o push");
    println!("OK: livro '{codigo}' sincronizado e confirmado na nuvem");
}
