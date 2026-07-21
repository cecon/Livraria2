//! Teste ponta a ponta REAL contra o Supabase (feature 007). `#[ignore]`: precisa
//! de rede + variáveis de ambiente do PDV:
//!   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PDV_EMAIL, SUPABASE_PDV_SENHA
//! Rodar: `cargo test --test sync_e2e -- --ignored --nocapture`

use livraria_2_lib::adapters::nuvem::supabase_sync::SupabaseSync;
use livraria_2_lib::adapters::persistencia::replica_sync::SeaReplicaSync;
use livraria_2_lib::adapters::persistencia::inicializar_schema;
use livraria_2_lib::application::ports_sync::{NuvemRepo, RegistroSync};
use livraria_2_lib::application::sincronizacao::sincronizar;
use sea_orm::{ConnectionTrait, Database, Statement};
use serde_json::json;

fn reg(recurso: &str, uid: &str, dados: serde_json::Value) -> RegistroSync {
    RegistroSync {
        recurso: recurso.into(),
        sync_uid: uid.into(),
        atualizado_em: None,
        excluido_em: None,
        dados,
    }
}

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

/// Cenário 1 (US1): escritório registra entrada na nuvem → PDV puxa e recomputa estoque.
#[tokio::test]
#[ignore]
async fn escritorio_recebe_pdv_puxa_e_estoque_reflete() {
    let nuvem = SupabaseSync::conectar().await.expect("login");
    let lu = format!("11111111-1111-4111-8111-{:012}", 1u64); // uid fixo do livro de teste
    let mu = format!("22222222-2222-4222-8222-{:012}", 1u64); // uid do movimento
    let codigo = "E2E-PULL-007";

    // "Escritório" grava na nuvem: livro + entrada de 5 (eventos crus).
    nuvem
        .upsert("livro", &[reg("livro", &lu, json!({"sync_uid":lu,"codigo":codigo,"titulo":"Pull E2E","busca_norm":"pull","preco_centavos":0,"origem":"escritorio"}))])
        .await
        .expect("upsert livro");
    nuvem
        .upsert("movimento_estoque", &[reg("movimento_estoque", &mu, json!({"sync_uid":mu,"livro_uid":lu,"tipo":"entrada","qtd":5,"criado_em":"2026-07-20T09:00:00Z","origem":"escritorio"}))])
        .await
        .expect("upsert movimento");

    // PDV (base migrada vazia) sincroniza: puxa livro + movimento e recomputa.
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let local = SeaReplicaSync::new(db.clone());
    let r = sincronizar(&nuvem, &local).await.expect("sincronizar");
    println!("resumo pull: recebidos={}", r.recebidos);
    // Idempotência (T032/SC-004): sincronizar de novo NÃO muda nada.
    sincronizar(&nuvem, &local).await.expect("sincronizar 2x");

    let rows = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            format!("SELECT estoque AS e, (SELECT COUNT(*) FROM movimento_estoque) AS n FROM livro WHERE codigo='{codigo}'"),
        ))
        .await
        .unwrap();
    let estoque: i64 = rows.first().and_then(|r| r.try_get("", "e").ok()).unwrap_or(-1);
    let n: i64 = rows.first().and_then(|r| r.try_get("", "n").ok()).unwrap_or(-1);
    assert_eq!(estoque, 5, "estoque do PDV deve refletir a entrada do escritório");
    assert_eq!(n, 1, "re-sync não deve duplicar o movimento (idempotência)");
    println!("OK: PDV puxou a entrada; estoque={estoque}; após 2ª sync sem duplicar (mov={n})");
}
