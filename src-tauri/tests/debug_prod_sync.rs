//! Debug: roda a sincronização real (com batching) contra um DB de produção e a
//! nuvem, logando por tabela/lote. `#[ignore]` — precisa de rede + env:
//!   PROD_DB=<caminho do livraria.db>  + SUPABASE_URL/ANON_KEY/PDV_EMAIL/PDV_SENHA
//! Rodar: `cargo test --test debug_prod_sync -- --ignored --nocapture`

use livraria_2_lib::adapters::nuvem::supabase_sync::SupabaseSync;
use livraria_2_lib::adapters::persistencia::replica_sync::SeaReplicaSync;
use livraria_2_lib::application::ports_sync::{NuvemRepo, ReplicaLocalRepo};
use livraria_2_lib::domain::sincronizacao::ORDEM_DEPENDENCIA;
use sea_orm::Database;

const LOTE: usize = 500;

#[tokio::test]
#[ignore]
async fn seed_prod_com_batching_e_logs() {
    let db_path = std::env::var("PROD_DB").expect("defina PROD_DB");
    let url = format!("sqlite://{db_path}?mode=rwc");
    let db = Database::connect(&url).await.expect("abrir db de prod");
    let local = SeaReplicaSync::new(db.clone());
    let nuvem = SupabaseSync::conectar(None).await.expect("login PDV");
    let agora = nuvem.agora_servidor().await.expect("agora_servidor");

    let mut total = 0usize;
    for recurso in ORDEM_DEPENDENCIA {
        let pend = local.pendentes(recurso).await.expect("pendentes");
        if pend.is_empty() {
            continue;
        }
        println!("== {recurso}: {} pendentes ==", pend.len());
        let mut ok = 0usize;
        for (i, lote) in pend.chunks(LOTE).enumerate() {
            match nuvem.upsert(recurso, lote).await {
                Ok(_) => {
                    let uids: Vec<String> = lote.iter().map(|r| r.sync_uid.clone()).collect();
                    local.marcar_sincronizado(recurso, &uids, &agora).await.expect("marcar");
                    ok += lote.len();
                    println!("   lote {} (+{}) OK — {recurso} acumulado {ok}", i + 1, lote.len());
                }
                Err(e) => {
                    println!("   lote {} FALHOU em {recurso}: {e}", i + 1);
                    panic!("push falhou em {recurso}: {e}");
                }
            }
        }
        total += ok;
    }
    println!("TOTAL enviado: {total}");
}
