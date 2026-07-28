//! Implementação SeaORM da porta `UsuarioRepo` (US5). Senha em **bcrypt** (salgado/lento,
//! compatível com o `pgcrypto` da nuvem — ADR-0019), verificando também o **SHA-256 legado**
//! para migração sem quebrar logins existentes.

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

/// Hash de uma senha nova: **bcrypt** (ADR-0019). Fallback para SHA-256 só se o bcrypt falhar
/// (não deve acontecer) — mantém o cadastro funcionando em vez de estourar.
pub fn hash_senha(senha: &str) -> String {
    bcrypt::hash(senha, bcrypt::DEFAULT_COST).unwrap_or_else(|_| hash_sha256_legado(senha))
}

/// SHA-256 sem salt — algoritmo **legado** (pré-ADR-0019). Mantido só para verificar hashes
/// antigos ainda não migrados.
fn hash_sha256_legado(senha: &str) -> String {
    let mut h = Sha256::new();
    h.update(senha.as_bytes());
    format!("{:x}", h.finalize())
}

/// Confere `senha` contra o `hash` armazenado, aceitando bcrypt (`$2*$…`) **ou** SHA-256 legado.
pub fn verificar_senha(senha: &str, hash: &str) -> bool {
    if hash.starts_with("$2") {
        bcrypt::verify(senha, hash).unwrap_or(false)
    } else {
        !hash.is_empty() && hash == hash_sha256_legado(senha)
    }
}

#[async_trait]
impl UsuarioRepo for SeaUsuarioRepo {
    async fn autenticar(&self, usuario: &str, senha: &str) -> Result<bool, RepoErro> {
        let u = UsuarioEntity::find_by_id(usuario.trim().to_string())
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(match u {
            Some(m) => verificar_senha(senha, &m.senha_hash),
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
                perfil: Set("admin".to_string()),
            };
            UsuarioEntity::insert(am).exec(&self.db).await.map_err(erro)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_novo_e_bcrypt_e_verifica() {
        let h = hash_senha("segredo");
        assert!(h.starts_with("$2"), "senha nova deve ser bcrypt: {h}");
        assert!(verificar_senha("segredo", &h));
        assert!(!verificar_senha("errada", &h));
    }

    #[test]
    fn verifica_hash_sha256_legado() {
        // Hash antigo (pré-ADR-0019) continua validando — migração sem quebrar login.
        let legado = hash_sha256_legado("adm");
        assert_eq!(legado.len(), 64); // hex do SHA-256
        assert!(verificar_senha("adm", &legado));
        assert!(!verificar_senha("outra", &legado));
    }

    #[test]
    fn hash_vazio_nunca_autentica() {
        // Usuário vindo da nuvem sem senha definida (senha_hash='') não loga com nada.
        assert!(!verificar_senha("", ""));
        assert!(!verificar_senha("qualquer", ""));
    }
}
