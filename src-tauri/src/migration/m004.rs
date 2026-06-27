//! Migração m004 (feature 004, ADR-0012): identidade do livro.
//!
//! Reconstrói `livro` adicionando `id INTEGER PRIMARY KEY AUTOINCREMENT`,
//! tornando `codigo` (barcode EAN/ISBN) `UNIQUE NOT NULL` e **removendo
//! `codigo_barras`**. Re-aponta as FKs reais (`movimento_estoque`,
//! `item_contagem`, `item_lancamento`) de `livro_codigo` para `livro_id`
//! (REFERENCES `livro(id)`). `item_pedido` (snapshot) e `pendencia_cadastro`
//! não são tocados.
//!
//! Segurança (FR-044): tudo numa transação única; o `INNER JOIN` descarta
//! apenas **órfãs pré-existentes** (FK para livro inexistente — já violavam
//! integridade); a verificação compara `count(novo)` com `count(linhas válidas)`
//! e **aborta (rollback)** se qualquer linha válida sumir; `PRAGMA
//! foreign_key_check` precisa ficar limpo.
//!
//! As tabelas filhas `_new` referenciam `livro_new(id)` durante o rebuild; ao
//! renomear `livro_new`→`livro`, o SQLite (≥3.25, `legacy_alter_table` OFF)
//! reescreve essas FKs para `livro(id)`. Assim tudo roda na conexão única da
//! transação, sem depender do pragma `foreign_keys` (que é por-conexão e no-op
//! dentro de transação).

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement, TransactionTrait};

/// Relatório do que a migração fez (para log/teste). Órfãs = linhas filhas cujo
/// `livro_codigo` não existia em `livro` e foram intencionalmente descartadas.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RelatorioM004 {
    pub livros: i64,
    pub mov_validos: i64,
    pub mov_orfaos: i64,
    pub contagem_validos: i64,
    pub contagem_orfaos: i64,
    pub lancamento_validos: i64,
    pub lancamento_orfaos: i64,
}

