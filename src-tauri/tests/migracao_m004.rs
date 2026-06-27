//! Teste da migração m004 (feature 004, ADR-0012): identidade do livro.
//! Constrói o esquema 002/003, popula com linhas válidas + órfãs e valida o
//! rebuild: `id` PK, `codigo` único, sem `codigo_barras`, FKs→`livro_id`,
//! preservação das linhas válidas, descarte das órfãs e `foreign_key_check` limpo.

use livraria_2_lib::adapters::persistencia::inicializar_schema;
use livraria_2_lib::migration::{m004, Migrator};
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, Statement};
use sea_orm_migration::MigratorTrait;

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_m004_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

async fn run(db: &DatabaseConnection, sql: &str) {
    db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap();
}

async fn n(db: &DatabaseConnection, sql: &str) -> i64 {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap()
        .unwrap()
        .try_get::<i64>("", "n")
        .unwrap()
}

async fn colunas(db: &DatabaseConnection, tabela: &str) -> Vec<String> {
    db.query_all(Statement::from_string(
        db.get_database_backend(),
        format!("PRAGMA table_info({tabela})"),
    ))
    .await
    .unwrap()
    .iter()
    .filter_map(|r| r.try_get::<String>("", "name").ok())
    .collect()
}

#[tokio::test]
async fn m004_migra_sem_perder_validas_e_descarta_orfas() {
    let (url, path) = url_temp();
    // Conexão única + foreign_keys OFF: reproduz a base real (FKs não enforced),
    // permitindo fabricar as órfãs pré-existentes que a migração deve descartar.
    let mut opt = ConnectOptions::new(url);
    opt.max_connections(1);
    let db = Database::connect(opt).await.unwrap();
    run(&db, "PRAGMA foreign_keys = OFF").await;
    // Apenas as migrations versionadas (002/003) — esquema antigo, SEM a m004
    // (que o boot aplica automaticamente, mas aqui queremos exercê-la à mão).
    Migrator::up(&db, None).await.unwrap();

    // Livros válidos.
    run(&db, "INSERT INTO livro (codigo,titulo,busca_norm) VALUES ('A1','LIVRO A1','livro a1')").await;
    run(&db, "INSERT INTO livro (codigo,titulo,busca_norm) VALUES ('A2','LIVRO A2','livro a2')").await;
    // Sessão e lançamento para satisfazer as FKs das filhas.
    run(&db, "INSERT INTO sessao_inventario (modo,rotulo,status,aberta_em) VALUES ('parcial','G','fechada','2026-06-25')").await;
    run(&db, "INSERT INTO lancamento_entrada (data,status) VALUES ('2026-06-25','rascunho')").await;

    // movimento_estoque: 2 válidos + 1 órfã (GHOST não existe em livro).
    run(&db, "INSERT INTO movimento_estoque (livro_codigo,tipo,qtd) VALUES ('A1','saldo_inicial',5)").await;
    run(&db, "INSERT INTO movimento_estoque (livro_codigo,tipo,qtd) VALUES ('A2','saldo_inicial',3)").await;
    run(&db, "INSERT INTO movimento_estoque (livro_codigo,tipo,qtd) VALUES ('GHOST','saldo_inicial',2)").await;

    // item_contagem: 1 válido + 1 órfã.
    run(&db, "INSERT INTO item_contagem (sessao_id,livro_codigo,qtd_contada,qtd_sistema) VALUES (1,'A1',5,5)").await;
    run(&db, "INSERT INTO item_contagem (sessao_id,livro_codigo,qtd_contada,qtd_sistema) VALUES (1,'GHOST',2,2)").await;

    // item_lancamento: 1 válido.
    run(&db, "INSERT INTO item_lancamento (lancamento_id,livro_codigo,qtd,custo_unit_centavos) VALUES (1,'A2',3,1000)").await;

    // Aplica a migração.
    let rel = m004::aplicar(&db).await.unwrap().expect("deveria migrar");
    assert_eq!(rel.livros, 2);
    assert_eq!(rel.mov_validos, 2);
    assert_eq!(rel.mov_orfaos, 1);
    assert_eq!(rel.contagem_validos, 1);
    assert_eq!(rel.contagem_orfaos, 1);
    assert_eq!(rel.lancamento_validos, 1);
    assert_eq!(rel.lancamento_orfaos, 0);

    // Esquema novo: livro tem `id`, não tem `codigo_barras`.
    let cols = colunas(&db, "livro").await;
    assert!(cols.contains(&"id".to_string()), "livro deve ter id");
    assert!(!cols.contains(&"codigo_barras".to_string()), "codigo_barras deve sumir");
    assert!(colunas(&db, "movimento_estoque").await.contains(&"livro_id".to_string()));

    // Contagens: válidas preservadas, órfãs descartadas.
    assert_eq!(n(&db, "SELECT count(*) AS n FROM livro").await, 2);
    assert_eq!(n(&db, "SELECT count(*) AS n FROM movimento_estoque").await, 2);
    assert_eq!(n(&db, "SELECT count(*) AS n FROM item_contagem").await, 1);
    assert_eq!(n(&db, "SELECT count(*) AS n FROM item_lancamento").await, 1);

    // FKs realmente resolvem por id.
    assert_eq!(
        n(&db, "SELECT count(*) AS n FROM movimento_estoque m JOIN livro l ON l.id = m.livro_id").await,
        2
    );
    // Integridade referencial limpa.
    let viol = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA foreign_key_check".to_string(),
        ))
        .await
        .unwrap();
    assert!(viol.is_empty(), "foreign_key_check deve estar limpo");

    // Idempotência: re-aplicar não faz nada.
    assert!(m004::aplicar(&db).await.unwrap().is_none());

    let _ = std::fs::remove_file(&path);
}

