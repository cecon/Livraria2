//! Fakes das portas para testes de casos de uso (só compila em `cfg(test)`).
//! Extraídos de `venda.rs` para manter os arquivos sob 300 linhas (Princípio III).

use crate::application::ports::{
    FormaPagamentoRepo, LivroRepo, PedidoRepo, Relogio, RepoErro,
};
use crate::domain::livro::Livro;
use crate::domain::pagamento::FormaPagamento;
use crate::domain::pedido::Pedido;
use async_trait::async_trait;
use std::sync::Mutex;

pub struct FakeLivros {
    pub acervo: Vec<Livro>,
}

#[async_trait]
impl LivroRepo for FakeLivros {
    async fn por_codigo(&self, codigo: &str) -> Result<Option<Livro>, RepoErro> {
        Ok(self.acervo.iter().find(|l| l.codigo == codigo).cloned())
    }
    async fn buscar_texto(&self, _t: &str, _l: i64) -> Result<Vec<Livro>, RepoErro> {
        Ok(vec![])
    }
}

#[derive(Default)]
pub struct FakePedidos {
    pub registrado: Mutex<Option<Pedido>>,
}

#[async_trait]
impl PedidoRepo for FakePedidos {
    async fn proximo_numero(&self) -> Result<i64, RepoErro> {
        Ok(5997)
    }
    async fn registrar(&self, pedido: &Pedido) -> Result<(), RepoErro> {
        *self.registrado.lock().unwrap() = Some(pedido.clone());
        Ok(())
    }
    async fn importar(&self, _pedido: &Pedido) -> Result<bool, RepoErro> {
        Ok(true)
    }
    async fn excluir_item(&self, _item_id: i64) -> Result<(), RepoErro> {
        Ok(())
    }
    async fn excluir_pedido(&self, _numero: i64) -> Result<(), RepoErro> {
        Ok(())
    }
    async fn dados_cancelamento(
        &self,
        _numero: i64,
    ) -> Result<Option<(String, bool)>, RepoErro> {
        Ok(Some(("2026-06-14".to_string(), false)))
    }
}

/// Fake do cadastro: 1=Crédito, 3=Dinheiro, 9=Boleto (inativa).
pub struct FakeFormas;

fn f(id: i64, chave: &str, ativa: bool) -> FormaPagamento {
    FormaPagamento {
        id,
        chave: chave.into(),
        rotulo: chave.into(),
        de_sistema: chave == "dinheiro" || chave == "credito",
        ativa,
        ordem: id,
    }
}

#[async_trait]
impl FormaPagamentoRepo for FakeFormas {
    async fn listar(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
        Ok(vec![f(1, "credito", true), f(3, "dinheiro", true), f(9, "boleto", false)])
    }
    async fn listar_ativas(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
        Ok(self.listar().await?.into_iter().filter(|x| x.ativa).collect())
    }
    async fn por_id(&self, id: i64) -> Result<Option<FormaPagamento>, RepoErro> {
        Ok(self.listar().await?.into_iter().find(|x| x.id == id))
    }
    async fn por_chave(&self, chave: &str) -> Result<Option<FormaPagamento>, RepoErro> {
        Ok(self.listar().await?.into_iter().find(|x| x.chave == chave))
    }
}

pub struct RelogioFixo;
impl Relogio for RelogioFixo {
    fn hora_atual(&self) -> u32 {
        10
    }
    fn hoje_iso(&self) -> String {
        "2026-06-14".to_string()
    }
}

/// Fake da porta de destinações: cadastro vazio, sem carimbos nem repasse.
pub struct FakeDestinacoes;

#[async_trait]
impl crate::application::ports_destinacao::DestinacaoRepo for FakeDestinacoes {
    async fn listar(&self) -> Result<Vec<crate::domain::destinacao::Destinacao>, RepoErro> {
        Ok(vec![])
    }
    async fn relatorio(
        &self,
        _inicio: &str,
        _fim: &str,
    ) -> Result<crate::application::ports_destinacao::RelatorioDestinacoes, RepoErro> {
        unimplemented!()
    }
    async fn repasse(
        &self,
        _data: &str,
        _periodo: &str,
    ) -> Result<Vec<crate::application::ports_destinacao::RepasseDestinacao>, RepoErro> {
        Ok(vec![])
    }
}
