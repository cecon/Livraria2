//! Adapter da réplica local (SeaORM) — `ReplicaLocalRepo` (feature 007).
//!
//! `pendentes` monta o JSON no **formato da nuvem** com `json_object` do SQLite
//! (booleanos 0/1→true/false; `atualizado_em` vazio→null; FKs remapeadas para
//! `*_uid` por subquery no pai). `aplicar` faz upsert com **LWW em SQL** (cadastros)
//! ou `DO NOTHING` (eventos). Recursos ainda não mapeados são no-op seguro (as
//! tabelas correspondentes na nuvem seguem vazias até serem incluídas).

use crate::application::ports::RepoErro;
use crate::application::ports_sync::{RegistroSync, ReplicaLocalRepo};
use async_trait::async_trait;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, Value};
use std::collections::HashSet;

#[derive(Clone, Copy)]
enum Tipo {
    Texto,
    Inteiro,
    Bool,
}
struct Col {
    nome: &'static str,
    tipo: Tipo,
}
/// FK remapeada: `uid_key` na nuvem ↔ `col_local` (id) resolvida pelo `pai`.
struct Ref {
    uid_key: &'static str,
    col_local: &'static str,
    pai: &'static str,
}
struct Spec {
    recurso: &'static str,
    mutavel: bool,
    /// coluna literal setada só no INSERT (ex.: usuario.senha_hash='' = senha pendente).
    default_insert: &'static [(&'static str, &'static str)],
    cols: &'static [Col],
    refs: &'static [Ref],
}

use Tipo::{Bool, Inteiro, Texto};

const SPECS: &[Spec] = &[
    Spec {
        recurso: "livro",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "codigo", tipo: Texto },
            Col { nome: "titulo", tipo: Texto },
            Col { nome: "autor", tipo: Texto },
            Col { nome: "preco_centavos", tipo: Inteiro },
            Col { nome: "categoria", tipo: Inteiro },
            Col { nome: "descricao", tipo: Texto },
            Col { nome: "busca_norm", tipo: Texto },
            Col { nome: "ativo", tipo: Bool },
        ],
        refs: &[],
    },
    Spec {
        recurso: "fornecedor",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "nome", tipo: Texto },
            Col { nome: "nome_norm", tipo: Texto },
            Col { nome: "documento", tipo: Texto },
            Col { nome: "telefone", tipo: Texto },
            Col { nome: "email", tipo: Texto },
            Col { nome: "observacoes", tipo: Texto },
            Col { nome: "ativo", tipo: Bool },
        ],
        refs: &[],
    },
];

fn spec(recurso: &str) -> Option<&'static Spec> {
    SPECS.iter().find(|s| s.recurso == recurso)
}

fn erro(e: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

/// Expressão `json_object(...)` para produzir a linha no formato da nuvem.
fn expr_json(s: &Spec) -> String {
    let mut p = vec![
        "'sync_uid',sync_uid".to_string(),
        "'origem',origem".to_string(),
        "'atualizado_em',iif(atualizado_em='',null,atualizado_em)".to_string(),
        "'excluido_em',excluido_em".to_string(),
    ];
    for c in s.cols {
        match c.tipo {
            Bool => p.push(format!("'{0}',json(iif({0},'true','false'))", c.nome)),
            _ => p.push(format!("'{0}',{0}", c.nome)),
        }
    }
    for r in s.refs {
        p.push(format!(
            "'{}',(select sync_uid from {} where id=t.{})",
            r.uid_key, r.pai, r.col_local
        ));
    }
    format!("json_object({})", p.join(","))
}

/// Valor SeaORM (nullable) a partir de um campo do JSON da nuvem.
fn valor(dados: &serde_json::Value, chave: &str, tipo: Tipo) -> Value {
    let v = dados.get(chave);
    match tipo {
        Tipo::Bool => Value::BigInt(Some(i64::from(v.and_then(|x| x.as_bool()).unwrap_or(false)))),
        Tipo::Inteiro => Value::BigInt(v.and_then(|x| x.as_i64())),
        Tipo::Texto => Value::String(
            v.and_then(|x| x.as_str()).map(|s| Box::new(s.to_string())),
        ),
    }
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
                placeholders.push(format!("(select id from {} where sync_uid=?)", r.pai));
                vals.push(valor(&reg.dados, r.uid_key, Tipo::Texto));
            }
            for meta in ["sync_uid", "origem", "atualizado_em", "excluido_em"] {
                colunas.push(meta.to_string());
                placeholders.push("?".into());
                vals.push(valor(&reg.dados, meta, Tipo::Texto));
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
            self.exec(sql, vals).await?;
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

    async fn recomputar_derivados(&self, _livros_uid: &[String]) -> Result<(), RepoErro> {
        // Recompute de estoque/custo_medio entra com o mapeamento de movimento_estoque.
        Ok(())
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
        // Livro local (id autoincrement; sync_uid backfilled pela m008).
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "INSERT INTO livro (codigo,titulo,ativo,atualizado_em) VALUES ('789','Orig',1,'2026-07-20T10:00:00Z')".to_string(),
        )).await.unwrap();
        // m008 backfill dá sync_uid; refaz p/ garantir pendente (sincronizado_em NULL já é o default).

        let pend = repo.pendentes("livro").await.unwrap();
        assert_eq!(pend.len(), 1);
        assert_eq!(pend[0].dados["codigo"], "789");
        assert_eq!(pend[0].dados["ativo"], json!(true)); // 1 -> true

        // Aplica uma versão MAIS NOVA vinda da "nuvem" (LWW atualiza).
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
}