/// Validação contra a base REAL (cópia de produção). Rodar com:
/// `M004_REAL_DB=/tmp/livraria_pre_m004.db cargo test --test migracao_m004 -- --ignored`
#[tokio::test]
#[ignore]
async fn m004_base_real() {
    let Ok(origem) = std::env::var("M004_REAL_DB") else {
        eprintln!("M004_REAL_DB não definido — pulando");
        return;
    };
    let dest = std::env::temp_dir().join(format!("livraria_real_m004_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&dest);
    std::fs::copy(&origem, &dest).unwrap();
    let url = format!("sqlite://{}?mode=rwc", dest.display());
    let mut opt = ConnectOptions::new(url);
    opt.max_connections(1);
    let db = Database::connect(opt).await.unwrap();
    run(&db, "PRAGMA foreign_keys = OFF").await;

    let antes_livro = n(&db, "SELECT count(*) AS n FROM livro").await;
    let rel = m004::aplicar(&db).await.unwrap().expect("deveria migrar a base real");
    eprintln!("BASE REAL → {rel:?}");

    assert_eq!(n(&db, "SELECT count(*) AS n FROM livro").await, antes_livro, "nenhum livro perdido");
    assert!(colunas(&db, "livro").await.contains(&"id".to_string()));
    assert!(!colunas(&db, "livro").await.contains(&"codigo_barras".to_string()));
    let viol = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA foreign_key_check".to_string(),
        ))
        .await
        .unwrap();
    assert!(viol.is_empty(), "foreign_key_check limpo na base real");
    // Idempotência na base real.
    assert!(m004::aplicar(&db).await.unwrap().is_none());

    let _ = std::fs::remove_file(&dest);
}

/// Caminho REAL de boot: `inicializar_schema` (Migrator 002/003 + m004) sobre a
/// cópia de produção, com a conexão padrão (pool/FK como no app). Rodar com:
/// `M004_REAL_DB=/tmp/livraria_pre_m004.db cargo test --test migracao_m004 -- --ignored`
#[tokio::test]
#[ignore]
async fn boot_real_inicializa_schema() {
    let Ok(origem) = std::env::var("M004_REAL_DB") else {
        return;
    };
    let dest = std::env::temp_dir().join(format!("livraria_boot_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&dest);
    std::fs::copy(&origem, &dest).unwrap();
    let url = format!("sqlite://{}?mode=rwc", dest.display());
    let db = Database::connect(url).await.unwrap();

    inicializar_schema(&db).await.unwrap(); // 002/003 (no-op) + m004
    inicializar_schema(&db).await.unwrap(); // idempotente: nada muda

    assert!(colunas(&db, "livro").await.contains(&"id".to_string()));
    assert!(!colunas(&db, "livro").await.contains(&"codigo_barras".to_string()));
    // m005: soft-delete de venda
    assert!(colunas(&db, "pedido").await.contains(&"cancelado".to_string()));
    assert!(n(&db, "SELECT count(*) AS n FROM livro").await >= 1);
    let viol = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA foreign_key_check".to_string(),
        ))
        .await
        .unwrap();
    assert!(viol.is_empty(), "boot real: foreign_key_check limpo");

    let _ = std::fs::remove_file(&dest);
}
