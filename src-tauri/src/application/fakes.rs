//! Fakes das portas para testes de casos de uso (só compila em `cfg(test)`).
//! Extraídos de `venda.rs` para manter os arquivos sob 300 linhas (Princípio III).

use crate::application::ports::{
    DadosCancelamento, FormaPagamentoRepo, LivroRepo, Maquina, PedidoRepo, Relogio, RepoErro,
    VendaTurno,
};
use crate::application::ports_turno::{
    DadosFechamento, TurnoAbertoInfo, TurnoHistorico, TurnoPodavel, TurnoRepo,
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
    /// Turno carimbado na venda (feature 013) — `(uid, numero_no_turno)`.
    pub turno_registrado: Mutex<Option<(String, i64)>>,
    /// Turno da venda devolvido por `dados_cancelamento` (default: o turno aberto).
    pub turno_da_venda: Option<String>,
}

#[async_trait]
impl PedidoRepo for FakePedidos {
    async fn proximo_numero(&self) -> Result<i64, RepoErro> {
        Ok(5997)
    }
    async fn registrar(&self, pedido: &Pedido, turno: Option<&VendaTurno>) -> Result<(), RepoErro> {
        *self.registrado.lock().unwrap() = Some(pedido.clone());
        *self.turno_registrado.lock().unwrap() = turno.map(|t| (t.uid.clone(), t.numero_no_turno));
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
    async fn dados_cancelamento(&self, _numero: i64) -> Result<Option<DadosCancelamento>, RepoErro> {
        Ok(Some(DadosCancelamento {
            data: "2026-06-14".to_string(),
            ja_cancelado: false,
            turno_uid: Some(self.turno_da_venda.clone().unwrap_or_else(|| TURNO_ABERTO_UID.into())),
        }))
    }
}

/// `sync_uid` do turno aberto do `FakeTurnos`.
pub const TURNO_ABERTO_UID: &str = "turno-aberto-1";

/// Fake do turno: `aberto = false` simula PDV sem turno (venda bloqueada — FR-002).
pub struct FakeTurnos {
    pub aberto: bool,
    /// Vendas já registradas no turno (base do Pedido Nº — FR-016).
    pub qtd_pedidos: i64,
}

impl Default for FakeTurnos {
    fn default() -> Self {
        Self { aberto: true, qtd_pedidos: 0 }
    }
}

#[async_trait]
impl TurnoRepo for FakeTurnos {
    async fn turno_aberto_na_maquina(&self, maquina: &str) -> Result<Option<TurnoAbertoInfo>, RepoErro> {
        Ok(self.aberto.then(|| TurnoAbertoInfo {
            sync_uid: TURNO_ABERTO_UID.into(),
            caixa_inicial_centavos: 0,
            abertura: "2026-06-14T08:00:00".into(),
            operador: "op-1".into(),
            maquina: Some(maquina.to_string()),
        }))
    }
    async fn adotar_turnos_sem_maquina(&self, _maquina: &str) -> Result<u64, RepoErro> {
        Ok(0)
    }
    async fn abrir(&self, operador: &str, caixa: i64, maquina: &str) -> Result<TurnoAbertoInfo, RepoErro> {
        Ok(TurnoAbertoInfo {
            sync_uid: TURNO_ABERTO_UID.into(),
            caixa_inicial_centavos: caixa,
            abertura: "2026-06-14T08:00:00".into(),
            operador: operador.into(),
            maquina: Some(maquina.to_string()),
        })
    }
    async fn contar_pedidos(&self, _turno_uid: &str) -> Result<i64, RepoErro> {
        Ok(self.qtd_pedidos)
    }
    async fn dados_fechamento(&self, _turno_uid: &str) -> Result<DadosFechamento, RepoErro> {
        Ok(DadosFechamento { caixa_inicial_centavos: 0, pagamentos: vec![], qtd_vendas: 0 })
    }
    async fn dinheiro_forma_id(&self) -> Result<i64, RepoErro> {
        Ok(3)
    }
    async fn encerrar(&self, _uid: &str, _e: i64, _c: i64, _d: i64) -> Result<(), RepoErro> {
        Ok(())
    }
    async fn listar(&self, _operador: &str) -> Result<Vec<TurnoHistorico>, RepoErro> {
        Ok(vec![])
    }
    async fn turnos_podaveis(&self) -> Result<Vec<TurnoPodavel>, RepoErro> {
        Ok(vec![])
    }
    async fn podar_turno(&self, _sync_uid: &str) -> Result<u64, RepoErro> {
        Ok(0)
    }
}

/// Fake da identidade da máquina (nome do PC fixo).
pub struct MaquinaFixa;
impl Maquina for MaquinaFixa {
    fn nome(&self) -> String {
        "PDV-TESTE".to_string()
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
