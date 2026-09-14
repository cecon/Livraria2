//! Implementação SeaORM da porta `UsuarioRepo` (US5). Senha em **bcrypt** (salgado/lento,
//! compatível com o `pgcrypto` da nuvem — ADR-0019), verificando também o **SHA-256 legado**
//! para migração sem quebrar logins existentes.

use super::entities::usuario::Entity as UsuarioEntity;
use crate::application::ports::{RepoErro, UsuarioRepo};
use async_trait::async_trait;
use sea_orm::{DatabaseConnection, DbErr, EntityTrait};
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

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifica_hash_bcrypt() {
        // Login contra um hash bcrypt (como o que a nuvem/pgcrypto entrega — ADR-0019).
        let h = bcrypt::hash("segredo", bcrypt::DEFAULT_COST).unwrap();
        assert!(h.starts_with("$2"), "hash bcrypt: {h}");
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
