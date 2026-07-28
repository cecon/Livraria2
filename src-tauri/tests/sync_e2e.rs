//! Teste ponta a ponta REAL contra o Supabase (feature 007). `#[ignore]`: precisa
//! de rede + variáveis de ambiente do PDV:
//!   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PDV_EMAIL, SUPABASE_PDV_SENHA
//! Rodar: `cargo test --test sync_e2e -- --ignored --nocapture`

use livraria_2_lib::adapters::nuvem::supabase_sync::SupabaseSync;
use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::replica_sync::SeaReplicaSync;
use livraria_2_lib::adapters::persistencia::inicializar_schema;
use livraria_2_lib::application::ports::RepoErro;
use livraria_2_lib::application::ports_sync::{LotePull, NuvemRepo, RegistroSync, ReplicaLocalRepo};
use livraria_2_lib::application::sincronizacao::sincronizar;
use async_trait::async_trait;
use sea_orm::{ConnectionTrait, Database, Statement};
use serde_json::json;
use std::sync::Mutex;

fn reg(recurso: &str, uid: &str, dados: serde_json::Value) -> RegistroSync {
    RegistroSync {
        recurso: recurso.into(),
        sync_uid: uid.into(),
        atualizado_em: None,
        excluido_em: None,
        dados,
    }
}

#[derive(Default)]
struct NuvemDivergenteFake {
    enviados: Mutex<Vec<(String, serde_json::Value)>>,
    livro_entregue: Mutex<bool>,
}

#[async_trait]
impl NuvemRepo for NuvemDivergenteFake {
    async fn upsert(&self, recurso: &str, registros: &[RegistroSync]) -> Result<(), RepoErro> {
        let mut enviados = self.enviados.lock().unwrap();
        for r in registros {
            enviados.push((recurso.to_string(), r.dados.clone()));
        }
        Ok(())
    }

    async fn buscar_desde(&self, recurso: &str, _cursor: &str) -> Result<LotePull, RepoErro> {
        if recurso != "livro" || *self.livro_entregue.lock().unwrap() {
            return Ok(LotePull { registros: vec![], novo_cursor: String::new() });
        }
        *self.livro_entregue.lock().unwrap() = true;
        Ok(LotePull {
            registros: vec![reg(
                "livro",
                "00000000-0048-4000-8000-000000000001",
                json!({
                    "sync_uid": "00000000-0048-4000-8000-000000000001",
                    "codigo": "OFF-DIV-48",
                    "titulo": "Offline Divergente",
                    "autor": null,
                    "preco_centavos": 1000,
                    "categoria": 0,
                    "descricao": null,
                    "busca_norm": "offline divergente",
                    "ativo": true,
                    "origem": "escritorio",
                    "atualizado_em": "2026-07-28T11:00:00Z",
                    "excluido_em": null,
                    "saldo_publicado": -1
                }),
            )],
            novo_cursor: "2026-07-28T11:00:00Z".into(),
        })
    }

    async fn agora_servidor(&self) -> Result<String, RepoErro> {
        Ok("2026-07-28T12:00:00Z".into())
    }
}

#[tokio::test]
async fn cancelamento_sincroniza_metadata_sem_estorno_local_de_estoque() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO livro (codigo,titulo) VALUES ('791','Cancelavel')".to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,cancelado,cancelado_em,estoque_status) \
         VALUES (5100,'C','manha','2026-07-20',1000,1,'2026-07-20T11:00:00','pronta')"
            .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO movimento_estoque (livro_id,tipo,qtd,referencia,criado_em) \
         VALUES ((SELECT id FROM livro WHERE codigo='791'),'estorno',1,'5100','2026-07-20T11:00:00')"
            .to_string(),
    ))
    .await
    .unwrap();

    let local = SeaReplicaSync::new(db);
    let pedido = local.pendentes("pedido").await.unwrap().remove(0);
    assert_eq!(pedido.dados["cancelado"], json!(true));
    assert_eq!(pedido.dados["cancelado_em"], json!("2026-07-20T11:00:00"));
    assert!(local.pendentes("movimento_estoque").await.unwrap().is_empty());
}

#[tokio::test]
async fn venda_offline_sincroniza_e_exibe_saldo_publicado_divergente() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let backend = db.get_database_backend();

    db.execute(Statement::from_string(
        backend,
        "INSERT INTO livro (
            codigo,titulo,busca_norm,preco_centavos,saldo_publicado,
            sync_uid,origem,atualizado_em,sincronizado_em
         ) VALUES (
            'OFF-DIV-48','Offline Divergente','offline divergente',1000,1,
            '00000000-0048-4000-8000-000000000001','escritorio',
            '2026-07-28T10:00:00Z','2026-07-28T10:00:00Z'
         )"
        .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        backend,
        "INSERT INTO pedido (
            numero,cliente,turno,data,total_centavos,cancelado,estoque_status,
            estoque_pronta_em,sync_uid,origem
         ) VALUES (
            4801,'CLIENTE','manha','2026-07-28',2000,0,'pronta',
            '2026-07-28T10:30:00Z','00000000-0048-5000-8000-000000000001','pdv'
         )"
        .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        backend,
        "INSERT INTO item_pedido (
            pedido_numero,codigo,titulo,preco_centavos,qtd,sync_uid,origem
         ) VALUES (
            4801,'OFF-DIV-48','Offline Divergente',1000,2,
            '00000000-0048-6000-8000-000000000001','pdv'
         )"
        .to_string(),
    ))
    .await
    .unwrap();

    let nuvem = NuvemDivergenteFake::default();
    let local = SeaReplicaSync::new(db.clone());
    let resumo = sincronizar(&nuvem, &local).await.unwrap();

    assert!(resumo.enviados >= 2, "pedido e item offline devem subir");
    assert_eq!(resumo.recebidos, 1, "produto publicado pela nuvem deve descer");
    let enviados = nuvem.enviados.lock().unwrap();
    assert!(enviados.iter().any(|(r, d)| r == "pedido" && d["estoque_status"] == "pronta"));
    assert!(enviados.iter().any(|(r, d)| r == "item_pedido" && d["qtd"] == 2));

    let saldo = SeaEstoqueRepo::new(db)
        .saldo_operacional("OFF-DIV-48")
        .await
        .unwrap();
    assert_eq!(saldo, -1, "PDV deve exibir o saldo divergente publicado pela nuvem");
}

#[tokio::test]
#[ignore]
async fn sincroniza_livro_do_pdv_para_a_nuvem() {
    // 1) Conecta (login email/senha → JWT).
    let nuvem = SupabaseSync::conectar(None).await.expect("login PDV");

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
    let nuvem = SupabaseSync::conectar(None).await.expect("login");
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
