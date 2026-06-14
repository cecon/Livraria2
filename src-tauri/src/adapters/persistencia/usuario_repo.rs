//! Implementação SeaORM da porta `UsuarioRepo` (US5). Senha em SHA-256 (gate local).

use super::entities::usuario::{ActiveModel, Entity as UsuarioEntity};
use crate::application::ports::{RepoErro, UsuarioRepo};
use async_trait::async_trait;
use sea_orm::{ActiveValue::Set, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait};
use sha2::{Digest, Sha256};

pub struct SeaUsuarioRepo {
    db: DatabaseConnection,
}

impl SeaUsuarioRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

pub fn hash_senha(senha: &str) -> String {
    let mut h = Sha256::new();
    h.update(senha.as_bytes());
    format!("{:x}", h.finalize())
}

#[async_trait]
impl UsuarioRepo for SeaUsuarioRepo {
    async fn autenticar(&self, usuario: &str, senha: &str) -> Result<bool, RepoErro> {
        let u = UsuarioEntity::find_by_id(usuario.trim().to_string())
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(match u {
            Some(m) => m.senha_hash == hash_senha(senha),
            None => false,
        })
    }

    async fn garantir_admin(&self) -> Result<(), RepoErro> {
        let n = UsuarioEntity::find().count(&self.db).await.map_err(erro)?;
        if n == 0 {
            let am = ActiveModel {
                usuario: Set("adm".to_string()),
                senha_hash: Set(hash_senha("adm")),
                nome: Set(Some("Administrador".to_string())),
            };
            UsuarioEntity::insert(am).exec(&self.db).await.map_err(erro)?;
        }
        Ok(())
    }
}
