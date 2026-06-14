//! Caso de uso: pesquisa do acervo (US3, FR-020..022).

use crate::application::erros::ErroApp;
use crate::application::ports::LivroRepo;
use crate::domain::livro::Livro;
use crate::domain::texto::normalize;

/// Busca por código de barras exato.
pub async fn por_codigo(codigo: &str, livros: &dyn LivroRepo) -> Result<Option<Livro>, ErroApp> {
    Ok(livros.por_codigo(codigo.trim()).await?)
}

/// Busca por título/autor, insensível a acento e caixa (FR-021).
pub async fn por_texto(termo: &str, livros: &dyn LivroRepo) -> Result<Vec<Livro>, ErroApp> {
    let norm = normalize(termo);
    if norm.trim().is_empty() {
        return Ok(vec![]);
    }
    Ok(livros.buscar_texto(norm.trim(), 50).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use async_trait::async_trait;
    use std::sync::Mutex;

    #[derive(Default)]
    struct EspiaRepo {
        ultimo_termo: Mutex<String>,
    }

    #[async_trait]
    impl LivroRepo for EspiaRepo {
        async fn por_codigo(&self, _c: &str) -> Result<Option<Livro>, RepoErro> {
            Ok(None)
        }
        async fn salvar(&self, _l: &Livro) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn inativar(&self, _c: &str) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn recentes(&self, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
        async fn buscar_texto(&self, termo: &str, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            *self.ultimo_termo.lock().unwrap() = termo.to_string();
            Ok(vec![])
        }
    }

    #[tokio::test]
    async fn normaliza_o_termo_antes_de_buscar() {
        let repo = EspiaRepo::default();
        por_texto("Bíblia", &repo).await.unwrap();
        assert_eq!(*repo.ultimo_termo.lock().unwrap(), "biblia");
    }

    #[tokio::test]
    async fn termo_vazio_nao_busca() {
        let repo = EspiaRepo::default();
        let r = por_texto("   ", &repo).await.unwrap();
        assert!(r.is_empty());
        assert_eq!(*repo.ultimo_termo.lock().unwrap(), "");
    }
}
