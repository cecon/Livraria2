//! Adapter da réplica local (SeaORM) — `ReplicaLocalRepo` (feature 007).
//!
//! `pendentes` monta o JSON no formato da nuvem (ver `replica_mapa`); `aplicar`
//! faz upsert com **LWW em SQL** (cadastros) ou `DO NOTHING` (eventos), com
//! **FK-remap** (`*_uid` → id local via subquery). Recursos ainda não mapeados
//! são no-op seguro. `recomputar_derivados` refaz o estoque pelo ledger (ADR-0008).

use super::replica_mapa::{expr_json, spec, valor, Tipo};
use crate::application::ports::RepoErro;
use crate::application::ports_sync::{RegistroSync, ReplicaLocalRepo};
use async_trait::async_trait;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, Value};
use std::collections::HashSet;

fn erro(e: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

pub struct SeaReplicaSync {
    db: DatabaseConnection,
}

impl SeaReplicaSync {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
    fn backend(&self) -> sea_orm::DatabaseBackend {
        self.db.get_database_backend()
    }
    async fn exec(&self, sql: String, vals: Vec<Value>) -> Result<(), RepoErro> {
        self.db
            .execute(Statement::from_sql_and_values(self.backend(), sql, vals))
            .await
            .map(|_| ())
            .map_err(erro)
    }
}

#[async_trait]
impl ReplicaLocalRepo for SeaReplicaSync {
    async fn pendentes(&self, recurso: &str) -> Result<Vec<RegistroSync>, RepoErro> {
        let Some(s) = spec(recurso) else { return Ok(vec![]) };
        // Atribui sync_uid (lazy) às linhas novas — inserts do app não o preenchem.
        self.exec(
            format!(
                "UPDATE {recurso} SET sync_uid=({}) WHERE sync_uid IS NULL OR sync_uid=''",
                crate::migration::m008::UUID_V4
            ),
            vec![],
        )
        .await?;
        let sql = format!(
            "SELECT {} AS j, sync_uid AS u FROM {} t WHERE sincronizado_em IS NULL",
            expr_json(s),
            recurso
        );
        let rows = self
            .db
            .query_all(Statement::from_string(self.backend(), sql))
            .await
            .map_err(erro)?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let j: String = r.try_get("", "j").map_err(erro)?;
            let dados: serde_json::Value = serde_json::from_str(&j).map_err(erro)?;
            out.push(RegistroSync {
                recurso: recurso.to_string(),
                sync_uid: r.try_get("", "u").map_err(erro)?,
                atualizado_em: dados.get("atualizado_em").and_then(|v| v.as_str()).map(str::to_string),
                excluido_em: dados.get("excluido_em").and_then(|v| v.as_str()).map(str::to_string),
                dados,
            });
        }
        Ok(out)
    }

    async fn marcar_sincronizado(&self, recurso: &str, uids: &[String], quando: &str) -> Result<(), RepoErro> {
        if uids.is_empty() {
            return Ok(());
        }
        let marca = format!("'{}'", quando.replace('\'', "''"));
        let lista = uids.iter().map(|u| format!("'{}'", u.replace('\'', "''"))).collect::<Vec<_>>().join(",");
        self.exec(
            format!("UPDATE {recurso} SET sincronizado_em={marca} WHERE sync_uid IN ({lista})"),
            vec![],
        )
        .await
    }

    async fn aplicar(&self, recurso: &str, registros: &[RegistroSync]) -> Result<(), RepoErro> {
        let Some(s) = spec(recurso) else { return Ok(()) };
        for reg in registros {
            let mut colunas: Vec<String> = vec![];
            let mut placeholders: Vec<String> = vec![];
            let mut vals: Vec<Value> = vec![];
            for (c, lit) in s.default_insert {
                colunas.push((*c).to_string());
                placeholders.push(format!("'{}'", lit.replace('\'', "''")));
            }
            for c in s.cols {
                colunas.push(c.nome.to_string());
                placeholders.push("?".into());
                vals.push(valor(&reg.dados, c.nome, c.tipo));
            }
            for r in s.refs {
                colunas.push(r.col_local.to_string());
                placeholders.push(format!("(select {} from {} where sync_uid=?)", r.chave_local_pai, r.pai));
                vals.push(valor(&reg.dados, r.uid_key, Tipo::Texto));
            }
            // Meta: origem/atualizado_em são NOT NULL (fallback 'pdv'/''); excluido_em nullable.
            let txt = |k: &str, def: &str| {
                reg.dados.get(k).and_then(|v| v.as_str()).unwrap_or(def).to_string()
            };
            for (col, val) in [
                ("sync_uid", Value::String(Some(Box::new(reg.sync_uid.clone())))),
                ("origem", Value::String(Some(Box::new(txt("origem", "pdv"))))),
                ("atualizado_em", Value::String(Some(Box::new(txt("atualizado_em", ""))))),
                ("excluido_em", valor(&reg.dados, "excluido_em", Tipo::Texto)),
            ] {
                colunas.push(col.to_string());
                placeholders.push("?".into());
                vals.push(val);
            }
            let sets: Vec<String> = s
                .cols
                .iter()
                .map(|c| c.nome.to_string())
                .chain(s.refs.iter().map(|r| r.col_local.to_string()))
                .chain(["origem", "atualizado_em", "excluido_em"].map(String::from))
                .map(|c| format!("{c}=excluded.{c}"))
                .collect();
            let conflito = if s.mutavel {
                format!(
                    "DO UPDATE SET {} WHERE excluded.atualizado_em > {recurso}.atualizado_em",
                    sets.join(",")
                )
            } else {
                "DO NOTHING".to_string()
            };
            let sql = format!(
                "INSERT INTO {recurso} ({}) VALUES ({}) ON CONFLICT(sync_uid) {conflito}",
                colunas.join(","),
                placeholders.join(",")
            );
            // FR-012/D11: registro problemático (órfão por FK/pai ausente, ou
            // colisão de chave natural — dedup, T033) é isolado e reportado, sem
            // abortar o lote. (A merge por chave natural é refinamento futuro.)
            if let Err(e) = self.exec(sql, vals).await {
                let m = e.to_string().to_lowercase();
                if m.contains("foreign key") || m.contains("not null") || m.contains("unique") {
                    eprintln!("sync: registro isolado ({recurso} {}): {e}", reg.sync_uid);
                    continue;
                }
                return Err(e);
            }
        }
        Ok(())
    }

    async fn uids_conhecidos(&self, recurso: &str) -> Result<HashSet<String>, RepoErro> {
        if spec(recurso).is_none() {
            return Ok(HashSet::new());
        }
        let rows = self
            .db
            .query_all(Statement::from_string(
                self.backend(),
                format!("SELECT sync_uid AS u FROM {recurso} WHERE sync_uid IS NOT NULL"),
            ))
            .await
            .map_err(erro)?;
        Ok(rows.iter().filter_map(|r| r.try_get::<String>("", "u").ok()).collect())
    }

    async fn cursor(&self, recurso: &str) -> Result<String, RepoErro> {
        let rows = self
            .db
            .query_all(Statement::from_string(
                self.backend(),
                format!("SELECT last_cursor AS c FROM sync_cursor WHERE recurso='{recurso}'"),
            ))
            .await
            .map_err(erro)?;
        Ok(rows.first().and_then(|r| r.try_get::<String>("", "c").ok()).unwrap_or_default())
    }

    async fn salvar_cursor(&self, recurso: &str, cursor: &str) -> Result<(), RepoErro> {
        self.exec(
            "INSERT INTO sync_cursor (recurso,last_cursor) VALUES (?,?) \
             ON CONFLICT(recurso) DO UPDATE SET last_cursor=excluded.last_cursor"
                .to_string(),
            vec![
                Value::String(Some(Box::new(recurso.to_string()))),
                Value::String(Some(Box::new(cursor.to_string()))),
            ],
        )
        .await
    }

    async fn recomputar_derivados(&self, livros_uid: &[String]) -> Result<(), RepoErro> {
        // Fold do ledger → saldo + custo_medio (ADR-0008/0009), em recompute.rs.
        super::recompute::recompor(&self.db, livros_uid).await
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm::Database;
    use serde_json::json;

    async fn base() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn livro_pendente_vira_json_da_nuvem_e_aplica_com_lww() {
        let db = base().await;
        let repo = SeaReplicaSync::new(db.clone());
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "INSERT INTO livro (codigo,titulo,ativo,atualizado_em) VALUES ('789','Orig',1,'2026-07-20T10:00:00Z')".to_string(),
        )).await.unwrap();

        let pend = repo.pendentes("livro").await.unwrap();
        assert_eq!(pend.len(), 1);
        assert_eq!(pend[0].dados["codigo"], "789");
        assert_eq!(pend[0].dados["ativo"], json!(true)); // 1 -> true

        let uid = pend[0].sync_uid.clone();
        let novo = RegistroSync {
            recurso: "livro".into(),
            sync_uid: uid.clone(),
            atualizado_em: Some("2026-07-20T12:00:00Z".into()),
            excluido_em: None,
            dados: json!({"sync_uid":uid,"codigo":"789","titulo":"Novo","ativo":true,
                "origem":"escritorio","atualizado_em":"2026-07-20T12:00:00Z","excluido_em":null,
                "autor":null,"preco_centavos":0,"categoria":0,"descricao":null,"busca_norm":"novo"}),
        };
        repo.aplicar("livro", &[novo]).await.unwrap();
        let rows = db.query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT titulo FROM livro WHERE codigo='789'".to_string(),
        )).await.unwrap();
        let titulo: String = rows[0].try_get("", "titulo").unwrap();
        assert_eq!(titulo, "Novo"); // LWW: edição mais nova venceu
    }

    #[tokio::test]
    async fn movimento_da_nuvem_remapeia_livro_e_recomputa_estoque() {
        let db = base().await;
        let repo = SeaReplicaSync::new(db.clone());
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "INSERT INTO livro (codigo,titulo,estoque) VALUES ('789','L',10)".to_string(),
        )).await.unwrap();
        let uid = repo.pendentes("livro").await.unwrap()[0].sync_uid.clone();

        let mov = RegistroSync {
            recurso: "movimento_estoque".into(),
            sync_uid: "mov-1".into(),
            atualizado_em: None,
            excluido_em: None,
            dados: json!({"sync_uid":"mov-1","livro_uid":uid,"tipo":"entrada","qtd":5,
                "origem":"escritorio","criado_em":"2026-07-20T09:00:00Z","atualizado_em":null,
                "excluido_em":null,"custo_unit_centavos":null,"fornecedor":null,"motivo":null,"referencia":null}),
        };
        repo.aplicar("movimento_estoque", &[mov]).await.unwrap();
        repo.recomputar_derivados(&[uid]).await.unwrap();

        let rows = db.query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT estoque, (SELECT COUNT(*) FROM movimento_estoque) n FROM livro WHERE codigo='789'".to_string(),
        )).await.unwrap();
        let estoque: i64 = rows[0].try_get("", "estoque").unwrap();
        let n: i64 = rows[0].try_get("", "n").unwrap();
        assert_eq!(n, 1, "movimento inserido com livro_id remapeado");
        assert_eq!(estoque, 5, "estoque recomputado = soma dos movimentos");
    }

    #[tokio::test]
    async fn movimento_orfao_e_isolado_sem_abortar_o_lote() {
        let db = base().await;
        let repo = SeaReplicaSync::new(db.clone());
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "INSERT INTO livro (codigo,titulo) VALUES ('111','L')".to_string(),
        )).await.unwrap();
        let uid = repo.pendentes("livro").await.unwrap()[0].sync_uid.clone();

        let orfao = RegistroSync {
            recurso: "movimento_estoque".into(),
            sync_uid: "m-orfao".into(),
            atualizado_em: None,
            excluido_em: None,
            dados: json!({"sync_uid":"m-orfao","livro_uid":"nao-existe","tipo":"entrada","qtd":3,
                "criado_em":"2026-07-20T09:00:00Z","origem":"escritorio","atualizado_em":null,"excluido_em":null,
                "custo_unit_centavos":null,"fornecedor":null,"motivo":null,"referencia":null}),
        };
        let valido = RegistroSync {
            recurso: "movimento_estoque".into(),
            sync_uid: "m-ok".into(),
            atualizado_em: None,
            excluido_em: None,
            dados: json!({"sync_uid":"m-ok","livro_uid":uid,"tipo":"entrada","qtd":5,
                "criado_em":"2026-07-20T09:00:00Z","origem":"escritorio","atualizado_em":null,"excluido_em":null,
                "custo_unit_centavos":null,"fornecedor":null,"motivo":null,"referencia":null}),
        };
        // Não deve dar erro mesmo com o órfão no lote.
        repo.aplicar("movimento_estoque", &[orfao, valido]).await.unwrap();

        let rows = db.query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT COUNT(*) AS n FROM movimento_estoque".to_string(),
        )).await.unwrap();
        let n: i64 = rows[0].try_get("", "n").unwrap();
        assert_eq!(n, 1, "só o movimento válido entrou; o órfão foi isolado");
    }
}
