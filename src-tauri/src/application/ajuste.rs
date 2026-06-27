//! Caso de uso: ajuste avulso de estoque com motivo (US3, FR-040..043).
//! Valida motivo e não-negativo no domínio; persiste via EstoqueRepo.

use crate::application::erros::ErroApp;
use crate::application::ports::LivroRepo;
use crate::application::ports_estoque::EstoqueRepo;
use crate::domain::erros::ErroDominio;
use crate::domain::estoque::aplicar_ajuste;
use crate::domain::livro::Livro;

/// Aplica um ajuste de `delta` (±) ao estoque do livro, exigindo motivo e
/// barrando resultado negativo (FR-042/FR-043).
pub async fn registrar_ajuste(
    codigo: &str,
    delta: i64,
    motivo: &str,
    livros: &dyn LivroRepo,
    estoque: &dyn EstoqueRepo,
) -> Result<Livro, ErroApp> {
    if motivo.trim().is_empty() {
        return Err(ErroDominio::MotivoObrigatorio.into());
    }
    let livro = livros
        .por_codigo(codigo)
        .await?
        .ok_or(ErroDominio::LivroNaoEncontrado)?;
    // Valida não-negativo antes de persistir (estoque nunca < 0).
    aplicar_ajuste(livro.estoque, delta)?;
    Ok(estoque.registrar_ajuste(codigo, delta, motivo.trim()).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use crate::application::ports_estoque::{EntradaCmd, MovimentoView};
    use crate::domain::categoria::Categoria;
    use crate::domain::dinheiro::Dinheiro;
    use async_trait::async_trait;

    struct FakeLivros {
        estoque: i64,
    }

    fn livro(estoque: i64) -> Livro {
        Livro {
            codigo: "111".into(),
            titulo: "Bíblia".into(),
            autor: None,
            preco: Dinheiro::de_centavos(3000),
            categoria: Categoria::Biblias,
            estoque,
            descricao: None,
            custo_medio: Dinheiro::ZERO,
        }
    }

    #[async_trait]
    impl LivroRepo for FakeLivros {
        async fn por_codigo(&self, _c: &str) -> Result<Option<Livro>, RepoErro> {
            Ok(Some(livro(self.estoque)))
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
        async fn buscar_texto(&self, _t: &str, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
    }

    struct FakeEstoque;
    #[async_trait]
    impl EstoqueRepo for FakeEstoque {
        async fn registrar_entrada(&self, _c: EntradaCmd) -> Result<Livro, RepoErro> {
            unreachable!()
        }
        async fn registrar_ajuste(&self, _c: &str, delta: i64, _m: &str) -> Result<Livro, RepoErro> {
            Ok(livro(5 + delta))
        }
        async fn extrato(&self, _c: &str, _l: i64) -> Result<Vec<MovimentoView>, RepoErro> {
            Ok(vec![])
        }
        async fn gerar_saldos_iniciais(&self) -> Result<u64, RepoErro> {
            Ok(0)
        }
        async fn fornecedores_sugestoes(&self, _p: &str, _l: i64) -> Result<Vec<String>, RepoErro> {
            Ok(vec![])
        }
    }

    #[tokio::test]
    async fn motivo_obrigatorio() {
        let r = registrar_ajuste("111", -1, "  ", &FakeLivros { estoque: 5 }, &FakeEstoque).await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::MotivoObrigatorio))
        ));
    }

    #[tokio::test]
    async fn barra_estoque_negativo() {
        let r =
            registrar_ajuste("111", -9, "quebra", &FakeLivros { estoque: 5 }, &FakeEstoque).await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::EstoqueNegativo))
        ));
    }

    #[tokio::test]
    async fn ajuste_valido() {
        let l = registrar_ajuste("111", -2, "quebra", &FakeLivros { estoque: 5 }, &FakeEstoque)
            .await
            .unwrap();
        assert_eq!(l.estoque, 3);
    }
}
