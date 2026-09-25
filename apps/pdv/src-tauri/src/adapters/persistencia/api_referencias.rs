use crate::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, TransactionTrait, Value as SqlValue};
use serde_json::Value;

fn erro(_: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia("Falha ao aplicar referencias; pagina preservada para nova tentativa".into())
}

pub async fn aplicar(db: &DatabaseConnection, recurso: &str, registros: &[Value]) -> Result<(), RepoErro> {
    let (chave, campos): (&str, &[&str]) = match recurso {
        "usuario" => ("usuario", &["usuario", "nome", "perfil", "senha_hash"]),
        "forma_pagamento" => ("chave", &["chave", "rotulo", "de_sistema", "ativa", "ordem"]),
        "destinacao" => ("nome_norm", &["nome", "nome_norm", "de_sistema", "ativa", "ordem"]),
        _ => return Err(erro("recurso")),
    };
    let tx = db.begin().await.map_err(erro)?;
    let backend = db.get_database_backend();
    let agora = chrono::Utc::now().to_rfc3339();
    for registro in registros {
        let uid = registro["sync_uid"].as_str().ok_or_else(|| erro("uid"))?;
        uuid::Uuid::parse_str(uid).map_err(erro)?;
        let natural = registro[chave].as_str().ok_or_else(|| erro("chave"))?;
        tx.execute(Statement::from_sql_and_values(backend, format!(
            "UPDATE {recurso} SET sync_uid=? WHERE {chave}=? AND NOT EXISTS (SELECT 1 FROM {recurso} WHERE sync_uid=?)"),
            [uid.into(), natural.into(), uid.into()])).await.map_err(erro)?;
        let mut valores: Vec<SqlValue> = Vec::new();
        for campo in campos {
            let valor = registro.get(*campo).ok_or_else(|| erro("campo ausente"))?;
            valores.push(match valor {
                Value::String(s) => s.clone().into(),
                Value::Bool(b) => i64::from(*b).into(),
                Value::Number(n) => n.as_i64().ok_or_else(|| erro("inteiro"))?.into(),
                Value::Null if *campo == "nome" => Option::<String>::None.into(),
                _ => return Err(erro("tipo")),
            });
        }
        let excluido = match registro.get("excluido_em") {
            Some(Value::Null) => None,
            Some(Value::String(s)) => Some(s.clone()),
            _ => return Err(erro("exclusao")),
        };
        valores.extend([uid.into(), excluido.into(), "nuvem".into(), agora.clone().into(), agora.clone().into()]);
        let mut colunas = campos.to_vec();
        colunas.extend(["sync_uid", "excluido_em", "origem", "atualizado_em", "sincronizado_em"]);
        let placeholders = vec!["?"; colunas.len()].join(",");
        let updates = colunas.iter().filter(|c| **c != "sync_uid")
            .map(|c| format!("{c}=excluded.{c}")).collect::<Vec<_>>().join(",");
        tx.execute(Statement::from_sql_and_values(backend, format!(
            "INSERT INTO {recurso} ({}) VALUES ({placeholders}) ON CONFLICT(sync_uid) DO UPDATE SET {updates}",
            colunas.join(",")), valores)).await.map_err(erro)?;
    }
    tx.commit().await.map_err(erro)
}
