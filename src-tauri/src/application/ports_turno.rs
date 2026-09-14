//! Portas do turno de operação (feature 009, ADR-0021). O adapter SeaORM persiste
//! em `turno_operacao` (m009), que sincroniza com a nuvem (replica_mapa).

use crate::application::ports::RepoErro;
use crate::domain::pedido::Recebimento;
use async_trait::async_trait;

/// Turno aberto (dados mínimos para a UI e para a numeração/fechamento).
/// `operador`/`maquina` compõem a identidade exibida no PDV (feature 013, FR-015/FR-021).
#[derive(Clone)]
pub struct TurnoAbertoInfo {
    pub sync_uid: String,
    pub caixa_inicial_centavos: i64,
    pub abertura: String,
    pub operador: String,
    /// `None` em turno legado (aberto antes da m014).
    pub maquina: Option<String>,
}

/// Dados do turno necessários ao fechamento de caixa.
pub struct DadosFechamento {
    pub caixa_inicial_centavos: i64,
    pub pagamentos: Vec<Recebimento>,
    pub qtd_vendas: i64,
}

/// Turno candidato à poda local (retenção — FR-007/008). O repositório devolve
/// só os já encerrados **e sem nenhuma pendência de sync**; quem decide pela
/// idade é o domínio (`turno_podavel`), no caso de uso.
pub struct TurnoPodavel {
    pub sync_uid: String,
    pub status: String,
    pub abertura: String,
}

/// Turno que a nuvem fechou mas ainda tem venda não sincronizada aqui (FR-024).
pub struct TurnoComPendencia {
    pub sync_uid: String,
    pub operador: String,
}

/// Linha do histórico de turnos encerrados.
pub struct TurnoHistorico {
    pub abertura: String,
    pub encerramento: Option<String>,
    pub status: String,
    pub esperado_centavos: Option<i64>,
    pub conferido_centavos: Option<i64>,
    pub diferenca_centavos: Option<i64>,
}

#[async_trait]
pub trait TurnoRepo: Send + Sync {
    /// Turno `aberto` **desta máquina**, seja qual for o operador (feature 013,
    /// FR-017: um único turno aberto por PDV; quem loga continua no que está aberto).
    /// Turnos de outros PDVs descem pela réplica — daí o filtro por `maquina`.
    async fn turno_aberto_na_maquina(&self, maquina: &str) -> Result<Option<TurnoAbertoInfo>, RepoErro>;
    /// Abre um turno (gera `sync_uid`). Idempotência é do chamador (checa antes).
    async fn abrir(
        &self,
        operador: &str,
        caixa_inicial_centavos: i64,
        maquina: &str,
    ) -> Result<TurnoAbertoInfo, RepoErro>;
    /// Pedidos não cancelados já registrados no turno (base do Pedido Nº).
    async fn contar_pedidos(&self, turno_uid: &str) -> Result<i64, RepoErro>;
    /// Caixa inicial + recebimentos + nº de vendas do turno (para o fechamento).
    async fn dados_fechamento(&self, turno_uid: &str) -> Result<DadosFechamento, RepoErro>;
    /// Id da forma de sistema "Dinheiro" (para o esperado só-dinheiro).
    async fn dinheiro_forma_id(&self) -> Result<i64, RepoErro>;
    /// Persiste o fechamento e marca o turno como encerrado.
    async fn encerrar(&self, turno_uid: &str, esperado: i64, conferido: i64, diferenca: i64) -> Result<(), RepoErro>;
    /// Histórico de turnos do operador (recentes primeiro).
    async fn listar(&self, operador: &str) -> Result<Vec<TurnoHistorico>, RepoErro>;
    /// Turnos encerrados cujo cluster (turno + vendas + filhas) já subiu inteiro —
    /// candidatos à poda. Nada pendente de sync entra aqui: a nuvem retém tudo,
    /// mas só se já recebeu.
    async fn turnos_podaveis(&self) -> Result<Vec<TurnoPodavel>, RepoErro>;
    /// Turnos **encerrados** desta máquina que ainda têm venda não sincronizada.
    /// É o conflito da FR-024: a nuvem fechou, o PDV ainda tinha o que subir.
    async fn turnos_encerrados_com_pendencias(&self, maquina: &str) -> Result<Vec<TurnoComPendencia>, RepoErro>;
    /// Números dos pedidos ainda não sincronizados de um turno, em ordem.
    async fn pedidos_pendentes_do_turno(&self, turno_uid: &str) -> Result<Vec<i64>, RepoErro>;
    /// Move um pedido para outro turno, renumerando-o lá dentro (FR-016).
    async fn mover_pedido(&self, numero: i64, destino_uid: &str, numero_no_turno: i64) -> Result<(), RepoErro>;
    /// Apaga o turno e todo o cluster de vendas dele, filha→pai, numa transação.
    /// Devolve quantas linhas saíram. NÃO toca em `livro`, `saldo_publicado` nem
    /// no razão de movimentos — poda é retenção, não é estorno.
    async fn podar_turno(&self, sync_uid: &str) -> Result<u64, RepoErro>;
}
