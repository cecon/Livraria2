//! Caso de uso: cadastro de livros (US2, FR-001..005). Incluir/alterar/excluir + lookup.

use crate::application::erros::ErroApp;
use crate::application::ports::LivroRepo;
use crate::domain::erros::ErroDominio;
use crate::domain::livro::Livro;
use crate::domain::texto::caixa_alta_sem_acento;

/// Lookup por código: existe → edição; não existe → novo (FR-002).
pub async fn buscar(codigo: &str, livros: &dyn LivroRepo) -> Result<Option<Livro>, ErroApp> {
    Ok(livros.por_codigo(codigo).await?)
}

/// Inclui ou altera (upsert). Valida campos obrigatórios e não-negativos.
/// Padroniza título e autor em CAIXA ALTA sem acento (controle de cadastro).
pub async fn salvar(mut livro: Livro, livros: &dyn LivroRepo) -> Result<(), ErroApp> {
    livro.titulo = caixa_alta_sem_acento(&livro.titulo);
    livro.autor = livro
        .autor
        .as_deref()
        .map(caixa_alta_sem_acento)
        .filter(|s| !s.is_empty());
    if livro.codigo.trim().is_empty() {
        return Err(ErroDominio::CodigoInvalido.into());
    }
    if livro.titulo.trim().is_empty() {
        return Err(ErroDominio::DadosInvalidos("título é obrigatório".into()).into());
    }
    if livro.estoque < 0 || livro.preco.centavos() < 0 {
        return Err(ErroDominio::DadosInvalidos("valores não podem ser negativos".into()).into());
    }
    livros.salvar(&livro).await?;
    Ok(())
}

/// Exclusão = soft-delete (FR-001).
pub async fn excluir(codigo: &str, livros: &dyn LivroRepo) -> Result<(), ErroApp> {
    livros.inativar(codigo).await?;
    Ok(())
}

/// Últimos cadastrados/alterados (FR-005).
pub async fn recentes(limite: i64, livros: &dyn LivroRepo) -> Result<Vec<Livro>, ErroApp> {
    Ok(livros.recentes(limite).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use crate::domain::categoria::Categoria;
    use crate::domain::dinheiro::Dinheiro;
    use async_trait::async_trait;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeLivros {
        salvos: Mutex<Vec<Livro>>,
    }

    #[async_trait]
    impl LivroRepo for FakeLivros {
        async fn por_codigo(&self, codigo: &str) -> Result<Option<Livro>, RepoErro> {
            Ok(self
                .salvos
                .lock()
                .unwrap()
                .iter()
                .find(|l| l.codigo == codigo)
                .cloned())
        }
        async fn salvar(&self, l: &Livro) -> Result<(), RepoErro> {
            self.salvos.lock().unwrap().push(l.clone());
            Ok(())
        }
        async fn inativar(&self, _codigo: &str) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn recentes(&self, _limite: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
        async fn buscar_texto(&self, _t: &str, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
    }

    fn livro(codigo: &str, titulo: &str, estoque: i64) -> Livro {
        Livro {
            codigo: codigo.into(),
            titulo: titulo.into(),
            autor: None,
            preco: Dinheiro::de_centavos(3000),
            categoria: Categoria::NaoCategorizado,
            estoque,
            descricao: None,
        }
    }

    #[tokio::test]
    async fn salvar_valido() {
        let repo = FakeLivros::default();
        salvar(livro("123", "Bíblia", 5), &repo).await.unwrap();
        assert_eq!(repo.salvos.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn salvar_rejeita_codigo_vazio_e_titulo_vazio() {
        let repo = FakeLivros::default();
        assert!(salvar(livro("", "X", 1), &repo).await.is_err());
        assert!(salvar(livro("123", "  ", 1), &repo).await.is_err());
        assert!(repo.salvos.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn salvar_rejeita_estoque_negativo() {
        let repo = FakeLivros::default();
        assert!(salvar(livro("123", "X", -1), &repo).await.is_err());
    }
}
