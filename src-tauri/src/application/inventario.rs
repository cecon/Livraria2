//! Casos de uso do inventário (US2). A regra de "uma sessão aberta por vez" vive
//! aqui; as demais operações delegam ao InventarioRepo.

use crate::application::erros::ErroApp;
use crate::application::ports_inventario::{InventarioRepo, SessaoView};
use crate::domain::erros::ErroDominio;
use crate::domain::inventario::ModoInventario;

/// Abre uma sessão de inventário, garantindo modo válido e nenhuma outra aberta.
pub async fn abrir(
    modo: &str,
    rotulo: Option<String>,
    inv: &dyn InventarioRepo,
) -> Result<SessaoView, ErroApp> {
    if ModoInventario::de_str(modo).is_none() {
        return Err(ErroDominio::DadosInvalidos("modo de inventário inválido".into()).into());
    }
    if inv.sessao_aberta().await?.is_some() {
        return Err(
            ErroDominio::DadosInvalidos("já existe uma sessão de inventário aberta".into()).into(),
        );
    }
    let rotulo = rotulo.filter(|r| !r.trim().is_empty());
    Ok(inv.abrir(modo, rotulo).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use crate::application::ports_inventario::{
        BipagemResultado, DivergenciaView, FechamentoView, PendenciaView, RelatorioView,
    };
    use async_trait::async_trait;

    struct FakeInv {
        aberta: bool,
    }

    #[async_trait]
    impl InventarioRepo for FakeInv {
        async fn sessao_aberta(&self) -> Result<Option<SessaoView>, RepoErro> {
            Ok(self.aberta.then(|| SessaoView {
                id: 1,
                modo: "parcial".into(),
                rotulo: None,
                status: "aberta".into(),
                aberta_em: "x".into(),
                fechada_em: None,
            }))
        }
        async fn abrir(&self, modo: &str, rotulo: Option<String>) -> Result<SessaoView, RepoErro> {
            Ok(SessaoView {
                id: 2,
                modo: modo.into(),
                rotulo,
                status: "aberta".into(),
                aberta_em: "x".into(),
                fechada_em: None,
            })
        }
        async fn bipar(&self, _s: i64, _c: &str) -> Result<BipagemResultado, RepoErro> {
            unreachable!()
        }
        async fn desbipar(&self, _s: i64, _c: &str) -> Result<BipagemResultado, RepoErro> {
            unreachable!()
        }
        async fn ajustar_item(&self, _s: i64, _c: &str, _q: i64) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn revisao(&self, _s: i64) -> Result<Vec<DivergenciaView>, RepoErro> {
            Ok(vec![])
        }
        async fn fechar(&self, _s: i64, _t: bool) -> Result<FechamentoView, RepoErro> {
            unreachable!()
        }
        async fn cancelar(&self, _s: i64) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn divergencias(&self, _s: i64) -> Result<Vec<DivergenciaView>, RepoErro> {
            Ok(vec![])
        }
        async fn pendencias(&self, _a: bool) -> Result<Vec<PendenciaView>, RepoErro> {
            Ok(vec![])
        }
        async fn resolver_pendencia(&self, _id: i64) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn sessoes_realizadas(&self) -> Result<Vec<SessaoView>, RepoErro> {
            Ok(vec![])
        }
        async fn relatorio_sessao(&self, _s: i64) -> Result<RelatorioView, RepoErro> {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn abre_quando_livre() {
        let s = abrir("parcial", Some("Gaveta A".into()), &FakeInv { aberta: false })
            .await
            .unwrap();
        assert_eq!(s.id, 2);
    }

    #[tokio::test]
    async fn recusa_modo_invalido() {
        assert!(abrir("xxx", None, &FakeInv { aberta: false }).await.is_err());
    }

    #[tokio::test]
    async fn recusa_segunda_sessao() {
        assert!(abrir("parcial", None, &FakeInv { aberta: true })
            .await
            .is_err());
    }
}
