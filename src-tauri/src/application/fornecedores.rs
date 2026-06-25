//! Casos de uso de fornecedores (US1). Valida e delega ao FornecedorRepo.

use crate::application::erros::ErroApp;
use crate::application::ports_compras::FornecedorRepo;
use crate::domain::erros::ErroDominio;
use crate::domain::fornecedor::Fornecedor;

pub async fn listar(termo: &str, repo: &dyn FornecedorRepo) -> Result<Vec<Fornecedor>, ErroApp> {
    Ok(repo.listar(termo).await?)
}

/// Salva (inclui/altera) um fornecedor: nome obrigatório (FR-004) e sem duplicar `nome_norm`.
pub async fn salvar(f: Fornecedor, repo: &dyn FornecedorRepo) -> Result<Fornecedor, ErroApp> {
    f.validar()?;
    if repo.existe_nome(&f.nome_norm(), f.id).await? {
        return Err(ErroDominio::FornecedorDuplicado.into());
    }
    Ok(repo.salvar(&f).await?)
}

pub async fn excluir(id: i64, repo: &dyn FornecedorRepo) -> Result<(), ErroApp> {
    repo.excluir(id).await?;
    Ok(())
}

/// Adoção (boot): semeia fornecedores dos textos da 002 (idempotente, FR-005).
pub async fn adotar(repo: &dyn FornecedorRepo) -> Result<u64, ErroApp> {
    Ok(repo.semear().await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeForn {
        existe: bool,
        salvos: Mutex<Vec<Fornecedor>>,
    }

    #[async_trait::async_trait]
    impl FornecedorRepo for FakeForn {
        async fn listar(&self, _t: &str) -> Result<Vec<Fornecedor>, RepoErro> {
            Ok(vec![])
        }
        async fn por_id(&self, _id: i64) -> Result<Option<Fornecedor>, RepoErro> {
            Ok(None)
        }
        async fn existe_nome(&self, _n: &str, _e: i64) -> Result<bool, RepoErro> {
            Ok(self.existe)
        }
        async fn salvar(&self, f: &Fornecedor) -> Result<Fornecedor, RepoErro> {
            self.salvos.lock().unwrap().push(f.clone());
            Ok(Fornecedor { id: 1, ..f.clone() })
        }
        async fn excluir(&self, _id: i64) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn semear(&self) -> Result<u64, RepoErro> {
            Ok(0)
        }
    }

    fn forn(nome: &str) -> Fornecedor {
        Fornecedor {
            id: 0,
            nome: nome.into(),
            documento: None,
            telefone: None,
            email: None,
            observacoes: None,
            ativo: true,
        }
    }

    #[tokio::test]
    async fn nome_obrigatorio() {
        let r = salvar(forn("  "), &FakeForn::default()).await;
        assert!(matches!(r, Err(ErroApp::Dominio(ErroDominio::NomeObrigatorio))));
    }

    #[tokio::test]
    async fn rejeita_duplicado() {
        let fake = FakeForn { existe: true, ..Default::default() };
        let r = salvar(forn("Editora X"), &fake).await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::FornecedorDuplicado))
        ));
    }

    #[tokio::test]
    async fn salva_valido() {
        let fake = FakeForn::default();
        let f = salvar(forn("Editora X"), &fake).await.unwrap();
        assert_eq!(f.id, 1);
        assert_eq!(fake.salvos.lock().unwrap().len(), 1);
    }
}