impl RelatorioM004 {
    pub fn total_orfaos(&self) -> i64 {
        self.mov_orfaos + self.contagem_orfaos + self.lancamento_orfaos
    }
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

/// Detecta se a migração já foi aplicada (idempotência por estado): `livro`
/// já tem a coluna `id`. Permite chamar `aplicar` com segurança em base nova,
/// já migrada ou legada.
pub async fn ja_aplicada(db: &DatabaseConnection) -> Result<bool, DbErr> {
    let rows = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA table_info(livro)".to_string(),
        ))
        .await?;
    for r in &rows {
        if r.try_get::<String>("", "name").ok().as_deref() == Some("id") {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Aplica a m004 de forma idempotente: não faz nada se já aplicada (FR-044).
pub async fn aplicar(db: &DatabaseConnection) -> Result<Option<RelatorioM004>, DbErr> {
    if ja_aplicada(db).await? {
        return Ok(None);
    }
    rebuild(db).await.map(Some)
}

/// O rebuild propriamente dito, numa transação única. Público para teste.
pub async fn rebuild(db: &DatabaseConnection) -> Result<RelatorioM004, DbErr> {
    let txn = db.begin().await?;

    // 1) Contagens de referência (antes de qualquer DROP).
    let livros = conta(&txn, "SELECT count(*) AS n FROM livro").await?;
    let mov_total = conta(&txn, "SELECT count(*) AS n FROM movimento_estoque").await?;
    let mov_validos = conta(
        &txn,
        "SELECT count(*) AS n FROM movimento_estoque WHERE livro_codigo IN (SELECT codigo FROM livro)",
    )
    .await?;
    let cont_total = conta(&txn, "SELECT count(*) AS n FROM item_contagem").await?;
    let cont_validos = conta(
        &txn,
        "SELECT count(*) AS n FROM item_contagem WHERE livro_codigo IN (SELECT codigo FROM livro)",
    )
    .await?;
    let lanc_total = conta(&txn, "SELECT count(*) AS n FROM item_lancamento").await?;
    let lanc_validos = conta(
        &txn,
        "SELECT count(*) AS n FROM item_lancamento WHERE livro_codigo IN (SELECT codigo FROM livro)",
    )
    .await?;

    // 2) livro_new (id PK, codigo único, sem codigo_barras) + cópia.
    exec(
        &txn,
        "CREATE TABLE livro_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            titulo TEXT NOT NULL,
            autor TEXT,
            preco_centavos INTEGER NOT NULL DEFAULT 0,
            categoria INTEGER NOT NULL DEFAULT 0,
            estoque INTEGER NOT NULL DEFAULT 0,
            descricao TEXT,
            busca_norm TEXT NOT NULL DEFAULT '',
            ativo INTEGER NOT NULL DEFAULT 1,
            atualizado_em TEXT NOT NULL DEFAULT '',
            custo_medio_centavos INTEGER NOT NULL DEFAULT 0
        )",
    )
    .await?;
    exec(
        &txn,
        "INSERT INTO livro_new
            (codigo,titulo,autor,preco_centavos,categoria,estoque,descricao,busca_norm,ativo,atualizado_em,custo_medio_centavos)
         SELECT codigo,titulo,autor,preco_centavos,categoria,estoque,descricao,busca_norm,ativo,atualizado_em,custo_medio_centavos
         FROM livro",
    )
    .await?;

    // 3) Tabelas filhas com livro_id (INNER JOIN descarta órfãs).
    exec(
        &txn,
        "CREATE TABLE movimento_estoque_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            livro_id INTEGER NOT NULL REFERENCES livro_new(id),
            tipo TEXT NOT NULL,
            qtd INTEGER NOT NULL,
            custo_unit_centavos INTEGER,
            fornecedor TEXT,
            motivo TEXT,
            referencia TEXT,
            criado_em TEXT NOT NULL DEFAULT ''
        )",
    )
    .await?;
    exec(
        &txn,
        "INSERT INTO movimento_estoque_new (id,livro_id,tipo,qtd,custo_unit_centavos,fornecedor,motivo,referencia,criado_em)
         SELECT m.id, ln.id, m.tipo, m.qtd, m.custo_unit_centavos, m.fornecedor, m.motivo, m.referencia, m.criado_em
         FROM movimento_estoque m JOIN livro_new ln ON ln.codigo = m.livro_codigo",
    )
    .await?;

    exec(
        &txn,
        "CREATE TABLE item_contagem_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessao_id INTEGER NOT NULL REFERENCES sessao_inventario(id),
            livro_id INTEGER NOT NULL REFERENCES livro_new(id),
            qtd_contada INTEGER NOT NULL DEFAULT 0,
            qtd_sistema INTEGER,
            UNIQUE(sessao_id, livro_id)
        )",
    )
    .await?;
    exec(
        &txn,
        "INSERT INTO item_contagem_new (id,sessao_id,livro_id,qtd_contada,qtd_sistema)
         SELECT i.id, i.sessao_id, ln.id, i.qtd_contada, i.qtd_sistema
         FROM item_contagem i JOIN livro_new ln ON ln.codigo = i.livro_codigo",
    )
    .await?;

    exec(
        &txn,
        "CREATE TABLE item_lancamento_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lancamento_id INTEGER NOT NULL REFERENCES lancamento_entrada(id),
            livro_id INTEGER NOT NULL REFERENCES livro_new(id),
            qtd INTEGER NOT NULL,
            custo_unit_centavos INTEGER NOT NULL DEFAULT 0,
            UNIQUE(lancamento_id, livro_id)
        )",
    )
    .await?;
    exec(
        &txn,
        "INSERT INTO item_lancamento_new (id,lancamento_id,livro_id,qtd,custo_unit_centavos)
         SELECT il.id, il.lancamento_id, ln.id, il.qtd, il.custo_unit_centavos
         FROM item_lancamento il JOIN livro_new ln ON ln.codigo = il.livro_codigo",
    )
    .await?;

    // 4) Verificação anti-perda: novo == válidos (órfãs descartadas de propósito).
    let mov_novo = conta(&txn, "SELECT count(*) AS n FROM movimento_estoque_new").await?;
    let cont_novo = conta(&txn, "SELECT count(*) AS n FROM item_contagem_new").await?;
    let lanc_novo = conta(&txn, "SELECT count(*) AS n FROM item_lancamento_new").await?;
    let livro_novo = conta(&txn, "SELECT count(*) AS n FROM livro_new").await?;
    if livro_novo != livros
        || mov_novo != mov_validos
        || cont_novo != cont_validos
        || lanc_novo != lanc_validos
    {
        return Err(DbErr::Custom(format!(
            "m004 abortada: perda de linha válida (livro {livro_novo}/{livros}, mov {mov_novo}/{mov_validos}, contagem {cont_novo}/{cont_validos}, lancamento {lanc_novo}/{lanc_validos})"
        )));
        // txn cai fora de escopo => rollback automático.
    }

    // 5) Troca atômica: dropar antigas, renomear novas.
    for sql in [
        "DROP TABLE movimento_estoque",
        "ALTER TABLE movimento_estoque_new RENAME TO movimento_estoque",
        "DROP TABLE item_contagem",
        "ALTER TABLE item_contagem_new RENAME TO item_contagem",
        "DROP TABLE item_lancamento",
        "ALTER TABLE item_lancamento_new RENAME TO item_lancamento",
        "DROP TABLE livro",
        "ALTER TABLE livro_new RENAME TO livro",
        "CREATE INDEX IF NOT EXISTS idx_livro_busca ON livro(busca_norm)",
        "CREATE INDEX IF NOT EXISTS idx_mov_livro ON movimento_estoque(livro_id, id)",
        "CREATE INDEX IF NOT EXISTS idx_item_lanc ON item_lancamento(lancamento_id)",
    ] {
        exec(&txn, sql).await?;
    }

    // 6) Integridade referencial limpa.
    let viol = txn
        .query_all(Statement::from_string(
            txn.get_database_backend(),
            "PRAGMA foreign_key_check".to_string(),
        ))
        .await?;
    if !viol.is_empty() {
        return Err(DbErr::Custom(format!(
            "m004 abortada: foreign_key_check acusou {} violação(ões)",
            viol.len()
        )));
    }

    txn.commit().await?;
    Ok(RelatorioM004 {
        livros,
        mov_validos,
        mov_orfaos: mov_total - mov_validos,
        contagem_validos: cont_validos,
        contagem_orfaos: cont_total - cont_validos,
        lancamento_validos: lanc_validos,
        lancamento_orfaos: lanc_total - lanc_validos,
    })
}
